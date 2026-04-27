"""Actor and endgame report projection helpers."""

from __future__ import annotations

from collections import Counter, defaultdict

from simula.application.workflow.graphs.finalization.utils.report_projection_helpers import (
    display_name_of,
    int_value,
    latest_summary_for_actor,
    most_common_counterparty,
    string_list,
    unique_display_names,
    unique_source_names,
)


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
        for target_cast_id in string_list(activity.get("target_cast_ids")):
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
            if int_value(item.get("round_index", 0)) >= endgame_start_round
        ]
        endgame_received = [
            item
            for item in received
            if int_value(item.get("round_index", 0)) >= endgame_start_round
        ]
        counterparties: list[str] = []
        for activity in initiated + received:
            names = [
                display_name_of(
                    cast_id=str(target_actor_id),
                    actors_by_id=actors_by_id,
                )
                for target_actor_id in string_list(activity.get("target_cast_ids"))
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
                    str(item.get("summary", "")) for item in initiated[-3:]
                ],
                "latest_received_summaries": [
                    str(item.get("summary", "")) for item in received[-3:]
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
        int_value(packet.get("round_index", 0)): str(packet.get("time_label", ""))
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
            or actor_id in string_list(item.get("target_cast_ids"))
        ]
        endgame_activities = [
            item
            for item in related_activities
            if int_value(item.get("round_index", 0)) >= endgame_start_round
        ]
        if related_activities:
            last_seen_round = max(
                int_value(item.get("round_index", 0)) for item in related_activities
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
                        if actor_id in string_list(item.get("target_cast_ids"))
                    ],
                    actors_by_id=actors_by_id,
                    exclude_name=display_name,
                ),
                "strongest_endgame_counterparty": most_common_counterparty(
                    actor_name=display_name,
                    activities=endgame_activities,
                    actors_by_id=actors_by_id,
                ),
                "latest_summary": latest_summary_for_actor(
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
        for event in string_list(packet.get("notable_events"))[:2]:
            clues.append(f"{packet['time_label']} 주요 사건: {event}")

    for snapshot in final_actor_snapshots:
        strongest = str(snapshot.get("strongest_endgame_counterparty", "")).strip()
        if strongest:
            clues.append(
                f"{snapshot['display_name']}는 마지막에 {strongest}와 가장 많이 반응을 주고받았다."
            )
        sent_to = string_list(snapshot.get("endgame_sent_to"))
        if len(sent_to) == 1:
            clues.append(
                f"{snapshot['display_name']}는 마지막에 {sent_to[0]}에게 가장 많이 반응했다."
            )
        received_from = string_list(snapshot.get("endgame_received_from"))
        if len(received_from) == 1:
            clues.append(
                f"{snapshot['display_name']}는 마지막에 {received_from[0]}의 반응을 가장 많이 받았다."
            )

    deduped_clues: list[str] = []
    for clue in clues:
        if clue and clue not in deduped_clues:
            deduped_clues.append(clue)
    return deduped_clues[:12]
