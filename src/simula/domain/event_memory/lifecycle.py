"""Lifecycle helpers for event-memory state."""

from __future__ import annotations

from collections import defaultdict
from typing import cast

from simula.domain.contracts import EventMemory, MajorEventPlanItem, MajorEventState
from simula.domain.event_memory.shared import (
    EVENT_GRACE_ROUNDS,
    event_list,
    event_priority,
    int_value,
    string_list,
)


def build_event_memory(major_events: list[dict[str, object]]) -> dict[str, object]:
    """Build the initial runtime event memory from planner output."""

    events = []
    for raw_event in major_events:
        plan_item = MajorEventPlanItem.model_validate(raw_event)
        events.append(
            MajorEventState(
                **plan_item.model_dump(mode="json"),
                status="pending",
                progress_summary="아직 직접적인 진행 징후가 드러나지 않았다.",
                matched_activity_ids=[],
                last_evaluated_round=0,
                completed_round=0,
            ).model_dump(mode="json")
        )
    return finalize_event_memory(events=events, current_round_index=0)


def refresh_event_memory(
    event_memory: dict[str, object],
    *,
    current_round_index: int,
) -> dict[str, object]:
    """Recompute derived event-memory summary fields for the current round."""

    events = event_list(event_memory.get("events", []))
    return finalize_event_memory(events=events, current_round_index=current_round_index)


def build_event_pressure_map(
    event_memory: dict[str, object],
    *,
    current_round_index: int,
) -> dict[str, dict[str, object]]:
    """Return per-actor event pressure derived from unresolved events."""

    refreshed = refresh_event_memory(event_memory, current_round_index=current_round_index)
    events = event_list(refreshed.get("events", []))
    pressure: dict[str, dict[str, object]] = defaultdict(
        lambda: {
            "required_due_count": 0,
            "required_overdue_count": 0,
            "optional_due_count": 0,
            "optional_overdue_count": 0,
            "event_titles": [],
        }
    )
    for event in events:
        status = str(event.get("status", ""))
        if status in {"completed", "missed"}:
            continue
        due = int_value(event.get("earliest_round", 0)) <= current_round_index
        overdue = current_round_index > int_value(event.get("latest_round", 0))
        required = bool(event.get("must_resolve", False))
        for cast_id in string_list(event.get("participant_cast_ids", [])):
            bucket = pressure[cast_id]
            if overdue and required:
                bucket["required_overdue_count"] = int_value(
                    bucket["required_overdue_count"]
                ) + 1
            elif overdue:
                bucket["optional_overdue_count"] = int_value(
                    bucket["optional_overdue_count"]
                ) + 1
            elif due and required:
                bucket["required_due_count"] = int_value(
                    bucket["required_due_count"]
                ) + 1
            elif due:
                bucket["optional_due_count"] = int_value(
                    bucket["optional_due_count"]
                ) + 1
            event_titles = cast(list[str], bucket["event_titles"])
            title = str(event.get("title", "")).strip()
            if title and title not in event_titles:
                event_titles.append(title)
    return dict(pressure)


def required_event_ids_pending(event_memory: dict[str, object]) -> list[str]:
    """Return unresolved required event ids."""

    return [
        str(event.get("event_id", ""))
        for event in event_list(event_memory.get("events", []))
        if bool(event.get("must_resolve", False))
        and str(event.get("status", "")) not in {"completed", "missed"}
    ]


def has_required_unresolved_events(event_memory: dict[str, object]) -> bool:
    """Return whether any required event remains unresolved."""

    return bool(required_event_ids_pending(event_memory))


def should_stop_for_stale_required_events(
    event_memory: dict[str, object],
    *,
    current_round_index: int,
    stagnation_rounds: int,
) -> bool:
    """Return whether overdue required events have gone stale enough to stop early."""

    if stagnation_rounds < 2:
        return False

    refreshed = refresh_event_memory(event_memory, current_round_index=current_round_index)
    unresolved_required_events = [
        event
        for event in event_list(refreshed.get("events", []))
        if bool(event.get("must_resolve", False))
        and str(event.get("status", "")) not in {"completed", "missed"}
    ]
    if not unresolved_required_events:
        return False

    return all(
        current_round_index > int_value(event.get("latest_round", 0))
        and not string_list(event.get("matched_activity_ids", []))
        for event in unresolved_required_events
    )


def hard_stop_round(
    *,
    configured_max_rounds: int,
    planned_max_rounds: int,
    grace_rounds: int = EVENT_GRACE_ROUNDS,
) -> int:
    """Return the absolute hard-stop round after applying the grace buffer."""

    safe_planned = max(1, planned_max_rounds)
    safe_configured = max(1, configured_max_rounds)
    return min(safe_configured, safe_planned + max(0, grace_rounds))


def finalize_event_memory(
    *,
    events: list[dict[str, object]],
    current_round_index: int,
) -> dict[str, object]:
    validated = [MajorEventState.model_validate(event) for event in events]
    next_event_ids = [
        event.event_id
        for event in sorted(
            validated,
            key=lambda item: (
                event_priority(item.model_dump(mode="json"), current_round_index),
                -item.earliest_round,
                item.event_id,
            ),
            reverse=True,
        )
        if event.status not in {"completed", "missed"}
    ][:3]
    overdue_event_ids = [
        event.event_id
        for event in validated
        if event.status not in {"completed", "missed"}
        and current_round_index > event.latest_round
    ]
    completed_event_ids = [
        event.event_id for event in validated if event.status == "completed"
    ]
    missed_event_ids = [event.event_id for event in validated if event.status == "missed"]
    endgame_gate_open = any(
        event.must_resolve and event.status not in {"completed", "missed"}
        for event in validated
    )
    return EventMemory(
        events=[event.model_dump(mode="json") for event in validated],
        next_event_ids=next_event_ids,
        overdue_event_ids=overdue_event_ids,
        completed_event_ids=completed_event_ids,
        missed_event_ids=missed_event_ids,
        endgame_gate_open=endgame_gate_open,
    ).model_dump(mode="json")
