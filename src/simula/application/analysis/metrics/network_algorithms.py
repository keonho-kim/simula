"""Purpose:
- Compute network complexity metrics and leaderboard summaries.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import networkx as nx

from simula.application.analysis.models import (
    ActorNodeMetrics,
    NetworkCommunitySummary,
    NetworkLeaderboardEntry,
)

_NO_EDGE_REASON = "연결 엣지가 없어 계산할 수 없습니다."


@dataclass(slots=True)
class ComputedNetworkMetrics:
    participating_actor_count: int
    participating_actor_ratio: float | None
    isolated_actor_count: int
    isolated_actor_ratio: float | None
    density: float | None
    weak_component_count: int
    strong_component_count: int
    largest_weak_component_size: int
    largest_weak_component_ratio: float | None
    largest_strong_component_size: int
    largest_strong_component_ratio: float | None
    reciprocity: float | None
    average_clustering: float | None
    transitivity: float | None
    max_core_number: int | None
    in_degree_centrality: dict[str, float | None]
    out_degree_centrality: dict[str, float | None]
    betweenness_centrality: dict[str, float | None]
    hub_score: dict[str, float | None]
    authority_score: dict[str, float | None]
    pagerank: dict[str, float | None]
    core_number: dict[str, int | None]
    effective_size: dict[str, float | None]
    communities: list[NetworkCommunitySummary]
    skipped_metrics: dict[str, str]


def compute_network_metrics(
    *,
    directed_graph: nx.DiGraph,
    undirected_graph: nx.Graph,
    total_actor_count: int,
) -> ComputedNetworkMetrics:
    """Compute global and per-node metrics for the aggregated actor graph."""

    node_ids = list(directed_graph.nodes())
    node_count = directed_graph.number_of_nodes()
    edge_count = directed_graph.number_of_edges()
    isolated_actor_count = sum(1 for node_id in node_ids if directed_graph.degree(node_id) == 0)
    participating_actor_count = max(node_count - isolated_actor_count, 0)
    weak_components = (
        list(nx.weakly_connected_components(directed_graph))
        if node_count > 0
        else []
    )
    strong_components = (
        list(nx.strongly_connected_components(directed_graph))
        if node_count > 0
        else []
    )
    largest_weak_component_size = max((len(component) for component in weak_components), default=0)
    largest_strong_component_size = max(
        (len(component) for component in strong_components),
        default=0,
    )
    skipped_metrics: dict[str, str] = {}
    density = _safe_scalar(nx.density(directed_graph))
    in_degree_centrality = _degree_centrality(
        graph=directed_graph,
        node_ids=node_ids,
        mode="in",
    )
    out_degree_centrality = _degree_centrality(
        graph=directed_graph,
        node_ids=node_ids,
        mode="out",
    )
    betweenness_centrality = {node_id: None for node_id in node_ids}
    hub_score = {node_id: None for node_id in node_ids}
    authority_score = {node_id: None for node_id in node_ids}
    pagerank = {node_id: None for node_id in node_ids}
    core_number = {node_id: None for node_id in undirected_graph.nodes()}
    effective_size = {node_id: None for node_id in undirected_graph.nodes()}
    reciprocity: float | None = None
    average_clustering: float | None = None
    transitivity: float | None = None
    max_core_number: int | None = None
    communities: list[NetworkCommunitySummary] = []

    if edge_count == 0:
        for metric_name in (
            "reciprocity",
            "betweenness_centrality",
            "hub_score",
            "authority_score",
            "pagerank",
            "average_clustering",
            "transitivity",
            "core_number",
            "effective_size",
        ):
            skipped_metrics[metric_name] = _NO_EDGE_REASON
    else:
        reciprocity = _compute_reciprocity(
            directed_graph=directed_graph,
            skipped_metrics=skipped_metrics,
        )
        betweenness_centrality = _compute_betweenness(
            directed_graph=directed_graph,
            skipped_metrics=skipped_metrics,
        )
        hub_score, authority_score = _compute_hits(
            directed_graph=directed_graph,
            skipped_metrics=skipped_metrics,
        )
        pagerank = _compute_pagerank(
            directed_graph=directed_graph,
            skipped_metrics=skipped_metrics,
        )
        average_clustering = _compute_average_clustering(
            undirected_graph=undirected_graph,
            skipped_metrics=skipped_metrics,
        )
        transitivity = _compute_transitivity(
            undirected_graph=undirected_graph,
            skipped_metrics=skipped_metrics,
        )
        core_number = _compute_core_number(
            undirected_graph=undirected_graph,
            skipped_metrics=skipped_metrics,
        )
        max_core_number = max(
            (value for value in core_number.values() if value is not None),
            default=None,
        )
        effective_size = _compute_effective_size(
            undirected_graph=undirected_graph,
            skipped_metrics=skipped_metrics,
        )
        communities = _compute_communities(
            undirected_graph=undirected_graph,
            skipped_metrics=skipped_metrics,
        )

    return ComputedNetworkMetrics(
        participating_actor_count=participating_actor_count,
        participating_actor_ratio=_ratio(participating_actor_count, total_actor_count),
        isolated_actor_count=isolated_actor_count,
        isolated_actor_ratio=_ratio(isolated_actor_count, total_actor_count),
        density=density,
        weak_component_count=len(weak_components),
        strong_component_count=len(strong_components),
        largest_weak_component_size=largest_weak_component_size,
        largest_weak_component_ratio=_ratio(largest_weak_component_size, total_actor_count),
        largest_strong_component_size=largest_strong_component_size,
        largest_strong_component_ratio=_ratio(largest_strong_component_size, total_actor_count),
        reciprocity=reciprocity,
        average_clustering=average_clustering,
        transitivity=transitivity,
        max_core_number=max_core_number,
        in_degree_centrality=in_degree_centrality,
        out_degree_centrality=out_degree_centrality,
        betweenness_centrality=betweenness_centrality,
        hub_score=hub_score,
        authority_score=authority_score,
        pagerank=pagerank,
        core_number=core_number,
        effective_size=effective_size,
        communities=communities,
        skipped_metrics=skipped_metrics,
    )


def build_leaderboards(
    nodes: list[ActorNodeMetrics],
) -> dict[str, list[NetworkLeaderboardEntry]]:
    """Build the public top-N leaderboard groups for the network summary."""

    return {
        "authorities": _top_entries(nodes, metric_name="authority_score"),
        "brokers": _top_entries(nodes, metric_name="betweenness_centrality"),
        "hubs": _top_entries(nodes, metric_name="hub_score"),
        "influence": _top_entries(nodes, metric_name="pagerank"),
    }


def _degree_centrality(
    *,
    graph: nx.DiGraph,
    node_ids: list[str],
    mode: str,
) -> dict[str, float | None]:
    if graph.number_of_nodes() <= 1:
        return {node_id: 0.0 for node_id in node_ids}
    if mode == "in":
        scores = nx.in_degree_centrality(graph)
    else:
        scores = nx.out_degree_centrality(graph)
    return {
        node_id: _safe_scalar(scores.get(node_id))
        for node_id in node_ids
    }


def _compute_reciprocity(
    *,
    directed_graph: nx.DiGraph,
    skipped_metrics: dict[str, str],
) -> float | None:
    try:
        return _safe_scalar(nx.overall_reciprocity(directed_graph))
    except Exception as exc:  # pragma: no cover - exercised through tests via patched functions
        skipped_metrics["reciprocity"] = _exception_reason(exc)
        return None


def _compute_betweenness(
    *,
    directed_graph: nx.DiGraph,
    skipped_metrics: dict[str, str],
) -> dict[str, float | None]:
    distance_graph = directed_graph.copy()
    for source, target, attrs in distance_graph.edges(data=True):
        total_weight = max(float(attrs.get("total_weight", 1.0)), 1.0)
        distance_graph[source][target]["distance_weight"] = 1.0 / total_weight
    try:
        scores = nx.betweenness_centrality(
            distance_graph,
            weight="distance_weight",
            normalized=True,
        )
    except Exception as exc:  # pragma: no cover - exercised through tests via patched functions
        skipped_metrics["betweenness_centrality"] = _exception_reason(exc)
        return {node_id: None for node_id in directed_graph.nodes()}
    return {
        node_id: _safe_scalar(scores.get(node_id))
        for node_id in directed_graph.nodes()
    }


def _compute_hits(
    *,
    directed_graph: nx.DiGraph,
    skipped_metrics: dict[str, str],
) -> tuple[dict[str, float | None], dict[str, float | None]]:
    try:
        hubs, authorities = nx.hits(
            directed_graph,
            max_iter=200,
            normalized=True,
        )
    except Exception as exc:  # pragma: no cover - exercised through tests via patched functions
        reason = _exception_reason(exc)
        skipped_metrics["hub_score"] = reason
        skipped_metrics["authority_score"] = reason
        empty = {node_id: None for node_id in directed_graph.nodes()}
        return empty, dict(empty)
    return (
        {
            node_id: _safe_scalar(hubs.get(node_id))
            for node_id in directed_graph.nodes()
        },
        {
            node_id: _safe_scalar(authorities.get(node_id))
            for node_id in directed_graph.nodes()
        },
    )


def _compute_pagerank(
    *,
    directed_graph: nx.DiGraph,
    skipped_metrics: dict[str, str],
) -> dict[str, float | None]:
    try:
        scores = nx.pagerank(
            directed_graph,
            weight="total_weight",
        )
    except Exception as exc:  # pragma: no cover - exercised through tests via patched functions
        skipped_metrics["pagerank"] = _exception_reason(exc)
        return {node_id: None for node_id in directed_graph.nodes()}
    return {
        node_id: _safe_scalar(scores.get(node_id))
        for node_id in directed_graph.nodes()
    }


def _compute_average_clustering(
    *,
    undirected_graph: nx.Graph,
    skipped_metrics: dict[str, str],
) -> float | None:
    try:
        return _safe_scalar(
            nx.average_clustering(
                undirected_graph,
                weight="total_weight",
            )
        )
    except Exception as exc:  # pragma: no cover - exercised through tests via patched functions
        skipped_metrics["average_clustering"] = _exception_reason(exc)
        return None


def _compute_transitivity(
    *,
    undirected_graph: nx.Graph,
    skipped_metrics: dict[str, str],
) -> float | None:
    try:
        return _safe_scalar(nx.transitivity(undirected_graph))
    except Exception as exc:  # pragma: no cover - exercised through tests via patched functions
        skipped_metrics["transitivity"] = _exception_reason(exc)
        return None


def _compute_core_number(
    *,
    undirected_graph: nx.Graph,
    skipped_metrics: dict[str, str],
) -> dict[str, int | None]:
    try:
        scores = nx.core_number(undirected_graph)
    except Exception as exc:  # pragma: no cover - exercised through tests via patched functions
        skipped_metrics["core_number"] = _exception_reason(exc)
        return {node_id: None for node_id in undirected_graph.nodes()}
    return {
        node_id: int(scores.get(node_id, 0))
        for node_id in undirected_graph.nodes()
    }


def _compute_effective_size(
    *,
    undirected_graph: nx.Graph,
    skipped_metrics: dict[str, str],
) -> dict[str, float | None]:
    try:
        scores = nx.effective_size(
            undirected_graph,
            weight="total_weight",
        )
    except Exception as exc:  # pragma: no cover - exercised through tests via patched functions
        skipped_metrics["effective_size"] = _exception_reason(exc)
        return {node_id: None for node_id in undirected_graph.nodes()}
    return {
        node_id: _safe_scalar(scores.get(node_id))
        for node_id in undirected_graph.nodes()
    }


def _compute_communities(
    *,
    undirected_graph: nx.Graph,
    skipped_metrics: dict[str, str],
) -> list[NetworkCommunitySummary]:
    try:
        communities = nx.community.greedy_modularity_communities(
            undirected_graph,
            weight="total_weight",
        )
    except Exception as exc:  # pragma: no cover - exercised through tests via patched functions
        skipped_metrics["community_detection"] = _exception_reason(exc)
        return []
    meaningful_groups = [
        community
        for community in communities
        if len(community) >= 2
    ]
    summaries: list[NetworkCommunitySummary] = []
    for community_index, community in enumerate(meaningful_groups, start=1):
        ordered_members = sorted(
            community,
            key=lambda node_id: (
                str(undirected_graph.nodes[node_id].get("display_name", node_id)),
                node_id,
            ),
        )
        member_display_names = [
            str(undirected_graph.nodes[node_id].get("display_name", node_id))
            for node_id in ordered_members
        ]
        internal_weight = undirected_graph.subgraph(community).size(weight="total_weight")
        summaries.append(
            NetworkCommunitySummary(
                community_index=community_index,
                actor_count=len(ordered_members),
                internal_weight=float(internal_weight),
                member_cast_ids=ordered_members,
                member_display_names=member_display_names,
            )
        )
    return summaries


def _top_entries(
    nodes: list[ActorNodeMetrics],
    *,
    metric_name: str,
    limit: int = 5,
) -> list[NetworkLeaderboardEntry]:
    ranked_nodes = sorted(
        (
            node
            for node in nodes
            if isinstance(getattr(node, metric_name), (float, int))
        ),
        key=lambda item: (
            -float(getattr(item, metric_name)),
            item.display_name,
            item.cast_id,
        ),
    )
    entries: list[NetworkLeaderboardEntry] = []
    for node in ranked_nodes[:limit]:
        metric_value = getattr(node, metric_name)
        if metric_value is None:
            continue
        entries.append(
            NetworkLeaderboardEntry(
                cast_id=node.cast_id,
                display_name=node.display_name,
                score=float(metric_value),
            )
        )
    return entries


def _ratio(numerator: int, denominator: int) -> float | None:
    if denominator <= 0:
        return None
    return numerator / denominator


def _safe_scalar(value: object) -> float | None:
    if value is None:
        return None
    try:
        if isinstance(value, (int, float)):
            numeric = float(value)
        elif isinstance(value, str):
            numeric = float(value)
        else:
            return None
    except (TypeError, ValueError):
        return None
    if not math.isfinite(numeric):
        return None
    return numeric


def _exception_reason(exc: Exception) -> str:
    message = str(exc).strip()
    if message:
        return f"{type(exc).__name__}: {message}"
    return type(exc).__name__
