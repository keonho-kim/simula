"""Matching helpers between round activities and event-memory entries."""

from __future__ import annotations

from simula.domain.contracts import MajorEventUpdate
from simula.domain.event_memory.lifecycle import refresh_event_memory
from simula.domain.event_memory.shared import (
    EventEvaluationHints,
    action_type_matches,
    activity_text,
    event_list,
    signal_matches,
    string_list,
)


def evaluate_round_event_updates(
    event_memory: dict[str, object],
    *,
    latest_round_activities: list[dict[str, object]],
    current_round_index: int,
) -> EventEvaluationHints:
    """Build code-first event matching hints from adopted round activities."""

    refreshed = refresh_event_memory(event_memory, current_round_index=current_round_index)
    events = event_list(refreshed.get("events", []))
    suggestions: list[dict[str, object]] = []
    allowed_completed_event_ids: list[str] = []
    involved_event_ids: list[str] = []

    for event in events:
        status = str(event.get("status", ""))
        if status in {"completed", "missed"}:
            continue
        relevant = matching_activities_for_event(event, latest_round_activities)
        if not relevant:
            continue
        involved_event_ids.append(str(event.get("event_id", "")))
        matched_activity_ids = [
            str(activity.get("activity_id", ""))
            for activity in relevant
            if str(activity.get("activity_id", "")).strip()
        ]
        if is_strong_completion(event, relevant):
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


def matching_activities_for_event(
    event: dict[str, object],
    activities: list[dict[str, object]],
) -> list[dict[str, object]]:
    participant_ids = set(string_list(event.get("participant_cast_ids", [])))
    action_types = string_list(event.get("completion_action_types", []))
    signals = string_list(event.get("completion_signals", []))
    matched: list[dict[str, object]] = []
    for activity in activities:
        source_cast_id = str(activity.get("source_cast_id", "")).strip()
        target_cast_ids = set(string_list(activity.get("target_cast_ids", [])))
        participants = {source_cast_id, *target_cast_ids}
        if participant_ids.isdisjoint(participants):
            continue
        activity_text_value = activity_text(activity)
        if action_type_matches(
            activity_action_type=str(activity.get("action_type", "")),
            completion_action_types=action_types,
        ) or any(signal_matches(signal, activity_text_value) for signal in signals):
            matched.append(activity)
    return matched


def is_strong_completion(
    event: dict[str, object],
    activities: list[dict[str, object]],
) -> bool:
    participant_ids = set(string_list(event.get("participant_cast_ids", [])))
    action_types = string_list(event.get("completion_action_types", []))
    signals = string_list(event.get("completion_signals", []))
    covered_participants: set[str] = set()
    completion_signal_hit = False
    matched_action_hit = False
    for activity in activities:
        source_cast_id = str(activity.get("source_cast_id", "")).strip()
        target_cast_ids = set(string_list(activity.get("target_cast_ids", [])))
        participants = {source_cast_id, *target_cast_ids}
        covered_participants.update(participant_ids.intersection(participants))
        if action_type_matches(
            activity_action_type=str(activity.get("action_type", "")),
            completion_action_types=action_types,
        ):
            matched_action_hit = True
        if any(signal_matches(signal, activity_text(activity)) for signal in signals):
            completion_signal_hit = True
    return (matched_action_hit or completion_signal_hit) and participant_ids.issubset(
        covered_participants
    )
