"""Shared compact projection helpers for workflow prompts."""

from __future__ import annotations

from collections import Counter
from typing import cast

ACTOR_VISIBLE_ACTOR_LIMIT = 6
ACTOR_ACTION_CONTEXT_LIMIT = 6
ACTOR_AVAILABLE_ACTION_LIMIT = 5
GENERATION_ACTION_LIMIT = 5
DEFERRED_ACTOR_LIMIT = 8
INTENT_STATE_LIMIT = 10
WORLD_STATE_SUMMARY_LIMIT = 220
PREVIOUS_SUMMARY_LIMIT = 160
LAST_FOCUS_SUMMARY_LIMIT = 120
ACTION_SUMMARY_LIMIT = 120
ACTION_DETAIL_LIMIT = 180
UTTERANCE_LIMIT = 120
EXPECTED_OUTCOME_LIMIT = 120
SHORT_GUIDANCE_LIMIT = 80
SHORT_DESCRIPTION_LIMIT = 100


def truncate_text(value: object, limit: int) -> str:
    """긴 텍스트를 prompt 예산에 맞게 줄인다."""

    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def compact_actor_reference(actor: dict[str, object]) -> dict[str, object]:
    return {
        "cast_id": str(actor.get("cast_id", "")),
        "display_name": str(actor.get("display_name", "")),
        "role": truncate_text(actor.get("role", ""), 100),
        "group_name": actor.get("group_name"),
        "baseline_attention_tier": str(actor.get("baseline_attention_tier", "")),
        "story_function": truncate_text(actor.get("story_function", ""), 120),
    }


def compact_action_digest(activity: dict[str, object]) -> dict[str, object]:
    return {
        "activity_id": str(activity.get("activity_id", "")),
        "round_index": int_value(activity.get("round_index", 0)),
        "source_cast_id": str(activity.get("source_cast_id", "")),
        "target_cast_ids": string_list(activity.get("target_cast_ids", [])),
        "visibility": str(activity.get("visibility", "")),
        "action_type": str(activity.get("action_type", "")),
        "summary": truncate_text(
            activity.get("summary", ""),
            ACTION_SUMMARY_LIMIT,
        ),
        "utterance": optional_truncated_text(
            activity.get("utterance"),
            UTTERANCE_LIMIT,
        ),
        "thread_id": optional_string(activity.get("thread_id")),
    }


def compact_channel_guidance(value: object) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    return {
        str(key): truncate_text(item, SHORT_DESCRIPTION_LIMIT)
        for key, item in value.items()
    }


def compact_intent_snapshot(snapshot: object) -> dict[str, object]:
    if not isinstance(snapshot, dict):
        return {}
    dumped = cast(dict[str, object], snapshot)
    return {
        "cast_id": str(dumped.get("cast_id", "")),
        "goal": truncate_text(dumped.get("goal", ""), 140),
        "target_cast_ids": string_list(dumped.get("target_cast_ids", [])),
        "confidence": dumped.get("confidence"),
        "changed_from_previous": bool(dumped.get("changed_from_previous", False)),
    }


def compact_actor_facing_scenario_digest(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        return {}
    dumped = cast(dict[str, object], value)
    return {
        "current_pressures": truncate_string_list(
            dumped.get("current_pressures", []),
            limit=3,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
        "next_step_notes": truncate_string_list(
            dumped.get("next_step_notes", []),
            limit=3,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
        "world_state_summary": truncate_text(
            dumped.get("world_state_summary", ""),
            WORLD_STATE_SUMMARY_LIMIT,
        ),
    }


def compact_action_option(action: dict[str, object]) -> dict[str, object]:
    label = truncate_text(action.get("label", ""), 40)
    description = truncate_text(action.get("description", ""), SHORT_DESCRIPTION_LIMIT)
    usage_hint = label
    if description:
        usage_hint = f"{label}: {description}" if label else description
    return {
        "action_type": str(action.get("action_type", "")),
        "supported_visibility": string_list(action.get("supported_visibility", [])),
        "requires_target": bool(action.get("requires_target", False)),
        "usage_hint": usage_hint,
    }


def compact_action_catalog_entry(action: dict[str, object]) -> dict[str, object]:
    return {
        "action_type": str(action.get("action_type", "")),
        "label": truncate_text(action.get("label", ""), 40),
        "description": truncate_text(
            action.get("description", ""),
            SHORT_DESCRIPTION_LIMIT,
        ),
        "supported_visibility": string_list(action.get("supported_visibility", [])),
        "requires_target": bool(action.get("requires_target", False)),
    }


def compact_action_proposal_for_prompt(proposal: object) -> dict[str, object]:
    if not isinstance(proposal, dict):
        return {}
    dumped = cast(dict[str, object], proposal)
    return {
        "action_type": str(dumped.get("action_type", "")),
        "goal": truncate_text(dumped.get("goal", ""), 140),
        "summary": truncate_text(
            dumped.get("summary", ""),
            ACTION_SUMMARY_LIMIT,
        ),
        "detail": truncate_text(
            dumped.get("detail", ""),
            ACTION_DETAIL_LIMIT,
        ),
        "utterance": optional_truncated_text(dumped.get("utterance"), UTTERANCE_LIMIT),
        "visibility": str(dumped.get("visibility", "")),
        "target_cast_ids": string_list(dumped.get("target_cast_ids", [])),
    }


def action_related_actor_ids(
    *,
    visible_action_context: list[dict[str, object]],
    cast_id: str,
) -> list[str]:
    ordered_ids: list[str] = []
    for action in visible_action_context:
        source_cast_id = str(action.get("source_cast_id", ""))
        if (
            source_cast_id
            and source_cast_id != cast_id
            and source_cast_id not in ordered_ids
        ):
            ordered_ids.append(source_cast_id)
        for target_cast_id in string_list(action.get("target_cast_ids", [])):
            if target_cast_id == cast_id or target_cast_id in ordered_ids:
                continue
            ordered_ids.append(target_cast_id)
    return ordered_ids


def dedupe_activities(
    activities: list[dict[str, object]],
) -> list[dict[str, object]]:
    seen: set[str] = set()
    deduped: list[dict[str, object]] = []
    for activity in activities:
        key = activity_key(activity)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(activity)
    return deduped


def activity_key(activity: dict[str, object]) -> str:
    activity_id = str(activity.get("activity_id", "")).strip()
    if activity_id:
        return activity_id
    return "|".join(
        [
            str(activity.get("round_index", "")),
            str(activity.get("source_cast_id", "")),
            str(activity.get("action_type", "")),
            str(activity.get("thread_id", "")),
        ]
    )


def top_counter_values(counter: Counter[str], *, limit: int = 3) -> list[str]:
    return [item for item, _ in counter.most_common(limit)]


def truncate_string_list(
    value: object,
    *,
    limit: int,
    text_limit: int,
) -> list[str]:
    return [truncate_text(item, text_limit) for item in string_list(value)[:limit]]


def optional_string(value: object) -> str:
    return str(value or "").strip()


def optional_truncated_text(value: object, limit: int) -> str:
    text = str(value or "").strip()
    return truncate_text(text, limit) if text else ""


def int_value(value: object) -> int:
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return 0


def dict_list(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, object], item) for item in value if isinstance(item, dict)]


def object_list(value: object) -> list[object]:
    if not isinstance(value, list):
        return []
    return list(value)


def string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item).strip()]
