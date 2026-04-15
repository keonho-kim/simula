"""Purpose:
- Build cumulative round-by-round network growth metrics.
"""

from __future__ import annotations

from collections import defaultdict

import networkx as nx

from simula.application.analysis.metrics.network_leaders import (
    select_top_broker_leader,
    select_top_degree_leader,
    select_top_influence_leader,
)
from simula.application.analysis.metrics.network import build_network_report
from simula.application.analysis.models import (
    ActorRecord,
    AdoptedActivityRecord,
    NetworkGrowthRecord,
    NetworkGrowthReport,
)


def build_network_growth_report(
    *,
    actors_by_id: dict[str, ActorRecord],
    activities: list[AdoptedActivityRecord],
    planned_max_rounds: int = 0,
    has_actors_finalized_event: bool = True,
    has_round_actions_adopted_event: bool = True,
) -> NetworkGrowthReport:
    """Build cumulative network metrics for each round."""

    max_activity_round = max((item.round_index for item in activities), default=0)
    max_round = max(planned_max_rounds, max_activity_round)
    if max_round <= 0:
        return NetworkGrowthReport(
            rows=[],
            empty_reason="라운드별 연결망 변화를 계산할 데이터가 없습니다.",
        )

    activities_by_round: dict[int, list[AdoptedActivityRecord]] = defaultdict(list)
    for activity in activities:
        activities_by_round[activity.round_index].append(activity)

    cumulative_activities: list[AdoptedActivityRecord] = []
    previous_actor_ids: set[str] = set()
    previous_edge_ids: set[tuple[str, str]] = set()
    rows: list[NetworkGrowthRecord] = []

    for round_index in range(1, max_round + 1):
        cumulative_activities.extend(activities_by_round.get(round_index, []))
        report, _ = build_network_report(
            actors_by_id=actors_by_id,
            activities=list(cumulative_activities),
            has_actors_finalized_event=has_actors_finalized_event,
            has_round_actions_adopted_event=has_round_actions_adopted_event,
        )
        actor_ids = {
            node.cast_id
            for node in report.nodes
            if node.total_weight > 0
        }
        edge_ids = {
            (edge.source_cast_id, edge.target_cast_id)
            for edge in report.edges
            if edge.total_weight > 0
        }
        actor_weights = [
            float(node.total_weight)
            for node in report.nodes
            if node.total_weight > 0
        ]
        edge_weights = [
            float(edge.total_weight)
            for edge in report.edges
            if edge.total_weight > 0
        ]
        top_degree = select_top_degree_leader(report.nodes)
        top_broker = select_top_broker_leader(report.nodes)
        top_influence = select_top_influence_leader(report.nodes)
        rows.append(
            NetworkGrowthRecord(
                round_index=round_index,
                cumulative_activity_count=len(cumulative_activities),
                participating_actor_count=report.summary.participating_actor_count,
                edge_count=report.summary.edge_count,
                largest_component_ratio=report.summary.largest_weak_component_ratio,
                density=report.summary.density,
                top1_actor_share=_top_share(actor_weights, limit=1),
                top3_actor_share=_top_share(actor_weights, limit=3),
                actor_weight_hhi=_hhi(actor_weights),
                actor_weight_gini=_gini(actor_weights),
                top1_edge_share=_top_share(edge_weights, limit=1),
                top3_edge_share=_top_share(edge_weights, limit=3),
                edge_weight_hhi=_hhi(edge_weights),
                edge_weight_gini=_gini(edge_weights),
                new_actor_count=len(actor_ids - previous_actor_ids),
                new_edge_count=len(edge_ids - previous_edge_ids),
                top_degree_cast_id=top_degree.cast_id,
                top_degree_display_name=top_degree.display_name,
                top_degree_score=top_degree.score,
                top_broker_cast_id=top_broker.cast_id,
                top_broker_display_name=top_broker.display_name,
                top_broker_score=top_broker.score,
                top_influence_cast_id=top_influence.cast_id,
                top_influence_display_name=top_influence.display_name,
                top_influence_score=top_influence.score,
            )
        )
        previous_actor_ids = actor_ids
        previous_edge_ids = edge_ids

    return NetworkGrowthReport(rows=rows)


def build_cumulative_network_graphs(
    *,
    actors_by_id: dict[str, ActorRecord],
    activities: list[AdoptedActivityRecord],
    planned_max_rounds: int = 0,
    has_actors_finalized_event: bool = True,
    has_round_actions_adopted_event: bool = True,
) -> list[tuple[int, nx.DiGraph]]:
    """Build one exported graph for each cumulative round."""

    graphs: list[tuple[int, nx.DiGraph]] = []
    max_activity_round = max((item.round_index for item in activities), default=0)
    max_round = max(planned_max_rounds, max_activity_round)
    if max_round <= 0:
        return graphs

    activities_by_round: dict[int, list[AdoptedActivityRecord]] = defaultdict(list)
    for activity in activities:
        activities_by_round[activity.round_index].append(activity)

    cumulative_activities: list[AdoptedActivityRecord] = []
    for round_index in range(1, max_round + 1):
        cumulative_activities.extend(activities_by_round.get(round_index, []))
        _, graph = build_network_report(
            actors_by_id=actors_by_id,
            activities=list(cumulative_activities),
            has_actors_finalized_event=has_actors_finalized_event,
            has_round_actions_adopted_event=has_round_actions_adopted_event,
        )
        graphs.append((round_index, graph))
    return graphs


def _top_share(weights: list[float], *, limit: int) -> float | None:
    if not weights:
        return None
    total = sum(weights)
    if total <= 0:
        return None
    ordered = sorted(weights, reverse=True)
    return sum(ordered[:limit]) / total


def _hhi(weights: list[float]) -> float | None:
    if not weights:
        return None
    total = sum(weights)
    if total <= 0:
        return None
    return sum((weight / total) ** 2 for weight in weights)


def _gini(weights: list[float]) -> float | None:
    if not weights:
        return None
    total = sum(weights)
    if total <= 0:
        return None
    pairwise_difference = sum(
        abs(left - right)
        for left in weights
        for right in weights
    )
    return pairwise_difference / (2 * len(weights) * total)


__all__ = [
    "build_cumulative_network_graphs",
    "build_network_growth_report",
]
