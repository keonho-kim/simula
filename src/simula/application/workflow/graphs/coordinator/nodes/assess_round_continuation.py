"""Purpose:
- Decide whether the runtime loop should continue into the next round.
"""

from __future__ import annotations

import json

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.coordinator.output_schema.bundles import (
    build_round_continuation_prompt_bundle,
)
from simula.application.workflow.graphs.coordinator.prompts.round_continuation_prompt import (
    PROMPT as ROUND_CONTINUATION_PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.application.workflow.utils.prompt_projections import (
    ACTION_SUMMARY_LIMIT,
    PREVIOUS_SUMMARY_LIMIT,
    WORLD_STATE_SUMMARY_LIMIT,
    truncate_text,
)
from simula.domain.contracts import RoundContinuationDecision
from simula.domain.reporting import evaluate_stop


async def assess_round_continuation(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Determine whether the runtime loop should stop before the next round."""

    round_index = int(state["round_index"])
    if round_index == 0:
        return {
            "stop_requested": False,
            "stop_reason": "",
        }

    deterministic_stop_reason = evaluate_stop(
        round_index=round_index,
        max_rounds=int(state["max_rounds"]),
    )
    if deterministic_stop_reason:
        runtime.context.logger.info(
            "round %s continuation skipped | stop=%s",
            round_index,
            deterministic_stop_reason,
        )
        return {
            "stop_requested": True,
            "stop_reason": deterministic_stop_reason,
        }

    prompt = ROUND_CONTINUATION_PROMPT.format(
        round_index=round_index,
        max_rounds=int(state["max_rounds"]),
        stagnation_rounds=int(state["stagnation_rounds"]),
        simulation_clock_json=json.dumps(
            state.get("simulation_clock", {}),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        world_state_summary=truncate_text(
            state.get("world_state_summary", ""),
            WORLD_STATE_SUMMARY_LIMIT,
        ),
        latest_observer_report_json=json.dumps(
            _build_latest_observer_report_view(list(state.get("observer_reports", []))),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        recent_observer_reports_json=json.dumps(
            _build_recent_observer_reports_view(list(state.get("observer_reports", []))),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        latest_round_activities_json=json.dumps(
            _build_latest_round_activities_view(
                list(state.get("latest_round_activities", []))
            ),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        latest_round_focus_json=json.dumps(
            _build_latest_round_focus_view(list(state.get("round_focus_history", []))),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        **build_round_continuation_prompt_bundle(),
    )
    decision, meta = await runtime.context.llms.ainvoke_structured_with_meta(
        "coordinator",
        prompt,
        RoundContinuationDecision,
        allow_default_on_failure=True,
        default_payload={"stop_reason": ""},
        log_context={
            "scope": "round-continuation",
            "round_index": round_index,
        },
    )
    stop_reason = decision.stop_reason
    runtime.context.logger.info(
        "round %s continuation assessed | stop=%s | stagnation=%s",
        round_index,
        stop_reason or "-",
        int(state["stagnation_rounds"]),
    )
    errors = list(state["errors"])
    if meta.forced_default:
        errors.append(f"round {round_index} continuation defaulted")
    return {
        "stop_requested": bool(stop_reason),
        "stop_reason": stop_reason,
        "errors": errors,
    }


def _build_latest_observer_report_view(
    observer_reports: list[dict[str, object]],
) -> dict[str, object]:
    if not observer_reports:
        return {}
    latest = observer_reports[-1]
    return {
        "round_index": int(str(latest.get("round_index", 0))),
        "summary": truncate_text(latest.get("summary", ""), PREVIOUS_SUMMARY_LIMIT),
        "momentum": str(latest.get("momentum", "")),
        "atmosphere": str(latest.get("atmosphere", "")),
        "world_state_summary": truncate_text(
            latest.get("world_state_summary", ""),
            WORLD_STATE_SUMMARY_LIMIT,
        ),
    }


def _build_recent_observer_reports_view(
    observer_reports: list[dict[str, object]],
) -> list[dict[str, object]]:
    return [
        {
            "round_index": int(str(item.get("round_index", 0))),
            "summary": truncate_text(item.get("summary", ""), PREVIOUS_SUMMARY_LIMIT),
            "momentum": str(item.get("momentum", "")),
            "world_state_summary": truncate_text(
                item.get("world_state_summary", ""),
                WORLD_STATE_SUMMARY_LIMIT,
            ),
        }
        for item in observer_reports[-3:]
    ]


def _build_latest_round_activities_view(
    latest_round_activities: list[dict[str, object]],
) -> list[dict[str, object]]:
    return [
        {
            "source_cast_id": str(item.get("source_cast_id", "")),
            "target_cast_ids": _string_list(item.get("target_cast_ids", [])),
            "visibility": str(item.get("visibility", "")),
            "action_type": str(item.get("action_type", "")),
            "action_summary": truncate_text(
                item.get("action_summary", ""),
                ACTION_SUMMARY_LIMIT,
            ),
        }
        for item in latest_round_activities[:4]
    ]


def _build_latest_round_focus_view(
    round_focus_history: list[dict[str, object]],
) -> dict[str, object]:
    if not round_focus_history:
        return {}
    latest = round_focus_history[-1]
    return {
        "round_index": int(str(latest.get("round_index", 0))),
        "focus_summary": truncate_text(latest.get("focus_summary", ""), 120),
        "selection_reason": truncate_text(latest.get("selection_reason", ""), 120),
        "selected_cast_ids": _string_list(latest.get("selected_cast_ids", [])),
        "deferred_cast_ids": _string_list(latest.get("deferred_cast_ids", [])),
    }


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]
