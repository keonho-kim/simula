"""목적:
- actor별 가시 activity feed 상태 갱신 규칙을 제공한다.

설명:
- unseen/seen 조회, target 필터링, visibility 계산, activity 적재를 순수 함수로 분리한다.

사용한 설계 패턴:
- 순수 상태 전이 함수 패턴

연관된 다른 모듈/구조:
- simula.application.workflow.graphs.runtime.nodes
"""

from __future__ import annotations

from copy import deepcopy


def initialize_activity_feeds(
    actors: list[dict[str, object]],
) -> dict[str, dict[str, object]]:
    """actor 목록으로 빈 activity feed를 만든다."""

    return {
        str(actor["actor_id"]): {
            "actor_id": str(actor["actor_id"]),
            "unseen_activity_ids": [],
            "seen_activity_ids": [],
        }
        for actor in actors
    }


def list_unseen_activities(
    activity_feeds: dict[str, dict[str, object]],
    actor_id: str,
    activities: list[dict[str, object]],
) -> list[dict[str, object]]:
    """actor가 현재 unseen feed에서 읽을 activity 목록을 조회한다."""

    feed = activity_feeds.get(actor_id)
    if feed is None:
        return []
    unseen_ids = _string_list(feed.get("unseen_activity_ids", []))
    activity_index = {str(activity["activity_id"]): activity for activity in activities}
    return [
        activity_index[activity_id]
        for activity_id in unseen_ids
        if activity_id in activity_index
    ]


def list_recent_visible_activities(
    activity_feeds: dict[str, dict[str, object]],
    actor_id: str,
    activities: list[dict[str, object]],
    *,
    limit: int = 5,
) -> list[dict[str, object]]:
    """actor가 최근에 볼 수 있는 activity 최대 limit개를 반환한다."""

    feed = activity_feeds.get(actor_id)
    if feed is None:
        return []

    visible_ids = _string_list(feed.get("seen_activity_ids", [])) + _string_list(
        feed.get("unseen_activity_ids", [])
    )
    visible_id_set = set(visible_ids)
    recent_visible = [
        activity
        for activity in activities
        if str(activity.get("activity_id", "")) in visible_id_set
    ]
    return recent_visible[-limit:]


def sanitize_targets(
    requested_target_ids: list[str],
    *,
    source_actor_id: str,
    actors: list[dict[str, object]],
    visibility: str,
    max_targets: int,
) -> list[str]:
    """유효한 target 목록만 남긴다."""

    all_actor_ids = [
        str(actor["actor_id"])
        for actor in actors
        if str(actor["actor_id"]) != source_actor_id
    ]
    valid_actor_ids = set(all_actor_ids)
    ordered_unique: list[str] = []
    for actor_id in requested_target_ids:
        if actor_id in valid_actor_ids and actor_id not in ordered_unique:
            ordered_unique.append(actor_id)

    return ordered_unique[:max_targets]


def build_visibility_scope(
    source_actor_id: str,
    target_actor_ids: list[str],
    visibility: str,
) -> list[str]:
    """visibility별 scope를 만든다."""

    if visibility == "public":
        return ["all"]

    scope = [source_actor_id]
    for actor_id in target_actor_ids:
        if actor_id not in scope:
            scope.append(actor_id)
    return scope


def route_activity(
    activity_feeds: dict[str, dict[str, object]],
    activity: dict[str, object],
) -> dict[str, dict[str, object]]:
    """activity를 visibility에 맞춰 feed에 적재한다."""

    updated_feeds = deepcopy(activity_feeds)
    activity_id = str(activity["activity_id"])
    source_actor_id = str(activity.get("source_actor_id", ""))

    visibility_scope = _string_list(activity.get("visibility_scope", []))
    if "all" in visibility_scope:
        target_actor_ids = list(updated_feeds)
    else:
        target_actor_ids = visibility_scope

    for actor_id in target_actor_ids:
        feed = updated_feeds.get(actor_id)
        if feed is None:
            continue

        if actor_id == source_actor_id:
            seen_ids = _string_list(feed.get("seen_activity_ids", []))
            if activity_id not in seen_ids:
                seen_ids.append(activity_id)
            feed["seen_activity_ids"] = seen_ids
            continue

        unseen_ids = _string_list(feed.get("unseen_activity_ids", []))
        if activity_id not in unseen_ids:
            unseen_ids.append(activity_id)
        feed["unseen_activity_ids"] = unseen_ids

    return updated_feeds


def mark_seen_activities(
    activity_feeds: dict[str, dict[str, object]],
    actor_id: str,
    unseen_activity_ids: list[str],
) -> None:
    """actor가 읽은 unseen activity를 seen으로 옮긴다."""

    if actor_id not in activity_feeds:
        return

    feed = dict(activity_feeds[actor_id])
    remaining_unseen = _string_list(feed.get("unseen_activity_ids", []))
    seen_ids = _string_list(feed.get("seen_activity_ids", []))
    for activity_id in unseen_activity_ids:
        if activity_id in remaining_unseen:
            remaining_unseen.remove(activity_id)
        if activity_id not in seen_ids:
            seen_ids.append(activity_id)
    feed["unseen_activity_ids"] = remaining_unseen
    feed["seen_activity_ids"] = seen_ids
    activity_feeds[actor_id] = feed


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]
