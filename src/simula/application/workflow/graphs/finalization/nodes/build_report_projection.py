"""목적:
- 최종 보고서용 정제 projection을 만든다.

설명:
- raw simulation log를 바로 넘기지 않고, 타임라인/행위자/최종 상태 요약을 정리한다.

사용한 설계 패턴:
- projection builder 패턴
"""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import cast

from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.application.workflow.utils.prompt_projections import truncate_text


def build_report_projection(
    state: SimulationWorkflowState,
) -> dict[str, object]:
    """최종 보고서 프롬프트에 넣을 projection JSON을 만든다."""

    activities = sorted(
        _dict_list(state.get("activities", [])),
        key=lambda item: (
            _int_value(item.get("round_index", 0)),
            str(item.get("created_at", "")),
            str(item.get("activity_id", "")),
        ),
    )
    observer_reports = {
        _int_value(report.get("round_index", 0)): report
        for report in _dict_list(state.get("observer_reports", []))
    }
    actors = _dict_list(state.get("actors", []))
    actors_by_id = {str(actor["cast_id"]): actor for actor in actors}
    total_rounds = max(1, _int_value(state.get("round_index", 0)))
    round_time_history = {
        _int_value(item.get("round_index", 0)): item
        for item in _dict_list(state.get("round_time_history", []))
    }
    round_focus_history = {
        _int_value(item.get("round_index", 0)): item
        for item in _dict_list(state.get("round_focus_history", []))
    }
    background_updates_by_round: dict[int, list[dict[str, object]]] = defaultdict(list)
    for item in _dict_list(state.get("background_updates", [])):
        background_updates_by_round[_int_value(item.get("round_index", 0))].append(item)
    anchor = datetime.fromisoformat(
        str(_dict_value(state.get("report_timeline_anchor_json")).get("anchor_iso"))
    )

    timeline_packets: list[dict[str, object]] = []
    round_indexes = sorted(
        {_int_value(activity.get("round_index", 0)) for activity in activities}
        | set(observer_reports.keys())
    )
    for round_index in round_indexes:
        round_activities = [
            activity
            for activity in activities
            if _int_value(activity.get("round_index", 0)) == round_index
        ]
        report = observer_reports.get(round_index, {})
        round_time = round_time_history.get(round_index, {})
        focus_plan = round_focus_history.get(round_index, {})
        timeline_packets.append(
            {
                "round_index": round_index,
                "time_label": format_report_time_label(
                    anchor=anchor,
                    total_elapsed_minutes=_int_value(
                        round_time.get("total_elapsed_minutes", 0)
                    ),
                ),
                "round_elapsed_label": str(round_time.get("elapsed_label", "0분")),
                "cumulative_elapsed_label": str(
                    round_time.get("total_elapsed_label", "0분")
                ),
                "phase_hint": phase_hint(
                    round_index=round_index,
                    total_rounds=total_rounds,
                ),
                "focus_summary": str(focus_plan.get("focus_summary", "")),
                "selected_cast_ids": _string_list(
                    focus_plan.get("selected_cast_ids", [])
                ),
                "observer_summary": str(report.get("summary", "")),
                "notable_events": _string_list(report.get("notable_events")),
                "background_updates": background_updates_by_round.get(round_index, []),
                "action_clusters": cluster_round_activities(
                    round_activities=round_activities,
                    actors_by_id=actors_by_id,
                ),
            }
        )

    actor_digests = build_actor_digests(
        actors=actors,
        activities=activities,
        actors_by_id=actors_by_id,
        total_rounds=total_rounds,
    )
    endgame_packets = timeline_packets[-min(5, len(timeline_packets)) :]
    final_actor_snapshots = build_final_actor_snapshots(
        actors=actors,
        activities=activities,
        actors_by_id=actors_by_id,
        timeline_packets=timeline_packets,
        total_rounds=total_rounds,
    )
    final_report = _dict_value(state.get("final_report"))
    projection = {
        "summary_context": {
            "timeline_anchor": _dict_value(state.get("report_timeline_anchor_json")),
            "objective": truncate_text(final_report.get("objective", ""), 180),
            "world_state_summary": truncate_text(
                state.get("world_state_summary", ""),
                220,
            ),
            "elapsed_simulation_label": str(
                _dict_value(state.get("simulation_clock", {})).get(
                    "total_elapsed_label",
                    "0분",
                )
            ),
            "rounds_completed": total_rounds,
            "total_actions": len(activities),
            "last_observer_summary": truncate_text(
                final_report.get("last_observer_summary", ""),
                220,
            ),
            "notable_events": [
                truncate_text(item, 120)
                for item in _string_list(final_report.get("notable_events"))
            ][:5],
            "visibility_action_counts": dict(
                Counter(str(activity.get("visibility", "")) for activity in activities)
            ),
        },
        "timeline_highlights": [
            {
                "round_index": _int_value(packet.get("round_index", 0)),
                "time_label": str(packet.get("time_label", "")),
                "phase_hint": str(packet.get("phase_hint", "")),
                "focus_summary": truncate_text(packet.get("focus_summary", ""), 90),
                "observer_summary": truncate_text(
                    packet.get("observer_summary", ""),
                    160,
                ),
                "notable_events": [
                    truncate_text(item, 100)
                    for item in _string_list(packet.get("notable_events"))
                ][:2],
                "action_highlights": [
                    truncate_text(item.get("summary", ""), 100)
                    for item in _dict_list(packet.get("action_clusters", []))[:2]
                ],
            }
            for packet in timeline_packets[-6:]
        ],
        "relationship_outcomes": [
            {
                "display_name": str(snapshot.get("display_name", "")),
                "last_seen_time_label": str(snapshot.get("last_seen_time_label", "")),
                "strongest_endgame_counterparty": str(
                    snapshot.get("strongest_endgame_counterparty", "")
                ),
                "endgame_sent_to": _string_list(snapshot.get("endgame_sent_to"))[:2],
                "endgame_received_from": _string_list(
                    snapshot.get("endgame_received_from")
                )[:2],
                "latest_action_summary": truncate_text(
                    snapshot.get("latest_action_summary", ""),
                    100,
                ),
                "latest_received_summary": truncate_text(
                    snapshot.get("latest_received_summary", ""),
                    100,
                ),
            }
            for snapshot in sorted(
                final_actor_snapshots,
                key=lambda item: (
                    0
                    if str(item.get("strongest_endgame_counterparty", "")).strip()
                    else 1,
                    str(item.get("display_name", "")),
                ),
            )[:5]
        ],
        "major_event_outcomes": [
            {
                "event_id": str(item.get("event_id", "")),
                "title": truncate_text(item.get("title", ""), 80),
                "status": str(item.get("status", "")),
                "required_before_end": bool(item.get("required_before_end", False)),
                "progress_summary": truncate_text(
                    item.get("progress_summary", ""),
                    120,
                ),
                "completed_round": _int_value(item.get("completed_round", 0)),
            }
            for item in _dict_list(
                _dict_value(state.get("event_memory", {})).get("events", [])
            )[:5]
        ],
        "final_outcome_clues": [
            truncate_text(item, 120)
            for item in build_final_outcome_clues(
                endgame_packets=endgame_packets,
                final_actor_snapshots=final_actor_snapshots,
            )[:8]
        ],
        "active_lead_candidates": [
            {
                "display_name": str(digest.get("display_name", "")),
                "interaction_count": _int_value(digest.get("interaction_count", 0)),
                "strongest_counterparty": str(
                    digest.get("strongest_counterparty", "")
                ),
            }
            for digest in actor_digests[:4]
        ],
    }
    return {
        "report_projection_json": json.dumps(
            projection,
            ensure_ascii=False,
            separators=(",", ":"),
        )
    }


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
                str(activity.get("action_summary", "")),
                str(activity.get("source_cast_id") or ""),
            )
        cluster = grouped.setdefault(
            cluster_key,
            {
                "thread_id": activity.get("thread_id"),
                "action_type": activity.get("action_type"),
                "visibility": activity.get("visibility"),
                "summary": str(activity.get("action_summary", "")),
                "source_actors": [],
                "target_actors": [],
                "activity_count": 0,
            },
        )
        cluster["activity_count"] = _int_value(cluster.get("activity_count", 0)) + 1
        source_name = display_name_of(
            cast_id=str(activity.get("source_cast_id", "")),
            actors_by_id=actors_by_id,
        )
        source_actors = cast(list[str], cluster["source_actors"])
        if source_name not in source_actors:
            source_actors.append(source_name)
        for cast_id in _string_list(activity.get("target_cast_ids")):
            target_name = display_name_of(
                cast_id=str(cast_id),
                actors_by_id=actors_by_id,
            )
            target_actors = cast(list[str], cluster["target_actors"])
            if target_name not in target_actors:
                target_actors.append(target_name)

    clusters = sorted(
        grouped.values(),
        key=_cluster_sort_key,
        reverse=True,
    )
    return clusters[:5]


def build_actor_digests(
    *,
    actors: list[dict[str, object]],
    activities: list[dict[str, object]],
    actors_by_id: dict[str, dict[str, object]],
    total_rounds: int,
) -> list[dict[str, object]]:
    """행위자별 핵심 상호작용 digest를 만든다."""

    received_by_actor: dict[str, list[dict[str, object]]] = defaultdict(list)
    initiated_by_actor: dict[str, list[dict[str, object]]] = defaultdict(list)
    for activity in activities:
        source_cast_id = str(activity.get("source_cast_id", ""))
        initiated_by_actor[source_cast_id].append(activity)
        for target_cast_id in _string_list(activity.get("target_cast_ids")):
            received_by_actor[str(target_cast_id)].append(activity)

    digests = []
    endgame_start_round = max(1, total_rounds - 4)
    for actor in actors:
        actor_id = str(actor["cast_id"])
        display_name = str(actor["display_name"])
        initiated = initiated_by_actor.get(actor_id, [])
        received = received_by_actor.get(actor_id, [])
        endgame_initiated = [
            item
            for item in initiated
            if _int_value(item.get("round_index", 0)) >= endgame_start_round
        ]
        endgame_received = [
            item
            for item in received
            if _int_value(item.get("round_index", 0)) >= endgame_start_round
        ]
        counterparties: list[str] = []
        for activity in initiated + received:
            names = [
                display_name_of(
                    cast_id=str(target_actor_id),
                    actors_by_id=actors_by_id,
                )
                for target_actor_id in _string_list(activity.get("target_cast_ids"))
            ]
            source_name = display_name_of(
                cast_id=str(activity.get("source_cast_id", "")),
                actors_by_id=actors_by_id,
            )
            counterparties.extend(name for name in names if name != display_name)
            if source_name != display_name:
                counterparties.append(source_name)
        deduped_counterparties: list[str] = []
        for name in counterparties:
            if name and name not in deduped_counterparties:
                deduped_counterparties.append(name)

        digests.append(
            {
                "cast_id": actor_id,
                "display_name": display_name,
                "interaction_count": len(initiated) + len(received),
                "initiated_count": len(initiated),
                "received_count": len(received),
                "visibility_counts": dict(
                    Counter(str(item.get("visibility", "")) for item in initiated)
                ),
                "counterparties": deduped_counterparties[:6],
                "latest_initiated_summaries": [
                    str(item.get("action_summary", "")) for item in initiated[-3:]
                ],
                "latest_received_summaries": [
                    str(item.get("action_summary", "")) for item in received[-3:]
                ],
                "late_focus_targets": unique_display_names(
                    activities=endgame_initiated,
                    actors_by_id=actors_by_id,
                    field_name="target_cast_ids",
                ),
                "late_focus_from": unique_source_names(
                    activities=endgame_received,
                    actors_by_id=actors_by_id,
                    exclude_name=display_name,
                ),
                "strongest_counterparty": most_common_counterparty(
                    actor_name=display_name,
                    activities=initiated + received,
                    actors_by_id=actors_by_id,
                ),
            }
        )

    return sorted(
        digests,
        key=lambda item: (-int(item["interaction_count"]), str(item["display_name"])),
    )


def build_final_actor_snapshots(
    *,
    actors: list[dict[str, object]],
    activities: list[dict[str, object]],
    actors_by_id: dict[str, dict[str, object]],
    timeline_packets: list[dict[str, object]],
    total_rounds: int,
) -> list[dict[str, object]]:
    """최종 국면 해석에 집중한 행위자 snapshot을 만든다."""

    round_to_time_label = {
        _int_value(packet.get("round_index", 0)): str(packet.get("time_label", ""))
        for packet in timeline_packets
    }
    endgame_start_round = max(1, total_rounds - 4)
    snapshots = []
    for actor in actors:
        actor_id = str(actor["cast_id"])
        display_name = str(actor["display_name"])
        related_activities = [
            item
            for item in activities
            if str(item.get("source_cast_id", "")) == actor_id
            or actor_id in _string_list(item.get("target_cast_ids"))
        ]
        endgame_activities = [
            item
            for item in related_activities
            if _int_value(item.get("round_index", 0)) >= endgame_start_round
        ]
        if related_activities:
            last_seen_round = max(
                _int_value(item.get("round_index", 0)) for item in related_activities
            )
        else:
            last_seen_round = 0
        snapshots.append(
            {
                "cast_id": actor_id,
                "display_name": display_name,
                "last_seen_round": last_seen_round,
                "last_seen_time_label": round_to_time_label.get(last_seen_round, ""),
                "endgame_sent_to": unique_display_names(
                    activities=[
                        item
                        for item in endgame_activities
                        if str(item.get("source_cast_id", "")) == actor_id
                    ],
                    actors_by_id=actors_by_id,
                    field_name="target_cast_ids",
                ),
                "endgame_received_from": unique_source_names(
                    activities=[
                        item
                        for item in endgame_activities
                        if actor_id in _string_list(item.get("target_cast_ids"))
                    ],
                    actors_by_id=actors_by_id,
                    exclude_name=display_name,
                ),
                "strongest_endgame_counterparty": most_common_counterparty(
                    actor_name=display_name,
                    activities=endgame_activities,
                    actors_by_id=actors_by_id,
                ),
                "latest_action_summary": latest_summary_for_actor(
                    actor_id=actor_id,
                    activities=related_activities,
                    mode="sent",
                ),
                "latest_received_summary": latest_summary_for_actor(
                    actor_id=actor_id,
                    activities=related_activities,
                    mode="received",
                ),
            }
        )
    return snapshots


def build_final_outcome_clues(
    *,
    endgame_packets: list[dict[str, object]],
    final_actor_snapshots: list[dict[str, object]],
) -> list[str]:
    """최종 결과를 읽기 쉽게 추론할 수 있는 단서를 만든다."""

    clues: list[str] = []
    for packet in endgame_packets[-3:]:
        observer_summary = str(packet.get("observer_summary", "")).strip()
        if observer_summary:
            clues.append(f"{packet['time_label']} 시점 요약: {observer_summary}")
        for event in _string_list(packet.get("notable_events"))[:2]:
            clues.append(f"{packet['time_label']} 주요 사건: {event}")

    for snapshot in final_actor_snapshots:
        strongest = str(snapshot.get("strongest_endgame_counterparty", "")).strip()
        if strongest:
            clues.append(
                f"{snapshot['display_name']}는 마지막에 {strongest}와 가장 많이 반응을 주고받았다."
            )
        sent_to = _string_list(snapshot.get("endgame_sent_to"))
        if len(sent_to) == 1:
            clues.append(
                f"{snapshot['display_name']}는 마지막에 {sent_to[0]}에게 가장 많이 반응했다."
            )
        received_from = _string_list(snapshot.get("endgame_received_from"))
        if len(received_from) == 1:
            clues.append(
                f"{snapshot['display_name']}는 마지막에 {received_from[0]}의 반응을 가장 많이 받았다."
            )

    deduped_clues: list[str] = []
    for clue in clues:
        if clue and clue not in deduped_clues:
            deduped_clues.append(clue)
    return deduped_clues[:12]


def display_name_of(
    *,
    cast_id: str,
    actors_by_id: dict[str, dict[str, object]],
) -> str:
    """actor id를 표시명으로 변환한다."""

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
    """활동 목록에서 대상 표시명을 중복 없이 추출한다."""

    names: list[str] = []
    for activity in activities:
        for actor_id in _string_list(activity.get(field_name)):
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
    """활동 목록에서 발신자 표시명을 중복 없이 추출한다."""

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
    """행위자가 가장 자주 얽힌 상대를 반환한다."""

    counter = Counter[str]()
    for activity in activities:
        source_name = display_name_of(
            cast_id=str(activity.get("source_cast_id", "")),
            actors_by_id=actors_by_id,
        )
        if source_name and source_name != actor_name:
            counter[source_name] += 1
        for target_actor_id in _string_list(activity.get("target_cast_ids")):
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
    """행위자의 마지막 발신/수신 요약을 반환한다."""

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
            if actor_id in _string_list(item.get("target_cast_ids"))
        ]
    if not filtered:
        return ""
    return str(filtered[-1].get("action_summary", ""))


def build_intent_arc_packets(
    *,
    intent_history: list[dict[str, object]],
    actors_by_id: dict[str, dict[str, object]],
) -> list[dict[str, object]]:
    """step별 intent 변화를 보고서 projection용 패킷으로 정리한다."""

    packets: list[dict[str, object]] = []
    for entry in intent_history:
        snapshots = _dict_list(entry.get("actor_intent_states", []))
        packets.append(
            {
                "round_index": _int_value(entry.get("round_index", 0)),
                "actor_intents": [
                    {
                        "cast_id": str(snapshot.get("cast_id", "")),
                        "display_name": display_name_of(
                            cast_id=str(snapshot.get("cast_id", "")),
                            actors_by_id=actors_by_id,
                        ),
                        "current_intent": str(snapshot.get("current_intent", "")),
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


def _cluster_sort_key(cluster: dict[str, object]) -> tuple[int, int]:
    visibility_weight = {
        "public": 3,
        "group": 2,
        "private": 1,
    }.get(str(cluster.get("visibility", "")), 0)
    return visibility_weight, _int_value(cluster.get("activity_count", 0))


def _dict_list(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, object], item) for item in value if isinstance(item, dict)]


def _dict_value(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        return {}
    return cast(dict[str, object], value)


def _int_value(value: object) -> int:
    return int(str(value))


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]
