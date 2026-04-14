"""Purpose:
- Decide whether the runtime loop should continue into the next round.
"""

from __future__ import annotations

import json
from typing import cast

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
from simula.application.workflow.utils.streaming import emit_custom_event
from simula.application.workflow.utils.prompt_projections import build_event_memory_prompt_view
from simula.application.workflow.utils.prompt_projections import (
    ACTION_SUMMARY_LIMIT,
    PREVIOUS_SUMMARY_LIMIT,
    WORLD_STATE_SUMMARY_LIMIT,
    truncate_text,
)
from simula.domain.contracts import RoundContinuationDecision
from simula.domain.event_memory import (
    apply_event_updates,
    build_transition_event_updates,
    hard_stop_round,
    has_required_unresolved_events,
    refresh_event_memory,
)
from simula.domain.log_events import build_round_event_memory_updated_event


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

    planned_max_rounds = int(state.get("planned_max_rounds", state["max_rounds"]))
    refreshed_event_memory = refresh_event_memory(
        dict(state.get("event_memory", {})),
        current_round_index=round_index,
    )
    required_unresolved_events = has_required_unresolved_events(refreshed_event_memory)
    hard_stop = hard_stop_round(
        configured_max_rounds=int(state["max_rounds"]),
        planned_max_rounds=planned_max_rounds,
    )
    if round_index >= hard_stop:
        finalized_event_memory = apply_event_updates(
            refreshed_event_memory,
            event_updates=[],
            current_round_index=round_index,
            finalize_unresolved_as_missed=True,
        )
        transition_updates = build_transition_event_updates(
            refreshed_event_memory,
            finalized_event_memory,
        )
        history_entry = _build_event_memory_history_entry(
            round_index=round_index,
            source="continuation_hard_stop",
            event_updates=transition_updates,
            event_memory=finalized_event_memory,
            requested_stop_reason="simulation_done",
            effective_stop_reason="simulation_done",
        )
        emit_custom_event(
            build_round_event_memory_updated_event(
                run_id=str(state.get("run_id", "")),
                round_index=round_index,
                source=str(history_entry["source"]),
                event_updates=_dict_list(history_entry.get("event_updates", [])),
                event_memory_summary=cast(
                    dict[str, object], history_entry["event_memory_summary"]
                ),
                stop_context=cast(dict[str, object], history_entry["stop_context"]),
            )
        )
        runtime.context.logger.info(
            "round %s continuation skipped | stop=%s",
            round_index,
            "simulation_done",
        )
        return {
            "stop_requested": True,
            "stop_reason": "simulation_done",
            "event_memory": finalized_event_memory,
            "event_memory_history": list(state.get("event_memory_history", []))
            + [history_entry],
        }
    if round_index >= planned_max_rounds and not required_unresolved_events:
        runtime.context.logger.info(
            "round %s continuation skipped | stop=simulation_done | planned_max=%s",
            round_index,
            planned_max_rounds,
        )
        return {
            "stop_requested": True,
            "stop_reason": "simulation_done",
            "event_memory": refreshed_event_memory,
        }
    if round_index >= planned_max_rounds and required_unresolved_events:
        runtime.context.logger.info(
            "round %s continuation forced | unresolved required events remain",
            round_index,
        )
        return {
            "stop_requested": False,
            "stop_reason": "",
            "event_memory": refreshed_event_memory,
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
        event_memory_json=json.dumps(
            build_event_memory_prompt_view(refreshed_event_memory),
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
    if stop_reason == "no_progress" and required_unresolved_events:
        stop_reason = ""
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
        "event_memory": refreshed_event_memory,
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


def _dict_list(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, object], item) for item in value if isinstance(item, dict)]


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
