"""Purpose:
- Build directed and undirected graph structures for network analysis outputs.
"""

from __future__ import annotations

import networkx as nx

from simula.application.analysis.metrics.network_aggregation import MutableNodeState
from simula.application.analysis.models import ActorEdgeMetrics, ActorNodeMetrics


def build_algorithm_graph(
    *,
    node_state: dict[str, MutableNodeState],
    counterparties: dict[str, set[str]],
    edges: list[ActorEdgeMetrics],
) -> nx.DiGraph:
    """Build the directed graph used by the metric algorithms."""

    graph = nx.DiGraph()
    for item in node_state.values():
        graph.add_node(
            item.cast_id,
            display_name=item.display_name,
            initiated_actions=item.initiated_actions,
            received_actions=item.received_actions,
            sent_relations=item.sent_relations,
            received_relations=item.received_relations,
            total_weight=item.sent_relations + item.received_relations,
            counterpart_count=len(counterparties.get(item.cast_id, set())),
        )
    for edge in edges:
        graph.add_edge(
            edge.source_cast_id,
            edge.target_cast_id,
            total_weight=edge.total_weight,
        )
    return graph


def build_undirected_projection(directed_graph: nx.DiGraph) -> nx.Graph:
    """Collapse reciprocal directed edges into one weighted undirected projection."""

    projected = nx.Graph()
    for node_id, attrs in directed_graph.nodes(data=True):
        projected.add_node(node_id, **attrs)
    for source, target, attrs in directed_graph.edges(data=True):
        total_weight = int(attrs.get("total_weight", 0))
        if projected.has_edge(source, target):
            projected[source][target]["total_weight"] += total_weight
        else:
            projected.add_edge(source, target, total_weight=total_weight)
    return projected


def build_network_graph(
    *,
    nodes: list[ActorNodeMetrics],
    edges: list[ActorEdgeMetrics],
) -> nx.DiGraph:
    """Build the exported directed graph with enriched node attributes."""

    graph = nx.DiGraph()
    for node in nodes:
        graph.add_node(
            node.cast_id,
            **_non_null_values(
                {
                    "display_name": node.display_name,
                    "initiated_actions": node.initiated_actions,
                    "received_actions": node.received_actions,
                    "sent_relations": node.sent_relations,
                    "received_relations": node.received_relations,
                    "total_weight": node.total_weight,
                    "counterpart_count": node.counterpart_count,
                    "in_degree_centrality": node.in_degree_centrality,
                    "out_degree_centrality": node.out_degree_centrality,
                    "betweenness_centrality": node.betweenness_centrality,
                    "hub_score": node.hub_score,
                    "authority_score": node.authority_score,
                    "pagerank": node.pagerank,
                    "core_number": node.core_number,
                    "effective_size": node.effective_size,
                }
            ),
        )
    for edge in edges:
        graph.add_edge(
            edge.source_cast_id,
            edge.target_cast_id,
            source_display_name=edge.source_display_name,
            target_display_name=edge.target_display_name,
            weight=edge.total_weight,
            action_count=edge.action_count,
            intent_only_count=edge.intent_only_count,
            public_count=edge.public_count,
            group_count=edge.group_count,
            private_count=edge.private_count,
            thread_event_count=edge.thread_event_count,
            first_round=edge.first_round,
            last_round=edge.last_round,
            total_weight=edge.total_weight,
            label_preview=edge.label_preview,
            label_variant_count=edge.label_variant_count,
        )
    return graph


def _non_null_values(values: dict[str, object | None]) -> dict[str, object]:
    return {
        key: value
        for key, value in values.items()
        if value is not None
    }
