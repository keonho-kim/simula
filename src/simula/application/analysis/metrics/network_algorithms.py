"""Purpose:
- Compute network complexity metrics and leaderboard summaries.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import networkx as nx

from simula.application.analysis.models import (
    ActorNodeMetrics,
    AdoptedActivityRecord,
    NetworkCommunitySummary,
    NetworkLeaderboardEntry,
)

_NO_EDGE_REASON = "연결 엣지가 없어 계산할 수 없습니다."
_NO_ACTIVITY_REASON = "채택된 액션이 없어 계산할 수 없습니다."
_NO_PATH_REASON = "도달 가능한 경로가 없어 계산할 수 없습니다."


@dataclass(slots=True)
class ComputedNetworkMetrics:
    participating_actor_count: int
    participating_actor_ratio: float | None
    isolated_actor_count: int
    isolated_actor_ratio: float | None
    participation_entropy: float | None
    action_type_diversity: float | None
    density: float | None
    average_path_depth: float | None
    network_diameter: int | None
    centralization: float | None
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
    modularity: float | None
    top20_interaction_share: float | None
    communities: list[NetworkCommunitySummary]
    skipped_metrics: dict[str, str]


def compute_network_metrics(
    *,
    directed_graph: nx.DiGraph,
    undirected_graph: nx.Graph,
    total_actor_count: int,
    activities: list[AdoptedActivityRecord],
    planned_action_types: set[str] | None = None,
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
    participation_entropy = _compute_participation_entropy(
        activities=activities,
        total_actor_count=total_actor_count,
        skipped_metrics=skipped_metrics,
    )
    action_type_diversity = _compute_action_type_diversity(
        activities=activities,
        planned_action_types=planned_action_types or set(),
        skipped_metrics=skipped_metrics,
    )
    density = _safe_scalar(nx.density(directed_graph))
    average_path_depth, network_diameter = _compute_path_metrics(
        directed_graph=directed_graph,
        skipped_metrics=skipped_metrics,
    )
    centralization = _compute_centralization(directed_graph=directed_graph)
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
    modularity: float | None = None
    top20_interaction_share = _compute_top20_interaction_share(directed_graph=directed_graph)
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
        communities, modularity = _compute_communities(
            undirected_graph=undirected_graph,
            skipped_metrics=skipped_metrics,
        )

    return ComputedNetworkMetrics(
        participating_actor_count=participating_actor_count,
        participating_actor_ratio=_ratio(participating_actor_count, total_actor_count),
        isolated_actor_count=isolated_actor_count,
        isolated_actor_ratio=_ratio(isolated_actor_count, total_actor_count),
        participation_entropy=participation_entropy,
        action_type_diversity=action_type_diversity,
        density=density,
        average_path_depth=average_path_depth,
        network_diameter=network_diameter,
        centralization=centralization,
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
        modularity=modularity,
        top20_interaction_share=top20_interaction_share,
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


def _compute_participation_entropy(
    *,
    activities: list[AdoptedActivityRecord],
    total_actor_count: int,
    skipped_metrics: dict[str, str],
) -> float | None:
    source_counts: dict[str, int] = {}
    for activity in activities:
        source_cast_id = activity.source_cast_id.strip()
        if not source_cast_id:
            continue
        source_counts[source_cast_id] = source_counts.get(source_cast_id, 0) + 1
    total = sum(source_counts.values())
    if total <= 0:
        skipped_metrics["participation_entropy"] = _NO_ACTIVITY_REASON
        return None
    entropy_raw = -sum(
        (count / total) * math.log(count / total)
        for count in source_counts.values()
        if count > 0
    )
    denominator = math.log(max(total_actor_count, 2))
    if denominator <= 0:
        return None
    return entropy_raw / denominator


def _compute_action_type_diversity(
    *,
    activities: list[AdoptedActivityRecord],
    planned_action_types: set[str],
    skipped_metrics: dict[str, str],
) -> float | None:
    observed_counts: dict[str, int] = {}
    for activity in activities:
        action_type = activity.action_type.strip()
        if not action_type:
            continue
        observed_counts[action_type] = observed_counts.get(action_type, 0) + 1
    observed_total = sum(observed_counts.values())
    if observed_total <= 0:
        skipped_metrics["action_type_diversity"] = _NO_ACTIVITY_REASON
        return None
    entropy_raw = -sum(
        (count / observed_total) * math.log(count / observed_total)
        for count in observed_counts.values()
        if count > 0
    )
    action_space_size = len(planned_action_types) if planned_action_types else len(observed_counts)
    denominator = math.log(max(action_space_size, 2))
    if denominator <= 0:
        return None
    return entropy_raw / denominator


def _compute_path_metrics(
    *,
    directed_graph: nx.DiGraph,
    skipped_metrics: dict[str, str],
) -> tuple[float | None, int | None]:
    path_lengths: list[int] = []
    for source, lengths in nx.all_pairs_shortest_path_length(directed_graph):
        del source
        path_lengths.extend(
            distance
            for target, distance in lengths.items()
            if distance > 0 and target is not None
        )
    if not path_lengths:
        skipped_metrics["average_path_depth"] = _NO_PATH_REASON
        skipped_metrics["network_diameter"] = _NO_PATH_REASON
        return None, None
    return sum(path_lengths) / len(path_lengths), max(path_lengths)


def _compute_centralization(
    *,
    directed_graph: nx.DiGraph,
) -> float | None:
    node_count = directed_graph.number_of_nodes()
    if node_count == 0:
        return None
    degrees = [int(directed_graph.in_degree(node) + directed_graph.out_degree(node)) for node in directed_graph.nodes()]
    if not degrees:
        return None
    max_degree = max(degrees)
    numerator = sum(max_degree - degree for degree in degrees)
    denominator = max((node_count - 1) * (node_count - 2), 1)
    return numerator / denominator


def _compute_top20_interaction_share(
    *,
    directed_graph: nx.DiGraph,
) -> float | None:
    weights = sorted(
        [
            float(attrs.get("total_weight", 0.0))
            for _, attrs in directed_graph.nodes(data=True)
            if float(attrs.get("total_weight", 0.0)) > 0.0
        ],
        reverse=True,
    )
    if not weights:
        return None
    participating_actor_count = len(weights)
    limit = max(1, math.ceil(participating_actor_count * 0.2))
    total = sum(weights)
    if total <= 0:
        return None
    return sum(weights[:limit]) / total


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
) -> tuple[list[NetworkCommunitySummary], float | None]:
    try:
        communities = nx.community.greedy_modularity_communities(
            undirected_graph,
            weight="total_weight",
        )
    except Exception as exc:  # pragma: no cover - exercised through tests via patched functions
        skipped_metrics["community_detection"] = _exception_reason(exc)
        skipped_metrics["modularity"] = skipped_metrics["community_detection"]
        return [], None
    modularity = _compute_modularity(
        undirected_graph=undirected_graph,
        communities=[set(community) for community in communities],
        skipped_metrics=skipped_metrics,
    )
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
    return summaries, modularity


def _compute_modularity(
    *,
    undirected_graph: nx.Graph,
    communities: list[set[str]],
    skipped_metrics: dict[str, str],
) -> float | None:
    try:
        return _safe_scalar(
            nx.community.modularity(
                undirected_graph,
                communities,
                weight="total_weight",
            )
        )
    except Exception as exc:  # pragma: no cover - exercised through tests via patched functions
        skipped_metrics["modularity"] = _exception_reason(exc)
        return None


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
