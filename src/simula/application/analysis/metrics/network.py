"""Purpose:
- Orchestrate actor network aggregation, metric computation, and export graphs.
"""

from __future__ import annotations

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
    ActorRecord,
    AdoptedActivityRecord,
    NetworkReport,
    NetworkSummary,
)


def build_network_report(
    *,
    actors_by_id: dict[str, ActorRecord],
    activities: list[AdoptedActivityRecord],
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


__all__ = [
    "build_network_graph",
    "build_network_report",
]
