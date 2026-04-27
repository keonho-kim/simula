"""Runtime scene JSONL event helpers."""

from __future__ import annotations

from typing import Any, cast

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.shared.io.streaming import record_simulation_log_event


def record_scene_event(
    context: WorkflowRuntimeContext,
    event_type: str,
    state: SimulationWorkflowState,
    round_index: int,
    payload: dict[str, Any],
) -> None:
    record_simulation_log_event(
        context,
        {
            "event": event_type,
            "event_key": f"{event_type}:{round_index}",
            "run_id": str(state["run_id"]),
            "round_index": round_index,
            **payload,
        },
    )


def event_memory_prompt_view(
    event_memory: object,
    *,
    limit: int = 4,
) -> dict[str, Any]:
    if not isinstance(event_memory, dict):
        return {}
    event_memory_dict = cast(dict[str, Any], event_memory)
    events = _dict_list(event_memory_dict.get("events", []))
    ordered = sorted(
        events,
        key=lambda item: (
            1 if str(item.get("status", "")) in {"pending", "in_progress"} else 0,
            -_int_value(item.get("earliest_round", 0)),
            str(item.get("event_id", "")),
        ),
        reverse=True,
    )
    return {
        "next_event_ids": _string_list(event_memory_dict.get("next_event_ids", [])),
        "overdue_event_ids": _string_list(
            event_memory_dict.get("overdue_event_ids", [])
        ),
        "completed_event_ids": _string_list(
            event_memory_dict.get("completed_event_ids", [])
        ),
        "missed_event_ids": _string_list(
            event_memory_dict.get("missed_event_ids", [])
        ),
        "endgame_gate_open": bool(event_memory_dict.get("endgame_gate_open", False)),
        "events": [
            {
                "event_id": str(item.get("event_id", "")),
                "title": _truncate_text(item.get("title", ""), 60),
                "summary": _truncate_text(item.get("summary", ""), 120),
                "status": str(item.get("status", "")),
                "participant_cast_ids": _string_list(
                    item.get("participant_cast_ids", [])
                ),
                "earliest_round": _int_value(item.get("earliest_round", 0)),
                "latest_round": _int_value(item.get("latest_round", 0)),
                "must_resolve": bool(item.get("must_resolve", False)),
                "progress_summary": _truncate_text(
                    item.get("progress_summary", ""),
                    100,
                ),
            }
            for item in ordered[:limit]
        ],
    }


def _dict_list(value: object) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, Any], item) for item in value if isinstance(item, dict)]


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item).strip()]


def _int_value(value: object) -> int:
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return 0


def _truncate_text(value: object, limit: int) -> str:
    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"
