"""Purpose:
- Resolve one runtime round in a single required bundle.
"""

from __future__ import annotations

import json
import time
from typing import cast

from langgraph.runtime import Runtime
from langgraph.types import Overwrite

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.coordinator.output_schema.bundles import (
    build_round_resolution_prompt_bundle,
)
from simula.application.workflow.graphs.coordinator.prompts.round_resolution_prompt import (
    PROMPT as STEP_RESOLUTION_PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.application.workflow.utils.prompt_projections import (
    WORLD_STATE_SUMMARY_LIMIT,
    build_compact_background_updates,
    build_compact_pending_actor_proposals,
    build_progression_plan_prompt_view,
    build_relevant_intent_states,
    build_visible_action_context,
    truncate_text,
)
from simula.domain.contracts import RoundResolution, RuntimeProgressionPlan
from simula.domain.reporting import evaluate_stop
from simula.domain.runtime_policy import next_stagnation_steps
from simula.domain.runtime_actions import (
    ActorProposalPayload,
    apply_adopted_actor_proposals,
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
    relevant_actor_ids = [
        *list(state["selected_actor_ids"]),
        *[
            str(item.get("actor_id", ""))
            for item in latest_background_updates
            if str(item.get("actor_id", "")).strip()
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
                relevant_actor_ids=relevant_actor_ids,
            ),
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
        world_state_summary=truncate_text(
            state["world_state_summary"],
            WORLD_STATE_SUMMARY_LIMIT,
        ),
        **build_round_resolution_prompt_bundle(),
    )
    default_payload = _build_default_round_resolution_payload(state)
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
        adopted_actor_ids=list(resolution.adopted_actor_ids),
        max_targets_per_activity=runtime.context.settings.runtime.max_recipients_per_message,
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
    should_stop, policy_reason = evaluate_stop(
        round_index=int(state["round_index"]),
        max_rounds=int(state["max_rounds"]),
        stagnation_rounds=stagnation_rounds,
        last_momentum=resolution.observer_report.momentum,
    )
    stop_reason = resolution.stop_reason.strip() or (policy_reason or "")
    stop_requested = bool(stop_reason) or should_stop
    runtime.context.logger.info(
        "round %s 해소 완료 | adopted=%s background=%s stop=%s",
        state["round_index"],
        len(list(resolution.adopted_actor_ids)),
        len(latest_background_updates),
        stop_reason or "-",
    )
    runtime.context.store.save_round_artifacts(
        state["run_id"],
        activities=list(applied["latest_round_activities"]),
        observer_report=report_payload,
    )
    errors = list(state["errors"])
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


def _build_default_round_resolution_payload(
    state: SimulationWorkflowState,
) -> dict[str, object]:
    adopted_actor_ids = [
        str(item.get("actor_id", ""))
        for item in list(state["pending_actor_proposals"])
        if str(item.get("actor_id", "")) in set(state["selected_actor_ids"])
        and not bool(item.get("forced_idle"))
        and isinstance(item.get("proposal", {}), dict)
        and item.get("proposal", {})
    ]
    current_intent_states = list(state["actor_intent_states"])
    if not current_intent_states:
        current_intent_states = [
            {
                "actor_id": str(actor.get("actor_id", "")),
                "current_intent": str(actor.get("private_goal", "")).strip()
                or "현재 상황을 더 관찰한다.",
                "target_actor_ids": [],
                "supporting_action_type": "initial_state",
                "confidence": 0.5,
                "changed_from_previous": False,
            }
            for actor in list(state["actors"])
        ]
    latest_activities = [
        cast(dict[str, object], item.get("proposal", {}))
        for item in list(state["pending_actor_proposals"])
        if str(item.get("actor_id", "")) in set(adopted_actor_ids)
        and isinstance(item.get("proposal", {}), dict)
    ]
    return {
        "adopted_actor_ids": adopted_actor_ids[:2],
        "updated_intent_states": current_intent_states,
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
            "world_state_summary": str(
                state["world_state_summary"] or "현재 압력은 유지되고 있다."
            ),
        },
        "world_state_summary": str(
            state["world_state_summary"] or "현재 압력은 유지되고 있다."
        ),
        "stop_reason": "",
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
