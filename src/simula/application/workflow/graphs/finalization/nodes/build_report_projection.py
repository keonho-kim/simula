"""목적:
- 최종 보고서용 정제 projection을 만든다.
"""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import datetime

from simula.application.workflow.graphs.finalization.nodes.report_projection_actor import (
    build_actor_digests,
    build_final_actor_snapshots,
    build_final_outcome_clues,
)
from simula.application.workflow.graphs.finalization.nodes.report_projection_helpers import (
    dict_list,
    dict_value,
    int_value,
    string_list,
)
from simula.application.workflow.graphs.finalization.nodes.report_projection_timeline import (
    build_intent_arc_packets,
    cluster_round_activities,
    format_report_time_label,
    phase_hint,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.application.workflow.utils.prompt_projections import truncate_text

__all__ = [
    "build_intent_arc_packets",
    "build_report_projection",
    "cluster_round_activities",
    "format_report_time_label",
    "phase_hint",
]


def build_report_projection(
    state: SimulationWorkflowState,
) -> dict[str, object]:
    """최종 보고서 프롬프트에 넣을 projection JSON을 만든다."""

    activities = sorted(
        dict_list(state.get("activities", [])),
        key=lambda item: (
            int_value(item.get("round_index", 0)),
            str(item.get("created_at", "")),
            str(item.get("activity_id", "")),
        ),
    )
    observer_reports = {
        int_value(report.get("round_index", 0)): report
        for report in dict_list(state.get("observer_reports", []))
    }
    actors = dict_list(state.get("actors", []))
    actors_by_id = {str(actor["cast_id"]): actor for actor in actors}
    total_rounds = max(1, int_value(state.get("round_index", 0)))
    round_time_history = {
        int_value(item.get("round_index", 0)): item
        for item in dict_list(state.get("round_time_history", []))
    }
    round_focus_history = {
        int_value(item.get("round_index", 0)): item
        for item in dict_list(state.get("round_focus_history", []))
    }
    background_updates_by_round: dict[int, list[dict[str, object]]] = defaultdict(list)
    for item in dict_list(state.get("background_updates", [])):
        background_updates_by_round[int_value(item.get("round_index", 0))].append(item)
    anchor = datetime.fromisoformat(
        str(dict_value(state.get("report_timeline_anchor_json")).get("anchor_iso"))
    )

    timeline_packets: list[dict[str, object]] = []
    round_indexes = sorted(
        {int_value(activity.get("round_index", 0)) for activity in activities}
        | set(observer_reports.keys())
    )
    for round_index in round_indexes:
        round_activities = [
            activity
            for activity in activities
            if int_value(activity.get("round_index", 0)) == round_index
        ]
        report = observer_reports.get(round_index, {})
        round_time = round_time_history.get(round_index, {})
        focus_plan = round_focus_history.get(round_index, {})
        timeline_packets.append(
            {
                "round_index": round_index,
                "time_label": format_report_time_label(
                    anchor=anchor,
                    total_elapsed_minutes=int_value(
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
                "selected_cast_ids": string_list(
                    focus_plan.get("selected_cast_ids", [])
                ),
                "observer_summary": str(report.get("summary", "")),
                "notable_events": string_list(report.get("notable_events")),
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
    final_report = dict_value(state.get("final_report"))
    projection = {
        "summary_context": {
            "timeline_anchor": dict_value(state.get("report_timeline_anchor_json")),
            "objective": truncate_text(final_report.get("objective", ""), 180),
            "world_state_summary": truncate_text(
                state.get("world_state_summary", ""),
                220,
            ),
            "elapsed_simulation_label": str(
                dict_value(state.get("simulation_clock", {})).get(
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
                for item in string_list(final_report.get("notable_events"))
            ][:5],
            "visibility_action_counts": dict(
                Counter(str(activity.get("visibility", "")) for activity in activities)
            ),
        },
        "timeline_highlights": [
            {
                "round_index": int_value(packet.get("round_index", 0)),
                "time_label": str(packet.get("time_label", "")),
                "phase_hint": str(packet.get("phase_hint", "")),
                "focus_summary": truncate_text(packet.get("focus_summary", ""), 90),
                "observer_summary": truncate_text(
                    packet.get("observer_summary", ""),
                    160,
                ),
                "notable_events": [
                    truncate_text(item, 100)
                    for item in string_list(packet.get("notable_events"))
                ][:2],
                "action_highlights": [
                    truncate_text(item.get("summary", ""), 100)
                    for item in dict_list(packet.get("action_clusters", []))[:2]
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
                "endgame_sent_to": string_list(snapshot.get("endgame_sent_to"))[:2],
                "endgame_received_from": string_list(
                    snapshot.get("endgame_received_from")
                )[:2],
                "latest_summary": truncate_text(
                    snapshot.get("latest_summary", ""),
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
                "must_resolve": bool(item.get("must_resolve", False)),
                "progress_summary": truncate_text(
                    item.get("progress_summary", ""),
                    120,
                ),
                "completed_round": int_value(item.get("completed_round", 0)),
            }
            for item in dict_list(
                dict_value(state.get("event_memory", {})).get("events", [])
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
                "interaction_count": int_value(digest.get("interaction_count", 0)),
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
