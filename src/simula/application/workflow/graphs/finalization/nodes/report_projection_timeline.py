"""Timeline-oriented report projection helpers."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import cast

from simula.application.workflow.graphs.finalization.nodes.report_projection_helpers import (
    cluster_sort_key,
    dict_list,
    display_name_of,
    int_value,
    string_list,
)


def format_report_time_label(
    *,
    anchor: datetime,
    total_elapsed_minutes: int,
) -> str:
    """round에 대응하는 절대시각 라벨을 만든다."""

    delta = timedelta(minutes=total_elapsed_minutes)
    return (anchor + delta).strftime("%Y-%m-%d %H:%M")


def phase_hint(*, round_index: int, total_rounds: int) -> str:
    """round 위치를 사람이 읽는 쉬운 단계명으로 변환한다."""

    if total_rounds <= 1:
        return "단일 단계"
    if round_index == 1:
        return "시작 단계"
    if round_index == total_rounds:
        return "마무리 단계"
    if round_index >= total_rounds - 1:
        return "관계 변화 단계"
    return "탐색 단계"


def cluster_round_activities(
    *,
    round_activities: list[dict[str, object]],
    actors_by_id: dict[str, dict[str, object]],
) -> list[dict[str, object]]:
    """한 round의 activity를 대표 사건 cluster로 압축한다."""

    grouped: dict[tuple[str, str], dict[str, object]] = {}
    for activity in round_activities:
        cluster_key = (
            str(activity.get("thread_id") or ""),
            str(activity.get("source_cast_id") or ""),
        )
        if not cluster_key[0]:
            cluster_key = (
                str(activity.get("summary", "")),
                str(activity.get("source_cast_id") or ""),
            )
        cluster = grouped.setdefault(
            cluster_key,
            {
                "thread_id": activity.get("thread_id"),
                "action_type": activity.get("action_type"),
                "visibility": activity.get("visibility"),
                "summary": str(activity.get("summary", "")),
                "source_actors": [],
                "target_actors": [],
                "activity_count": 0,
            },
        )
        cluster["activity_count"] = int_value(cluster.get("activity_count", 0)) + 1
        source_name = display_name_of(
            cast_id=str(activity.get("source_cast_id", "")),
            actors_by_id=actors_by_id,
        )
        source_actors = cast(list[str], cluster["source_actors"])
        if source_name not in source_actors:
            source_actors.append(source_name)
        for cast_id in string_list(activity.get("target_cast_ids")):
            target_name = display_name_of(
                cast_id=str(cast_id),
                actors_by_id=actors_by_id,
            )
            target_actors = cast(list[str], cluster["target_actors"])
            if target_name not in target_actors:
                target_actors.append(target_name)

    clusters = sorted(grouped.values(), key=cluster_sort_key, reverse=True)
    return clusters[:5]


def build_intent_arc_packets(
    *,
    intent_history: list[dict[str, object]],
    actors_by_id: dict[str, dict[str, object]],
) -> list[dict[str, object]]:
    """step별 intent 변화를 보고서 projection용 패킷으로 정리한다."""

    packets: list[dict[str, object]] = []
    for entry in intent_history:
        snapshots = dict_list(entry.get("actor_intent_states", []))
        packets.append(
            {
                "round_index": int_value(entry.get("round_index", 0)),
                "actor_intents": [
                    {
                        "cast_id": str(snapshot.get("cast_id", "")),
                        "display_name": display_name_of(
                            cast_id=str(snapshot.get("cast_id", "")),
                            actors_by_id=actors_by_id,
                        ),
                        "goal": str(snapshot.get("goal", "")),
                        "supporting_action_type": str(
                            snapshot.get("supporting_action_type", "")
                        ),
                        "changed_from_previous": bool(
                            snapshot.get("changed_from_previous", False)
                        ),
                    }
                    for snapshot in snapshots
                ],
            }
        )
    return packets
