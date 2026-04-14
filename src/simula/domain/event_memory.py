"""Purpose:
- Provide pure helpers for planner-driven major-event memory.
"""

from __future__ import annotations

from collections import defaultdict
from typing import TypedDict, cast

from simula.domain.contracts import (
    EventMemory,
    MajorEventPlanItem,
    MajorEventState,
    MajorEventStatusType,
    MajorEventUpdate,
)

EVENT_GRACE_ROUNDS = 2


class EventEvaluationHints(TypedDict):
    """Code-first hints for round-level event matching."""

    suggested_updates: list[dict[str, object]]
    allowed_completed_event_ids: list[str]
    involved_event_ids: list[str]


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
    return _finalize_event_memory(events=events, current_round_index=0)


def refresh_event_memory(
    event_memory: dict[str, object],
    *,
    current_round_index: int,
) -> dict[str, object]:
    """Recompute derived event-memory summary fields for the current round."""

    events = _event_list(event_memory.get("events", []))
    return _finalize_event_memory(events=events, current_round_index=current_round_index)


def build_event_pressure_map(
    event_memory: dict[str, object],
    *,
    current_round_index: int,
) -> dict[str, dict[str, object]]:
    """Return per-actor event pressure derived from unresolved events."""

    refreshed = refresh_event_memory(event_memory, current_round_index=current_round_index)
    events = _event_list(refreshed.get("events", []))
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
        due = _int_value(event.get("earliest_round", 0)) <= current_round_index
        overdue = current_round_index > _int_value(event.get("latest_round", 0))
        required = bool(event.get("required_before_end", False))
        for cast_id in _string_list(event.get("participant_cast_ids", [])):
            bucket = pressure[cast_id]
            if overdue and required:
                bucket["required_overdue_count"] = _int_value(
                    bucket["required_overdue_count"]
                ) + 1
            elif overdue:
                bucket["optional_overdue_count"] = _int_value(
                    bucket["optional_overdue_count"]
                ) + 1
            elif due and required:
                bucket["required_due_count"] = _int_value(
                    bucket["required_due_count"]
                ) + 1
            elif due:
                bucket["optional_due_count"] = _int_value(
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
        for event in _event_list(event_memory.get("events", []))
        if bool(event.get("required_before_end", False))
        and str(event.get("status", "")) not in {"completed", "missed"}
    ]


def has_required_unresolved_events(event_memory: dict[str, object]) -> bool:
    """Return whether any required event remains unresolved."""

    return bool(required_event_ids_pending(event_memory))


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


def evaluate_round_event_updates(
    event_memory: dict[str, object],
    *,
    latest_round_activities: list[dict[str, object]],
    current_round_index: int,
) -> EventEvaluationHints:
    """Build code-first event matching hints from adopted round activities."""

    refreshed = refresh_event_memory(event_memory, current_round_index=current_round_index)
    events = _event_list(refreshed.get("events", []))
    suggestions: list[dict[str, object]] = []
    allowed_completed_event_ids: list[str] = []
    involved_event_ids: list[str] = []

    for event in events:
        status = str(event.get("status", ""))
        if status in {"completed", "missed"}:
            continue
        relevant = _matching_activities_for_event(event, latest_round_activities)
        if not relevant:
            continue
        involved_event_ids.append(str(event.get("event_id", "")))
        matched_activity_ids = [
            str(activity.get("activity_id", ""))
            for activity in relevant
            if str(activity.get("activity_id", "")).strip()
        ]
        if _is_strong_completion(event, relevant):
            allowed_completed_event_ids.append(str(event.get("event_id", "")))
            suggestions.append(
                MajorEventUpdate(
                    event_id=str(event.get("event_id", "")),
                    status="completed",
                    progress_summary=(
                        f"{str(event.get('title', '주요 이벤트'))} 단계가 이번 round에서 직접 실행됐다."
                    ),
                    matched_activity_ids=matched_activity_ids,
                ).model_dump(mode="json")
            )
            continue
        suggestions.append(
            MajorEventUpdate(
                event_id=str(event.get("event_id", "")),
                status="in_progress",
                progress_summary=(
                    f"{str(event.get('title', '주요 이벤트'))} 관련 움직임이 보였지만 아직 완결되지는 않았다."
                ),
                matched_activity_ids=matched_activity_ids,
            ).model_dump(mode="json")
        )

    return {
        "suggested_updates": suggestions,
        "allowed_completed_event_ids": allowed_completed_event_ids,
        "involved_event_ids": involved_event_ids,
    }


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
        for event in _event_list(event_memory.get("events", []))
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
        status = _status_value(raw_update.get("status", ""))
        if status is None:
            continue
        if status == "completed" and event_id not in allowed_completed:
            suggested = suggested_by_id.get(event_id)
            suggested_status = (
                _status_value(suggested.get("status", "in_progress"))
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
            for activity_id in _string_list(raw_update.get("matched_activity_ids", []))
            if activity_id in latest_activity_ids
        ]
        if not matched_activity_ids:
            suggested = suggested_by_id.get(event_id)
            matched_activity_ids = [
                activity_id
                for activity_id in _string_list(
                    suggested.get("matched_activity_ids", []) if suggested is not None else []
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
        for event in _event_list(previous_event_memory.get("events", []))
    }
    transition_updates: list[dict[str, object]] = []
    for event in _event_list(next_event_memory.get("events", [])):
        event_id = str(event.get("event_id", "")).strip()
        if not event_id:
            continue
        previous = previous_by_id.get(event_id, {})
        status_changed = str(previous.get("status", "")) != str(event.get("status", ""))
        progress_changed = str(previous.get("progress_summary", "")) != str(
            event.get("progress_summary", "")
        )
        matched_changed = _string_list(previous.get("matched_activity_ids", [])) != _string_list(
            event.get("matched_activity_ids", [])
        )
        if not (status_changed or progress_changed or matched_changed):
            continue
        transition_updates.append(
            MajorEventUpdate(
                event_id=event_id,
                status=_status_value(event.get("status", "")) or "pending",
                progress_summary=str(event.get("progress_summary", "")).strip()
                or "관련 진행 상황을 다시 정리한다.",
                matched_activity_ids=_string_list(event.get("matched_activity_ids", [])),
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

    events = _event_list(event_memory.get("events", []))
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
        next_events = _mark_unresolved_events_missed(
            next_events,
            current_round_index=current_round_index,
        )
    return _finalize_event_memory(events=next_events, current_round_index=current_round_index)


def _mark_unresolved_events_missed(
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


def _finalize_event_memory(
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
                _event_priority(item.model_dump(mode="json"), current_round_index),
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
        event.required_before_end and event.status not in {"completed", "missed"}
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


def _event_priority(event: dict[str, object], current_round_index: int) -> int:
    if str(event.get("status", "")) in {"completed", "missed"}:
        return -1
    if current_round_index > _int_value(event.get("latest_round", 0)):
        return 4
    if _int_value(event.get("earliest_round", 0)) <= current_round_index:
        return 3
    if _int_value(event.get("earliest_round", 0)) == current_round_index + 1:
        return 2
    return 1


def _matching_activities_for_event(
    event: dict[str, object],
    activities: list[dict[str, object]],
) -> list[dict[str, object]]:
    participant_ids = set(_string_list(event.get("participant_cast_ids", [])))
    action_types = set(_string_list(event.get("completion_action_types", [])))
    signals = _string_list(event.get("completion_signals", []))
    matched: list[dict[str, object]] = []
    for activity in activities:
        source_cast_id = str(activity.get("source_cast_id", "")).strip()
        target_cast_ids = set(_string_list(activity.get("target_cast_ids", [])))
        participants = {source_cast_id, *target_cast_ids}
        if participant_ids.isdisjoint(participants):
            continue
        activity_text = " ".join(
            [
                str(activity.get("action_summary", "")),
                str(activity.get("action_detail", "")),
                str(activity.get("utterance", "")),
                str(activity.get("intent", "")),
            ]
        )
        if str(activity.get("action_type", "")) in action_types or any(
            signal and signal in activity_text for signal in signals
        ):
            matched.append(activity)
    return matched


def _is_strong_completion(
    event: dict[str, object],
    activities: list[dict[str, object]],
) -> bool:
    participant_ids = set(_string_list(event.get("participant_cast_ids", [])))
    action_types = set(_string_list(event.get("completion_action_types", [])))
    covered_participants: set[str] = set()
    action_type_hit = False
    for activity in activities:
        source_cast_id = str(activity.get("source_cast_id", "")).strip()
        target_cast_ids = set(_string_list(activity.get("target_cast_ids", [])))
        participants = {source_cast_id, *target_cast_ids}
        covered_participants.update(participant_ids.intersection(participants))
        if str(activity.get("action_type", "")) in action_types:
            action_type_hit = True
    return action_type_hit and participant_ids.issubset(covered_participants)


def _event_list(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, object], item) for item in value if isinstance(item, dict)]


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def _int_value(value: object) -> int:
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return 0


def _status_value(value: object) -> MajorEventStatusType | None:
    text = str(value).strip()
    if text == "pending":
        return "pending"
    if text == "in_progress":
        return "in_progress"
    if text == "completed":
        return "completed"
    if text == "missed":
        return "missed"
    return None
