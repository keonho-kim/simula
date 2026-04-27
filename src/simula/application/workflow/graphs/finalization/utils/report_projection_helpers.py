"""Shared helper functions for report projections."""

from __future__ import annotations

from collections import Counter
from typing import cast


def display_name_of(
    *,
    cast_id: str,
    actors_by_id: dict[str, dict[str, object]],
) -> str:
    actor = actors_by_id.get(cast_id)
    if actor is None:
        return cast_id
    return str(actor.get("display_name", cast_id))


def unique_display_names(
    *,
    activities: list[dict[str, object]],
    actors_by_id: dict[str, dict[str, object]],
    field_name: str,
) -> list[str]:
    names: list[str] = []
    for activity in activities:
        for actor_id in string_list(activity.get(field_name)):
            display_name = display_name_of(
                cast_id=str(actor_id),
                actors_by_id=actors_by_id,
            )
            if display_name and display_name not in names:
                names.append(display_name)
    return names


def unique_source_names(
    *,
    activities: list[dict[str, object]],
    actors_by_id: dict[str, dict[str, object]],
    exclude_name: str,
) -> list[str]:
    names: list[str] = []
    for activity in activities:
        source_name = display_name_of(
            cast_id=str(activity.get("source_cast_id", "")),
            actors_by_id=actors_by_id,
        )
        if source_name and source_name != exclude_name and source_name not in names:
            names.append(source_name)
    return names


def most_common_counterparty(
    *,
    actor_name: str,
    activities: list[dict[str, object]],
    actors_by_id: dict[str, dict[str, object]],
) -> str:
    counter = Counter[str]()
    for activity in activities:
        source_name = display_name_of(
            cast_id=str(activity.get("source_cast_id", "")),
            actors_by_id=actors_by_id,
        )
        if source_name and source_name != actor_name:
            counter[source_name] += 1
        for target_actor_id in string_list(activity.get("target_cast_ids")):
            target_name = display_name_of(
                cast_id=str(target_actor_id),
                actors_by_id=actors_by_id,
            )
            if target_name and target_name != actor_name:
                counter[target_name] += 1
    if not counter:
        return ""
    return counter.most_common(1)[0][0]


def latest_summary_for_actor(
    *,
    actor_id: str,
    activities: list[dict[str, object]],
    mode: str,
) -> str:
    if mode == "sent":
        filtered = [
            item
            for item in activities
            if str(item.get("source_cast_id", "")) == actor_id
        ]
    else:
        filtered = [
            item
            for item in activities
            if actor_id in string_list(item.get("target_cast_ids"))
        ]
    if not filtered:
        return ""
    return str(filtered[-1].get("summary", ""))


def cluster_sort_key(cluster: dict[str, object]) -> tuple[int, int]:
    visibility_weight = {
        "public": 3,
        "group": 2,
        "private": 1,
    }.get(str(cluster.get("visibility", "")), 0)
    return visibility_weight, int_value(cluster.get("activity_count", 0))


def dict_list(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, object], item) for item in value if isinstance(item, dict)]


def dict_value(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        return {}
    return cast(dict[str, object], value)


def int_value(value: object) -> int:
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return 0


def string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]


def truncate_text(value: object, limit: int) -> str:
    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"
