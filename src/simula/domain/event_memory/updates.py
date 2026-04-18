"""Update application and sanitization helpers for event memory."""

from __future__ import annotations

from simula.domain.contracts import MajorEventState, MajorEventUpdate
from simula.domain.event_memory.lifecycle import finalize_event_memory
from simula.domain.event_memory.shared import (
    EventEvaluationHints,
    event_list,
    status_value,
    string_list,
)


def sanitize_event_updates(
    event_memory: dict[str, object],
    *,
    proposed_updates: list[dict[str, object]],
    latest_round_activities: list[dict[str, object]],
    evaluation_hints: EventEvaluationHints,
) -> list[dict[str, object]]:
    """Clamp resolver-proposed event updates to event ids and activity evidence."""

    events_by_id = {
        str(event.get("event_id", "")): event
        for event in event_list(event_memory.get("events", []))
    }
    latest_activity_ids = {
        str(activity.get("activity_id", ""))
        for activity in latest_round_activities
        if str(activity.get("activity_id", "")).strip()
    }
    suggested_by_id = {
        str(item["event_id"]): item for item in evaluation_hints["suggested_updates"]
    }
    allowed_completed = set(evaluation_hints["allowed_completed_event_ids"])
    sanitized: list[dict[str, object]] = []

    for raw_update in proposed_updates:
        event_id = str(raw_update.get("event_id", "")).strip()
        event = events_by_id.get(event_id)
        if event is None:
            continue
        current_status = str(event.get("status", ""))
        if current_status in {"completed", "missed"}:
            continue
        status = status_value(raw_update.get("status", ""))
        if status is None:
            continue
        if status == "completed" and event_id not in allowed_completed:
            suggested = suggested_by_id.get(event_id)
            suggested_status = (
                status_value(suggested.get("status", "in_progress"))
                if suggested is not None
                else None
            )
            status = suggested_status or "in_progress"

        progress_summary = str(raw_update.get("progress_summary", "")).strip()
        if not progress_summary:
            suggested = suggested_by_id.get(event_id)
            progress_summary = str(
                (
                    suggested.get("progress_summary", event.get("progress_summary", ""))
                    if suggested is not None
                    else event.get("progress_summary", "")
                )
            ).strip()
        if not progress_summary:
            progress_summary = "관련 진행 상황을 다시 정리한다."

        matched_activity_ids = [
            activity_id
            for activity_id in string_list(raw_update.get("matched_activity_ids", []))
            if activity_id in latest_activity_ids
        ]
        if not matched_activity_ids:
            suggested = suggested_by_id.get(event_id)
            matched_activity_ids = [
                activity_id
                for activity_id in string_list(
                    suggested.get("matched_activity_ids", [])
                    if suggested is not None
                    else []
                )
                if activity_id in latest_activity_ids
            ]

        sanitized.append(
            MajorEventUpdate(
                event_id=event_id,
                status=status,
                progress_summary=progress_summary,
                matched_activity_ids=matched_activity_ids,
            ).model_dump(mode="json")
        )

    seen_ids: set[str] = set()
    deduped: list[dict[str, object]] = []
    for item in sanitized:
        event_id = str(item.get("event_id", ""))
        if event_id in seen_ids:
            continue
        seen_ids.add(event_id)
        deduped.append(item)
    for suggested in evaluation_hints["suggested_updates"]:
        event_id = str(suggested.get("event_id", "")).strip()
        if not event_id or event_id in seen_ids:
            continue
        deduped.append(suggested)
        seen_ids.add(event_id)
    return deduped


def build_transition_event_updates(
    previous_event_memory: dict[str, object],
    next_event_memory: dict[str, object],
) -> list[dict[str, object]]:
    """Build updates that describe state transitions between two event memories."""

    previous_by_id = {
        str(event.get("event_id", "")): event
        for event in event_list(previous_event_memory.get("events", []))
    }
    transition_updates: list[dict[str, object]] = []
    for event in event_list(next_event_memory.get("events", [])):
        event_id = str(event.get("event_id", "")).strip()
        if not event_id:
            continue
        previous = previous_by_id.get(event_id, {})
        status_changed = str(previous.get("status", "")) != str(event.get("status", ""))
        progress_changed = str(previous.get("progress_summary", "")) != str(
            event.get("progress_summary", "")
        )
        matched_changed = string_list(previous.get("matched_activity_ids", [])) != string_list(
            event.get("matched_activity_ids", [])
        )
        if not (status_changed or progress_changed or matched_changed):
            continue
        transition_updates.append(
            MajorEventUpdate(
                event_id=event_id,
                status=status_value(event.get("status", "")) or "pending",
                progress_summary=str(event.get("progress_summary", "")).strip()
                or "관련 진행 상황을 다시 정리한다.",
                matched_activity_ids=string_list(event.get("matched_activity_ids", [])),
            ).model_dump(mode="json")
        )
    return transition_updates


def apply_event_updates(
    event_memory: dict[str, object],
    *,
    event_updates: list[dict[str, object]],
    current_round_index: int,
    finalize_unresolved_as_missed: bool = False,
) -> dict[str, object]:
    """Apply sanitized event updates and rebuild derived summary fields."""

    events = event_list(event_memory.get("events", []))
    updates_by_id = {
        item.event_id: item
        for item in (
            MajorEventUpdate.model_validate(raw_update) for raw_update in event_updates
        )
    }
    next_events: list[dict[str, object]] = []
    for raw_event in events:
        event = MajorEventState.model_validate(raw_event)
        update = updates_by_id.get(event.event_id)
        if update is not None:
            matched_activity_ids = list(event.matched_activity_ids)
            for activity_id in update.matched_activity_ids:
                if activity_id not in matched_activity_ids:
                    matched_activity_ids.append(activity_id)
            completed_round = event.completed_round
            if update.status == "completed":
                completed_round = current_round_index
            next_events.append(
                event.model_copy(
                    update={
                        "status": update.status,
                        "progress_summary": update.progress_summary,
                        "matched_activity_ids": matched_activity_ids,
                        "last_evaluated_round": current_round_index,
                        "completed_round": completed_round,
                    }
                ).model_dump(mode="json")
            )
            continue
        next_events.append(
            event.model_copy(
                update={"last_evaluated_round": current_round_index}
            ).model_dump(mode="json")
        )

    if finalize_unresolved_as_missed:
        next_events = mark_unresolved_events_missed(
            next_events,
            current_round_index=current_round_index,
        )
    return finalize_event_memory(events=next_events, current_round_index=current_round_index)


def mark_unresolved_events_missed(
    events: list[dict[str, object]],
    *,
    current_round_index: int,
) -> list[dict[str, object]]:
    missed_events: list[dict[str, object]] = []
    for raw_event in events:
        event = MajorEventState.model_validate(raw_event)
        if event.status in {"completed", "missed"}:
            missed_events.append(event.model_dump(mode="json"))
            continue
        missed_events.append(
            event.model_copy(
                update={
                    "status": "missed",
                    "progress_summary": f"{event.title} 단계는 종료 전까지 완결되지 못했다.",
                    "last_evaluated_round": current_round_index,
                }
            ).model_dump(mode="json")
        )
    return missed_events
