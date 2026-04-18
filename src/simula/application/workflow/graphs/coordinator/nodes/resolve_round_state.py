"""State transition helpers for round resolution."""

from __future__ import annotations

from typing import cast, get_args

from pydantic import ValidationError

from simula.application.workflow.graphs.runtime.proposal_contract import (
    validate_actor_action_proposal_semantics,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.application.workflow.utils.prompt_projections import build_event_memory_prompt_view
from simula.domain.contracts import ActionCatalog, ActorActionProposal, RuntimeProgressionPlan
from simula.domain.runtime.actions import ActorProposalPayload
from simula.domain.runtime.policy import build_initial_intent_snapshots
from simula.domain.scenario.time import (
    TimeUnit,
    cumulative_elapsed_label,
    duration_label,
    duration_minutes,
)

_SUPPORTED_TIME_UNITS = frozenset(get_args(TimeUnit))


def filter_invalid_adopted_cast_ids(
    *,
    adopted_cast_ids: list[str],
    pending_actor_proposals: list[ActorProposalPayload],
    actors: list[dict[str, object]],
    actor_intent_states: list[dict[str, object]],
    action_catalog: dict[str, object],
    max_targets_per_activity: int,
) -> tuple[list[str], list[str]]:
    catalog = ActionCatalog.model_validate(action_catalog)
    available_actions = [item.model_dump(mode="json") for item in catalog.actions]
    valid_cast_ids = [
        str(actor.get("cast_id", ""))
        for actor in actors
        if str(actor.get("cast_id", "")).strip()
    ]
    proposal_by_cast_id = {
        str(item["cast_id"]): item for item in pending_actor_proposals
    }
    valid_adopted_cast_ids: list[str] = []
    errors: list[str] = []

    for cast_id in adopted_cast_ids:
        proposal_result = proposal_by_cast_id.get(str(cast_id))
        if proposal_result is None or bool(proposal_result.get("forced_idle")):
            errors.append(
                f"round adopted proposal dropped: cast `{cast_id}` has no usable proposal"
            )
            continue
        try:
            proposal = ActorActionProposal.model_validate(proposal_result["proposal"])
        except (ValidationError, ValueError, TypeError) as exc:
            errors.append(
                f"round adopted proposal dropped: cast `{cast_id}` parse failed: {exc}"
            )
            continue

        issues = validate_actor_action_proposal_semantics(
            proposal=proposal,
            cast_id=str(cast_id),
            available_actions=available_actions,
            valid_target_cast_ids=valid_cast_ids,
            visible_actors=actors,
            goal_snapshot=next(
                (
                    item for item in actor_intent_states
                    if str(item.get("cast_id", "")) == str(cast_id)
                ),
                {},
            ),
            max_target_count=max_targets_per_activity,
        )
        if issues:
            errors.append(
                f"round adopted proposal dropped: cast `{cast_id}` invalid: {'; '.join(issues)}"
            )
            continue
        valid_adopted_cast_ids.append(str(cast_id))
    return valid_adopted_cast_ids, errors


def merge_actor_intent_states(
    *,
    actors: list[dict[str, object]],
    current_actor_intent_states: list[dict[str, object]],
    updated_actor_intent_states: list[dict[str, object]],
) -> list[dict[str, object]]:
    current_by_cast_id = {
        cast_id: snapshot
        for snapshot in current_actor_intent_states
        if (cast_id := str(snapshot.get("cast_id", "")).strip())
    }
    updated_by_cast_id = {
        cast_id: snapshot
        for snapshot in updated_actor_intent_states
        if (cast_id := str(snapshot.get("cast_id", "")).strip())
    }
    merged: list[dict[str, object]] = []
    for actor in actors:
        cast_id = str(actor.get("cast_id", "")).strip()
        if not cast_id:
            continue
        merged.append(
            updated_by_cast_id.get(cast_id)
            or current_by_cast_id.get(cast_id)
            or build_initial_intent_snapshots([actor])[0]
        )
    return merged


def pending_proposals_as_activity_hints(
    pending_actor_proposals: list[dict[str, object]],
) -> list[dict[str, object]]:
    hints: list[dict[str, object]] = []
    for item in pending_actor_proposals:
        proposal = cast(dict[str, object], item.get("proposal", {}))
        if not proposal:
            continue
        hints.append(
            {
                "activity_id": f"pending:{str(item.get('cast_id', '')).strip()}",
                "source_cast_id": str(item.get("cast_id", "")).strip(),
                "target_cast_ids": string_list(proposal.get("target_cast_ids", [])),
                "action_type": str(proposal.get("action_type", "")).strip(),
                "summary": str(proposal.get("summary", "")).strip(),
                "detail": str(proposal.get("detail", "")).strip(),
                "utterance": str(proposal.get("utterance", "")).strip(),
                "goal": str(proposal.get("goal", "")).strip(),
            }
        )
    return hints


def build_event_memory_history_entry(
    *,
    round_index: int,
    source: str,
    event_updates: list[dict[str, object]],
    event_memory: dict[str, object],
    requested_stop_reason: str,
    effective_stop_reason: str,
) -> dict[str, object]:
    return {
        "round_index": round_index,
        "source": source,
        "event_updates": event_updates,
        "event_memory_summary": build_event_memory_prompt_view(event_memory, limit=5),
        "stop_context": {
            "requested_stop_reason": requested_stop_reason,
            "effective_stop_reason": effective_stop_reason,
        },
    }


def default_actor_facing_scenario_digest(
    *,
    state: SimulationWorkflowState,
    world_state_summary: str,
    latest_activities: list[dict[str, object]],
) -> dict[str, object]:
    existing = cast(dict[str, object], state.get("actor_facing_scenario_digest", {}))
    event_memory = cast(dict[str, object], state.get("event_memory", {}))
    pending_event_views = [
        item
        for item in dict_list(event_memory.get("events", []))
        if str(item.get("status", "")) not in {"completed", "missed"}
    ]
    next_step_notes = [
        str(item.get("summary", "")).strip()
        for item in latest_activities[:2]
        if str(item.get("summary", "")).strip()
    ] or string_list(existing.get("next_step_notes", []))[:2]
    if not next_step_notes:
        next_step_notes = ["이번 단계에서 상황을 실제로 바꿀 다음 한 걸음을 더 분명하게 잡는다."]
    current_pressures = string_list(existing.get("current_pressures", []))[:3]
    if not current_pressures:
        current_pressures = [
            str(item.get("title", "")).strip()
            for item in pending_event_views[:2]
            if str(item.get("title", "")).strip()
        ]
    if not current_pressures:
        current_pressures = ["직전 반응 이후 다음 선택 압력이 유지되고 있다."]
    return {
        "round_index": int(state["round_index"]),
        "current_pressures": current_pressures,
        "next_step_notes": next_step_notes,
        "world_state_summary": world_state_summary,
    }


def default_time_advance(state: SimulationWorkflowState) -> dict[str, object]:
    plan = RuntimeProgressionPlan.model_validate(state["plan"]["progression_plan"])
    elapsed_unit = (
        "minute" if "minute" in plan.allowed_elapsed_units else plan.default_elapsed_unit
    )
    elapsed_amount = 30 if elapsed_unit == "minute" else 1
    return {
        "elapsed_unit": elapsed_unit,
        "elapsed_amount": elapsed_amount,
        "reason": "이번 단계에는 큰 시간 점프보다 기본 진행 단위를 따른다.",
    }


def build_updated_clock(
    *,
    state: SimulationWorkflowState,
    time_advance: dict[str, object],
) -> dict[str, dict[str, object]]:
    previous_clock = cast(dict[str, object], state["simulation_clock"])
    elapsed_unit = str(time_advance["elapsed_unit"])
    elapsed_amount = int(str(time_advance["elapsed_amount"]))
    if elapsed_unit not in _SUPPORTED_TIME_UNITS:
        raise ValueError(f"지원하지 않는 elapsed_unit 입니다: {elapsed_unit}")
    normalized_elapsed_unit = cast(TimeUnit, elapsed_unit)
    elapsed_minutes = duration_minutes(
        time_unit=normalized_elapsed_unit,
        amount=elapsed_amount,
    )
    total_elapsed_minutes = int(str(previous_clock.get("total_elapsed_minutes", 0))) + elapsed_minutes
    round_time_record = {
        "round_index": int(state["round_index"]),
        "elapsed_unit": normalized_elapsed_unit,
        "elapsed_amount": elapsed_amount,
        "elapsed_minutes": elapsed_minutes,
        "elapsed_label": duration_label(
            time_unit=normalized_elapsed_unit,
            amount=elapsed_amount,
        ),
        "total_elapsed_minutes": total_elapsed_minutes,
        "total_elapsed_label": cumulative_elapsed_label(total_elapsed_minutes),
        "reason": str(time_advance["reason"]),
    }
    clock = {
        "total_elapsed_minutes": total_elapsed_minutes,
        "total_elapsed_label": round_time_record["total_elapsed_label"],
        "last_elapsed_minutes": elapsed_minutes,
        "last_elapsed_label": round_time_record["elapsed_label"],
        "last_advanced_round_index": int(state["round_index"]),
    }
    return {
        "time_advance": cast(dict[str, object], round_time_record),
        "simulation_clock": cast(dict[str, object], clock),
    }


def string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def dict_list(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, object], item) for item in value if isinstance(item, dict)]
