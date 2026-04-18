"""Shared helpers for event-memory computations."""

from __future__ import annotations

import re
from typing import TypedDict, cast

from simula.domain.contracts import MajorEventStatusType

EVENT_GRACE_ROUNDS = 2


class EventEvaluationHints(TypedDict):
    """Code-first hints for round-level event matching."""

    suggested_updates: list[dict[str, object]]
    allowed_completed_event_ids: list[str]
    involved_event_ids: list[str]


def event_priority(event: dict[str, object], current_round_index: int) -> int:
    if str(event.get("status", "")) in {"completed", "missed"}:
        return -1
    if current_round_index > int_value(event.get("latest_round", 0)):
        return 4
    if int_value(event.get("earliest_round", 0)) <= current_round_index:
        return 3
    if int_value(event.get("earliest_round", 0)) == current_round_index + 1:
        return 2
    return 1


def activity_text(activity: dict[str, object]) -> str:
    return " ".join(
        [
            str(activity.get("summary", "")),
            str(activity.get("detail", "")),
            str(activity.get("utterance", "")),
            str(activity.get("goal", "")),
        ]
    )


def signal_matches(signal: str, activity_text_value: str) -> bool:
    normalized_signal = normalize_match_text(signal)
    normalized_activity_text = normalize_match_text(activity_text_value)
    if not normalized_signal or not normalized_activity_text:
        return False
    return normalized_signal in normalized_activity_text


def action_type_matches(
    *,
    activity_action_type: str,
    completion_action_types: list[str],
) -> bool:
    normalized_activity_type = normalize_action_type(activity_action_type)
    normalized_completion_types = {
        normalize_action_type(action_type)
        for action_type in completion_action_types
        if normalize_action_type(action_type)
    }
    return normalized_activity_type in normalized_completion_types


def normalize_action_type(action_type: str) -> str:
    lowered = action_type.strip().lower()
    if not lowered:
        return ""
    if any(token in lowered for token in ("date", "outing", "walk")):
        return "date"
    if any(
        token in lowered
        for token in ("confide", "confession", "private_confide", "heart_to_heart")
    ):
        return "private_confession"
    if any(token in lowered for token in ("choice", "choose", "selection", "select")):
        return "choice"
    if any(
        token in lowered
        for token in (
            "conversation",
            "dialogue",
            "discussion",
            "speech",
            "statement",
            "talk",
            "question",
            "answer",
        )
    ):
        return "conversation"
    return lowered


def normalize_match_text(text: str) -> str:
    collapsed = re.sub(r"\s+", "", text).lower()
    return re.sub(r"[^\w가-힣]", "", collapsed)


def event_list(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, object], item) for item in value if isinstance(item, dict)]


def string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item).strip() for item in value if str(item).strip()]


def int_value(value: object) -> int:
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return 0


def status_value(value: object) -> MajorEventStatusType | None:
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
