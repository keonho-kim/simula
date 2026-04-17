"""Purpose:
- Orchestrate actor network aggregation, metric computation, and export graphs.
"""

from __future__ import annotations

from collections import defaultdict

import networkx as nx

from simula.application.analysis.metrics.network_aggregation import (
    aggregate_relationship_network,
)
from simula.application.analysis.metrics.network_algorithms import (
    build_leaderboards,
    compute_network_metrics,
)
from simula.application.analysis.metrics.network_graph import (
    build_algorithm_graph,
    build_network_graph,
    build_undirected_projection,
)
from simula.application.analysis.models import (
    ActorNodeMetrics,
    NetworkBenchmarkMetrics,
    ActorRecord,
    AdoptedActivityRecord,
    NetworkReport,
    NetworkSummary,
    PlannedActionRecord,
)


def build_network_report(
    *,
    actors_by_id: dict[str, ActorRecord],
    activities: list[AdoptedActivityRecord],
    planned_actions: list[PlannedActionRecord] | None = None,
    planned_max_rounds: int = 0,
    has_actors_finalized_event: bool = True,
    has_round_actions_adopted_event: bool = True,
) -> tuple[NetworkReport, nx.DiGraph]:
    """Build node metrics, summary metrics, and a graph for one adopted-activity run."""

    aggregated = aggregate_relationship_network(
        actors_by_id=actors_by_id,
        activities=activities,
    )
    directed_graph = build_algorithm_graph(
        node_state=aggregated.node_state,
        counterparties=aggregated.counterparties,
        edges=aggregated.edges,
    )
    undirected_graph = build_undirected_projection(directed_graph)
    computed = compute_network_metrics(
        directed_graph=directed_graph,
        undirected_graph=undirected_graph,
        total_actor_count=len(actors_by_id),
        activities=activities,
        planned_action_types=_planned_action_types(planned_actions or []),
    )
    mean_edge_growth_rate, mean_active_actor_growth_rate = _compute_mean_growth_rates(
        activities=activities,
        planned_max_rounds=planned_max_rounds,
    )

    nodes = sorted(
        (
            ActorNodeMetrics(
                cast_id=item.cast_id,
                display_name=item.display_name,
                initiated_actions=item.initiated_actions,
                received_actions=item.received_actions,
                sent_relations=item.sent_relations,
                received_relations=item.received_relations,
                total_weight=item.sent_relations + item.received_relations,
                counterpart_count=len(aggregated.counterparties.get(item.cast_id, set())),
                sent_action_counts=dict(sorted(item.sent_action_counts.items())),
                received_action_counts=dict(sorted(item.received_action_counts.items())),
                in_degree_centrality=computed.in_degree_centrality.get(item.cast_id),
                out_degree_centrality=computed.out_degree_centrality.get(item.cast_id),
                betweenness_centrality=computed.betweenness_centrality.get(item.cast_id),
                hub_score=computed.hub_score.get(item.cast_id),
                authority_score=computed.authority_score.get(item.cast_id),
                pagerank=computed.pagerank.get(item.cast_id),
                core_number=computed.core_number.get(item.cast_id),
                effective_size=computed.effective_size.get(item.cast_id),
            )
            for item in aggregated.node_state.values()
        ),
        key=lambda item: (-item.total_weight, item.display_name, item.cast_id),
    )

    input_warnings: list[str] = []
    if not has_actors_finalized_event:
        input_warnings.append(
            "`actors_finalized` 이벤트가 없어 전체 actor roster를 복원하지 못했습니다."
        )
    if not has_round_actions_adopted_event:
        input_warnings.append(
            "`round_actions_adopted` 이벤트가 없어 채택된 상호작용을 복원하지 못했습니다."
        )

    summary = NetworkSummary(
        node_count=directed_graph.number_of_nodes(),
        edge_count=directed_graph.number_of_edges(),
        activity_count=len(activities),
        total_actor_count=len(actors_by_id),
        participating_actor_count=computed.participating_actor_count,
        participating_actor_ratio=computed.participating_actor_ratio,
        isolated_actor_count=computed.isolated_actor_count,
        isolated_actor_ratio=computed.isolated_actor_ratio,
        max_edge_weight=max((item.total_weight for item in aggregated.edges), default=0),
        density=computed.density,
        weak_component_count=computed.weak_component_count,
        strong_component_count=computed.strong_component_count,
        largest_weak_component_size=computed.largest_weak_component_size,
        largest_weak_component_ratio=computed.largest_weak_component_ratio,
        largest_strong_component_size=computed.largest_strong_component_size,
        largest_strong_component_ratio=computed.largest_strong_component_ratio,
        reciprocity=computed.reciprocity,
        average_clustering=computed.average_clustering,
        transitivity=computed.transitivity,
        max_core_number=computed.max_core_number,
        community_count=len(computed.communities),
        benchmark_metrics=NetworkBenchmarkMetrics(
            participation_entropy=computed.participation_entropy,
            action_type_diversity=computed.action_type_diversity,
            density=computed.density,
            average_path_depth=computed.average_path_depth,
            network_diameter=computed.network_diameter,
            centralization=computed.centralization,
            community_count=len(computed.communities),
            modularity=computed.modularity,
            mean_edge_growth_rate=mean_edge_growth_rate,
            mean_active_actor_growth_rate=mean_active_actor_growth_rate,
            top20_interaction_share=computed.top20_interaction_share,
        ),
        skipped_metrics=computed.skipped_metrics,
        empty_reason=(
            "`actors_finalized` 이벤트가 없어 행위자 노드가 비어 있습니다."
            if not has_actors_finalized_event and not actors_by_id
            else "`round_actions_adopted` 이벤트가 없어 채택된 상호작용이 비어 있습니다."
            if not has_round_actions_adopted_event and not activities
            else "채택된 행위자 상호작용이 없습니다."
            if not activities
            else "행위자 간 연결 엣지가 생성되지 않았습니다."
            if not aggregated.edges
            else None
        ),
        input_warnings=input_warnings,
    )
    report = NetworkReport(
        nodes=nodes,
        edges=aggregated.edges,
        summary=summary,
        leaderboards=build_leaderboards(nodes),
        communities=computed.communities,
    )
    graph = build_network_graph(nodes=nodes, edges=aggregated.edges)
    return report, graph


def _planned_action_types(planned_actions: list[PlannedActionRecord]) -> set[str]:
    return {
        item.action_type.strip()
        for item in planned_actions
        if item.action_type.strip()
    }


def _compute_mean_growth_rates(
    *,
    activities: list[AdoptedActivityRecord],
    planned_max_rounds: int,
) -> tuple[float | None, float | None]:
    max_activity_round = max((item.round_index for item in activities), default=0)
    max_round = max(planned_max_rounds, max_activity_round)
    if max_round <= 1:
        return None, None

    activities_by_round: dict[int, list[AdoptedActivityRecord]] = defaultdict(list)
    for activity in activities:
        activities_by_round[activity.round_index].append(activity)

    cumulative_actor_ids: set[str] = set()
    cumulative_edge_ids: set[tuple[str, str]] = set()
    previous_actor_count = 0
    previous_edge_count = 0
    edge_deltas: list[int] = []
    actor_deltas: list[int] = []

    for round_index in range(1, max_round + 1):
        for activity in activities_by_round.get(round_index, []):
            for source_cast_id, target_cast_id in _activity_pairs(activity):
                cumulative_edge_ids.add((source_cast_id, target_cast_id))
                cumulative_actor_ids.add(source_cast_id)
                cumulative_actor_ids.add(target_cast_id)
        actor_count = len(cumulative_actor_ids)
        edge_count = len(cumulative_edge_ids)
        if round_index > 1:
            edge_deltas.append(edge_count - previous_edge_count)
            actor_deltas.append(actor_count - previous_actor_count)
        previous_actor_count = actor_count
        previous_edge_count = edge_count

    if not edge_deltas or not actor_deltas:
        return None, None
    return sum(edge_deltas) / len(edge_deltas), sum(actor_deltas) / len(actor_deltas)


def _activity_pairs(activity: AdoptedActivityRecord) -> list[tuple[str, str]]:
    source_cast_id = activity.source_cast_id.strip()
    if not source_cast_id:
        return []

    pairs: list[tuple[str, str]] = []
    actual_targets = _dedupe_ids(activity.target_cast_ids)
    intent_targets = [
        cast_id
        for cast_id in _dedupe_ids(activity.intent_target_cast_ids)
        if cast_id not in set(actual_targets)
    ]
    for target_cast_id in [*actual_targets, *intent_targets]:
        if not target_cast_id or target_cast_id == source_cast_id:
            continue
        pairs.append((source_cast_id, target_cast_id))
    return pairs


def _dedupe_ids(values: list[str]) -> list[str]:
    deduped: list[str] = []
    for value in values:
        if value and value not in deduped:
            deduped.append(value)
    return deduped


__all__ = [
    "build_network_graph",
    "build_network_report",
]
