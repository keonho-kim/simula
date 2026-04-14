"""Purpose:
- Resolve one runtime round in a single required bundle.
"""

from __future__ import annotations

import json
import time
from typing import cast

from langgraph.runtime import Runtime
from langgraph.types import Overwrite
from pydantic import ValidationError

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.coordinator.output_schema.bundles import (
    build_round_resolution_prompt_bundle,
)
from simula.application.workflow.graphs.coordinator.prompts.round_resolution_prompt import (
    PROMPT as STEP_RESOLUTION_PROMPT,
)
from simula.application.workflow.graphs.runtime.proposal_contract import (
    validate_actor_action_proposal_semantics,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.application.workflow.utils.streaming import emit_custom_event
from simula.application.workflow.utils.prompt_projections import (
    WORLD_STATE_SUMMARY_LIMIT,
    build_compact_background_updates,
    build_compact_pending_actor_proposals,
    build_event_memory_prompt_view,
    build_progression_plan_prompt_view,
    build_relevant_intent_states,
    build_visible_action_context,
    truncate_text,
)
from simula.domain.contracts import (
    ActionCatalog,
    ActorActionProposal,
    RoundResolution,
    RuntimeProgressionPlan,
)
from simula.domain.event_memory import (
    apply_event_updates,
    build_transition_event_updates,
    evaluate_round_event_updates,
    hard_stop_round,
    has_required_unresolved_events,
    sanitize_event_updates,
)
from simula.domain.runtime_policy import next_stagnation_steps
from simula.domain.runtime_actions import (
    ActorProposalPayload,
    apply_adopted_actor_proposals,
)
from simula.domain.log_events import (
    build_round_actions_adopted_event,
    build_round_event_memory_updated_event,
    build_round_observer_report_event,
    build_round_time_advanced_event,
)


async def resolve_round(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Resolve adopted actions, observer summary, time, persistence, and stop state."""

    pending_actor_proposals = cast(
        list[dict[str, object]],
        list(state["pending_actor_proposals"]),
    )
    latest_background_updates = list(state["latest_background_updates"])
    latest_action_views, _ = build_visible_action_context(
        unread_visible_activities=[],
        recent_visible_activities=list(state["latest_round_activities"]),
        limit=6,
    )
    pending_event_match_hints = evaluate_round_event_updates(
        dict(state.get("event_memory", {})),
        latest_round_activities=_pending_proposals_as_activity_hints(
            pending_actor_proposals
        ),
        current_round_index=int(state["round_index"]),
    )
    relevant_cast_ids = [
        *list(state["selected_cast_ids"]),
        *[
            str(item.get("cast_id", ""))
            for item in latest_background_updates
            if str(item.get("cast_id", "")).strip()
        ],
    ]
    prompt = STEP_RESOLUTION_PROMPT.format(
        round_index=state["round_index"],
        round_focus_plan_json=json.dumps(
            state["round_focus_plan"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        pending_actor_proposals_json=json.dumps(
            build_compact_pending_actor_proposals(pending_actor_proposals),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        latest_background_updates_json=json.dumps(
            build_compact_background_updates(latest_background_updates),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        latest_activities_json=json.dumps(
            latest_action_views,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        actor_intent_states_json=json.dumps(
            build_relevant_intent_states(
                list(state["actor_intent_states"]),
                relevant_cast_ids=relevant_cast_ids,
            ),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        actor_facing_scenario_digest_json=json.dumps(
            state.get("actor_facing_scenario_digest", {}),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        simulation_clock_json=json.dumps(
            state["simulation_clock"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        progression_plan_json=json.dumps(
            build_progression_plan_prompt_view(state["plan"]["progression_plan"]),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        event_memory_json=json.dumps(
            build_event_memory_prompt_view(
                state.get("event_memory", {}),
                limit=5,
            ),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        event_match_hints_json=json.dumps(
            pending_event_match_hints,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        world_state_summary=truncate_text(
            state["world_state_summary"],
            WORLD_STATE_SUMMARY_LIMIT,
        ),
        **build_round_resolution_prompt_bundle(),
    )
    default_payload = _build_default_round_resolution_payload(
        state,
        event_updates=pending_event_match_hints["suggested_updates"],
    )
    resolution, meta = await runtime.context.llms.ainvoke_structured_with_meta(
        "coordinator",
        prompt,
        RoundResolution,
        allow_default_on_failure=True,
        default_payload=default_payload,
        log_context={
            "scope": "round-resolution",
            "round_index": int(state["round_index"]),
        },
    )
    valid_adopted_cast_ids, invalid_adoption_errors = _filter_invalid_adopted_cast_ids(
        adopted_cast_ids=list(resolution.adopted_cast_ids),
        pending_actor_proposals=cast(
            list[ActorProposalPayload],
            list(state["pending_actor_proposals"]),
        ),
        actors=list(state["actors"]),
        actor_intent_states=list(state.get("actor_intent_states", [])),
        action_catalog=cast(dict[str, object], state["plan"]["action_catalog"]),
        max_targets_per_activity=runtime.context.settings.runtime.max_recipients_per_message,
    )
    applied = apply_adopted_actor_proposals(
        run_id=state["run_id"],
        round_index=int(state["round_index"]),
        actors=list(state["actors"]),
        activity_feeds=dict(state["activity_feeds"]),
        activities=list(state["activities"]),
        action_catalog=cast(dict[str, object], state["plan"]["action_catalog"]),
        pending_actor_proposals=cast(
            list[ActorProposalPayload],
            list(state["pending_actor_proposals"]),
        ),
        adopted_cast_ids=valid_adopted_cast_ids,
        max_targets_per_activity=runtime.context.settings.runtime.max_recipients_per_message,
    )
    applied_event_hints = evaluate_round_event_updates(
        dict(state.get("event_memory", {})),
        latest_round_activities=list(applied["latest_round_activities"]),
        current_round_index=int(state["round_index"]),
    )
    sanitized_event_updates = sanitize_event_updates(
        dict(state.get("event_memory", {})),
        proposed_updates=[
            item.model_dump(mode="json") for item in resolution.event_updates
        ],
        latest_round_activities=list(applied["latest_round_activities"]),
        evaluation_hints=applied_event_hints,
    )
    next_event_memory = apply_event_updates(
        dict(state.get("event_memory", {})),
        event_updates=sanitized_event_updates,
        current_round_index=int(state["round_index"]),
    )
    clock = _build_updated_clock(
        state=state,
        round_time_advance=resolution.round_time_advance.model_dump(mode="json"),
    )
    report_payload = resolution.observer_report.model_dump(mode="json")
    observer_reports = list(state["observer_reports"]) + [report_payload]
    stagnation_rounds = next_stagnation_steps(
        previous_stagnation_steps=int(state["stagnation_rounds"]),
        latest_activities=list(applied["latest_round_activities"]),
        momentum=resolution.observer_report.momentum,
    )
    stop_reason = resolution.stop_reason
    planned_max_rounds = int(state.get("planned_max_rounds", state["max_rounds"]))
    hard_stop = hard_stop_round(
        configured_max_rounds=int(state["max_rounds"]),
        planned_max_rounds=planned_max_rounds,
    )
    if (
        stop_reason == "simulation_done"
        and has_required_unresolved_events(next_event_memory)
        and int(state["round_index"]) < hard_stop
    ):
        stop_reason = ""
    if stop_reason == "simulation_done" and has_required_unresolved_events(next_event_memory):
        next_event_memory = apply_event_updates(
            next_event_memory,
            event_updates=[],
            current_round_index=int(state["round_index"]),
            finalize_unresolved_as_missed=True,
        )
    actual_event_updates = build_transition_event_updates(
        dict(state.get("event_memory", {})),
        next_event_memory,
    )
    stop_requested = bool(stop_reason)
    digest = resolution.actor_facing_scenario_digest
    runtime.context.logger.info(
        "round %s 해소 완료 | adopted=%s background=%s events=%s stop=%s | world=%s | pressures=%s | talking_points=%s",
        state["round_index"],
        len(list(resolution.adopted_cast_ids)),
        len(latest_background_updates),
        len(actual_event_updates),
        stop_reason or "-",
        truncate_text(resolution.world_state_summary, 90),
        ", ".join(digest.current_pressures[:2]) or "-",
        ", ".join(digest.talking_points[:2]) or "-",
    )
    runtime.context.store.save_round_artifacts(
        state["run_id"],
        activities=list(applied["latest_round_activities"]),
        observer_report=report_payload,
    )
    emit_custom_event(
        build_round_time_advanced_event(
            run_id=str(state["run_id"]),
            round_index=int(state["round_index"]),
            time_advance=clock["round_time_advance"],
        )
    )
    if list(applied["latest_round_activities"]):
        emit_custom_event(
            build_round_actions_adopted_event(
                run_id=str(state["run_id"]),
                round_index=int(state["round_index"]),
                activities=list(applied["latest_round_activities"]),
            )
        )
    emit_custom_event(
        build_round_observer_report_event(
            run_id=str(state["run_id"]),
            round_index=int(state["round_index"]),
            observer_report=report_payload,
        )
    )
    event_memory_history_entry = _build_event_memory_history_entry(
        round_index=int(state["round_index"]),
        source="resolve_round",
        event_updates=actual_event_updates,
        event_memory=next_event_memory,
        requested_stop_reason=resolution.stop_reason,
        effective_stop_reason=stop_reason,
    )
    emit_custom_event(
        build_round_event_memory_updated_event(
            run_id=str(state["run_id"]),
            round_index=int(state["round_index"]),
            source=str(event_memory_history_entry["source"]),
            event_updates=_dict_list(event_memory_history_entry.get("event_updates", [])),
            event_memory_summary=cast(
                dict[str, object], event_memory_history_entry["event_memory_summary"]
            ),
            stop_context=cast(dict[str, object], event_memory_history_entry["stop_context"]),
        )
    )
    errors = list(state["errors"]) + invalid_adoption_errors
    if meta.forced_default:
        errors.append(f"round {state['round_index']} resolution defaulted")
    return {
        "activity_feeds": applied["activity_feeds"],
        "activities": applied["activities"],
        "latest_round_activities": applied["latest_round_activities"],
        "pending_actor_proposals": Overwrite(value=[]),
        "actor_intent_states": [
            item.model_dump(mode="json") for item in resolution.updated_intent_states
        ],
        "event_memory": next_event_memory,
        "event_memory_history": list(state.get("event_memory_history", []))
        + [event_memory_history_entry],
        "intent_history": list(state["intent_history"])
        + [
            {
                "round_index": int(state["round_index"]),
                "actor_intent_states": [
                    item.model_dump(mode="json")
                    for item in resolution.updated_intent_states
                ],
            }
        ],
        "round_time_advance": clock["round_time_advance"],
        "simulation_clock": clock["simulation_clock"],
        "round_time_history": list(state["round_time_history"])
        + [clock["round_time_advance"]],
        "observer_reports": observer_reports,
        "actor_facing_scenario_digest": resolution.actor_facing_scenario_digest.model_dump(
            mode="json"
        ),
        "world_state_summary": resolution.world_state_summary,
        "stagnation_rounds": stagnation_rounds,
        "stop_requested": stop_requested,
        "stop_reason": stop_reason,
        "parse_failures": int(state["parse_failures"])
        + applied["parse_failure_count"]
        + meta.parse_failure_count,
        "forced_idles": int(state["forced_idles"]) + applied["forced_idle_count"],
        "last_round_latency_seconds": time.perf_counter()
        - float(state["current_round_started_at"]),
        "errors": errors,
    }


def _filter_invalid_adopted_cast_ids(
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
            current_intent_snapshot=next(
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


def _build_default_round_resolution_payload(
    state: SimulationWorkflowState,
    *,
    event_updates: list[dict[str, object]],
) -> dict[str, object]:
    adopted_cast_ids = [
        str(item.get("cast_id", ""))
        for item in list(state["pending_actor_proposals"])
        if str(item.get("cast_id", "")) in set(state["selected_cast_ids"])
        and not bool(item.get("forced_idle"))
        and isinstance(item.get("proposal", {}), dict)
        and item.get("proposal", {})
    ]
    current_intent_states = list(state["actor_intent_states"])
    if not current_intent_states:
        current_intent_states = [
            {
                "cast_id": str(actor.get("cast_id", "")),
                "current_intent": str(actor.get("private_goal", "")).strip()
                or "현재 상황을 더 관찰한다.",
                "thought": f"{str(actor.get('display_name', actor.get('cast_id', 'actor')))}는 아직 상대 반응을 더 확인해야 한다고 본다.",
                "target_cast_ids": [],
                "supporting_action_type": "initial_state",
                "confidence": 0.5,
                "changed_from_previous": False,
            }
            for actor in list(state["actors"])
        ]
    latest_activities = [
        cast(dict[str, object], item.get("proposal", {}))
        for item in list(state["pending_actor_proposals"])
        if str(item.get("cast_id", "")) in set(adopted_cast_ids)
        and isinstance(item.get("proposal", {}), dict)
    ]
    world_state_summary = str(
        state["world_state_summary"] or "현재 압력은 유지되고 있다."
    )
    return {
        "adopted_cast_ids": adopted_cast_ids[:2],
        "updated_intent_states": current_intent_states,
        "event_updates": event_updates,
        "round_time_advance": _default_round_time_advance(state),
        "observer_report": {
            "round_index": int(state["round_index"]),
            "summary": "직접 행동과 배경 압력을 기준으로 현재 단계를 정리했다.",
            "notable_events": [
                str(item.get("action_summary", "")).strip()
                for item in latest_activities[:2]
                if str(item.get("action_summary", "")).strip()
            ]
            or ["큰 변화 없이 현재 국면이 유지됐다."],
            "atmosphere": "긴장",
            "momentum": "medium",
            "world_state_summary": world_state_summary,
        },
        "actor_facing_scenario_digest": _default_actor_facing_scenario_digest(
            state=state,
            world_state_summary=world_state_summary,
            latest_activities=latest_activities,
        ),
        "world_state_summary": world_state_summary,
        "stop_reason": "",
    }


def _pending_proposals_as_activity_hints(
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
                "target_cast_ids": _string_list(proposal.get("target_cast_ids", [])),
                "action_type": str(proposal.get("action_type", "")).strip(),
                "action_summary": str(proposal.get("action_summary", "")).strip(),
                "action_detail": str(proposal.get("action_detail", "")).strip(),
                "utterance": str(proposal.get("utterance", "")).strip(),
                "intent": str(proposal.get("intent", "")).strip(),
            }
        )
    return hints


def _build_event_memory_history_entry(
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


def _default_actor_facing_scenario_digest(
    *,
    state: SimulationWorkflowState,
    world_state_summary: str,
    latest_activities: list[dict[str, object]],
) -> dict[str, object]:
    existing = cast(dict[str, object], state.get("actor_facing_scenario_digest", {}))
    event_memory = cast(dict[str, object], state.get("event_memory", {}))
    pending_event_views = [
        item
        for item in _dict_list(event_memory.get("events", []))
        if str(item.get("status", "")) not in {"completed", "missed"}
    ]
    talking_points = [
        str(item.get("action_summary", "")).strip()
        for item in latest_activities[:2]
        if str(item.get("action_summary", "")).strip()
    ] or _string_list(existing.get("talking_points", []))[:2]
    if not talking_points:
        talking_points = ["이번 단계에서 관계를 바꿀 한 문장을 더 분명하게 던진다."]
    current_pressures = _string_list(existing.get("current_pressures", []))[:3]
    if not current_pressures:
        current_pressures = [
            str(item.get("title", "")).strip()
            for item in pending_event_views[:2]
            if str(item.get("title", "")).strip()
        ]
    if not current_pressures:
        current_pressures = ["직전 반응 이후 다음 선택 압력이 유지되고 있다."]
    avoid_repetition_notes = _string_list(
        existing.get("avoid_repetition_notes", [])
    )[:2]
    if not avoid_repetition_notes:
        avoid_repetition_notes = ["이미 나온 감탄사나 모호한 호감 표현만 반복하지 않는다."]
    return {
        "round_index": int(state["round_index"]),
        "relationship_map_summary": str(
            existing.get("relationship_map_summary", world_state_summary)
        ).strip()
        or world_state_summary,
        "current_pressures": current_pressures,
        "talking_points": talking_points,
        "avoid_repetition_notes": avoid_repetition_notes,
        "recommended_tone": str(
            existing.get("recommended_tone", "상대를 읽되 의도를 분명하게 말하는 톤")
        ).strip()
        or "상대를 읽되 의도를 분명하게 말하는 톤",
        "world_state_summary": world_state_summary,
    }


def _default_round_time_advance(state: SimulationWorkflowState) -> dict[str, object]:
    plan = RuntimeProgressionPlan.model_validate(state["plan"]["progression_plan"])
    elapsed_unit = "minute" if "minute" in plan.allowed_elapsed_units else plan.default_elapsed_unit
    elapsed_amount = 30 if elapsed_unit == "minute" else 1
    return {
        "elapsed_unit": elapsed_unit,
        "elapsed_amount": elapsed_amount,
        "selection_reason": "이번 단계에는 큰 시간 점프보다 기본 진행 단위를 따른다.",
        "signals": ["기본 pacing 적용"],
    }


def _build_updated_clock(
    *,
    state: SimulationWorkflowState,
    round_time_advance: dict[str, object],
) -> dict[str, dict[str, object]]:
    previous_clock = cast(dict[str, object], state["simulation_clock"])
    elapsed_unit = str(round_time_advance["elapsed_unit"])
    elapsed_amount = int(str(round_time_advance["elapsed_amount"]))
    if elapsed_unit == "minute":
        elapsed_minutes = elapsed_amount
    elif elapsed_unit == "hour":
        elapsed_minutes = elapsed_amount * 60
    elif elapsed_unit == "day":
        elapsed_minutes = elapsed_amount * 60 * 24
    else:
        raise ValueError(f"지원하지 않는 elapsed_unit 입니다: {elapsed_unit}")

    total_elapsed_minutes = int(str(previous_clock.get("total_elapsed_minutes", 0))) + elapsed_minutes
    round_time_record = {
        "round_index": int(state["round_index"]),
        "elapsed_unit": elapsed_unit,
        "elapsed_amount": elapsed_amount,
        "elapsed_minutes": elapsed_minutes,
        "elapsed_label": _elapsed_label(elapsed_unit, elapsed_amount),
        "total_elapsed_minutes": total_elapsed_minutes,
        "total_elapsed_label": _minutes_label(total_elapsed_minutes),
        "selection_reason": str(round_time_advance["selection_reason"]),
        "signals": list(cast(list[object], round_time_advance.get("signals", []))),
    }
    clock = {
        "total_elapsed_minutes": total_elapsed_minutes,
        "total_elapsed_label": round_time_record["total_elapsed_label"],
        "last_elapsed_minutes": elapsed_minutes,
        "last_elapsed_label": round_time_record["elapsed_label"],
        "last_advanced_round_index": int(state["round_index"]),
    }
    return {
        "round_time_advance": cast(dict[str, object], round_time_record),
        "simulation_clock": cast(dict[str, object], clock),
    }


def _elapsed_label(unit: str, amount: int) -> str:
    if unit == "minute":
        return f"{amount}분"
    if unit == "hour":
        return f"{amount}시간"
    if unit == "day":
        return f"{amount}일"
    return f"{amount}{unit}"


def _minutes_label(total_elapsed_minutes: int) -> str:
    if total_elapsed_minutes < 60:
        return f"{total_elapsed_minutes}분"
    hours, minutes = divmod(total_elapsed_minutes, 60)
    if minutes == 0:
        return f"{hours}시간"
    return f"{hours}시간 {minutes}분"


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _dict_list(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, object], item) for item in value if isinstance(item, dict)]
