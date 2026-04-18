"""Network analyzer models."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(slots=True)
class ActorNodeMetrics:
    """Per-actor node metrics for the relationship graph."""

    cast_id: str
    display_name: str
    initiated_actions: int
    received_actions: int
    sent_relations: int
    received_relations: int
    total_weight: int
    counterpart_count: int
    sent_action_counts: dict[str, int] = field(default_factory=dict)
    received_action_counts: dict[str, int] = field(default_factory=dict)
    in_degree_centrality: float | None = None
    out_degree_centrality: float | None = None
    betweenness_centrality: float | None = None
    hub_score: float | None = None
    authority_score: float | None = None
    pagerank: float | None = None
    core_number: int | None = None
    effective_size: float | None = None

    def to_row(self) -> dict[str, object]:
        return {
            "cast_id": self.cast_id,
            "display_name": self.display_name,
            "initiated_actions": self.initiated_actions,
            "received_actions": self.received_actions,
            "sent_relations": self.sent_relations,
            "received_relations": self.received_relations,
            "total_weight": self.total_weight,
            "counterpart_count": self.counterpart_count,
            "in_degree_centrality": self.in_degree_centrality,
            "out_degree_centrality": self.out_degree_centrality,
            "betweenness_centrality": self.betweenness_centrality,
            "hub_score": self.hub_score,
            "authority_score": self.authority_score,
            "pagerank": self.pagerank,
            "core_number": self.core_number,
            "effective_size": self.effective_size,
        }


@dataclass(slots=True)
class ActorEdgeMetrics:
    """Per-edge metrics for actor interaction relationships."""

    source_cast_id: str
    source_display_name: str
    target_cast_id: str
    target_display_name: str
    action_count: int
    intent_only_count: int
    public_count: int
    group_count: int
    private_count: int
    thread_event_count: int
    first_round: int
    last_round: int
    total_weight: int
    label_preview: str = ""
    label_variant_count: int = 0

    def to_row(self) -> dict[str, object]:
        return {
            "source_cast_id": self.source_cast_id,
            "source_display_name": self.source_display_name,
            "target_cast_id": self.target_cast_id,
            "target_display_name": self.target_display_name,
            "action_count": self.action_count,
            "intent_only_count": self.intent_only_count,
            "public_count": self.public_count,
            "group_count": self.group_count,
            "private_count": self.private_count,
            "thread_event_count": self.thread_event_count,
            "first_round": self.first_round,
            "last_round": self.last_round,
            "total_weight": self.total_weight,
            "label_preview": self.label_preview,
            "label_variant_count": self.label_variant_count,
        }


@dataclass(slots=True)
class NetworkBenchmarkMetrics:
    """Benchmark-oriented network metrics for cross-run comparison."""

    participation_entropy: float | None = None
    action_type_diversity: float | None = None
    density: float | None = None
    average_path_depth: float | None = None
    network_diameter: int | None = None
    centralization: float | None = None
    community_count: int = 0
    modularity: float | None = None
    mean_edge_growth_rate: float | None = None
    mean_active_actor_growth_rate: float | None = None
    top20_interaction_share: float | None = None

    def to_dict(self) -> dict[str, object]:
        return {
            "participation_entropy": self.participation_entropy,
            "action_type_diversity": self.action_type_diversity,
            "density": self.density,
            "average_path_depth": self.average_path_depth,
            "network_diameter": self.network_diameter,
            "centralization": self.centralization,
            "community_count": self.community_count,
            "modularity": self.modularity,
            "mean_edge_growth_rate": self.mean_edge_growth_rate,
            "mean_active_actor_growth_rate": self.mean_active_actor_growth_rate,
            "top20_interaction_share": self.top20_interaction_share,
        }


@dataclass(slots=True)
class NetworkSummary:
    """Top-level actor network summary."""

    node_count: int
    edge_count: int
    activity_count: int
    total_actor_count: int
    participating_actor_count: int
    participating_actor_ratio: float | None
    isolated_actor_count: int
    isolated_actor_ratio: float | None
    max_edge_weight: int
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
    community_count: int
    benchmark_metrics: NetworkBenchmarkMetrics = field(default_factory=NetworkBenchmarkMetrics)
    skipped_metrics: dict[str, str] = field(default_factory=dict)
    empty_reason: str | None = None
    input_warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, object]:
        return {
            "node_count": self.node_count,
            "edge_count": self.edge_count,
            "activity_count": self.activity_count,
            "total_actor_count": self.total_actor_count,
            "participating_actor_count": self.participating_actor_count,
            "participating_actor_ratio": self.participating_actor_ratio,
            "isolated_actor_count": self.isolated_actor_count,
            "isolated_actor_ratio": self.isolated_actor_ratio,
            "max_edge_weight": self.max_edge_weight,
            "density": self.density,
            "weak_component_count": self.weak_component_count,
            "strong_component_count": self.strong_component_count,
            "largest_weak_component_size": self.largest_weak_component_size,
            "largest_weak_component_ratio": self.largest_weak_component_ratio,
            "largest_strong_component_size": self.largest_strong_component_size,
            "largest_strong_component_ratio": self.largest_strong_component_ratio,
            "reciprocity": self.reciprocity,
            "average_clustering": self.average_clustering,
            "transitivity": self.transitivity,
            "max_core_number": self.max_core_number,
            "community_count": self.community_count,
            "skipped_metrics": dict(sorted(self.skipped_metrics.items())),
            "empty_reason": self.empty_reason,
            "input_warnings": list(self.input_warnings),
        }


@dataclass(slots=True)
class NetworkLeaderboardEntry:
    """One leaderboard row for a network metric."""

    cast_id: str
    display_name: str
    score: float

    def to_dict(self) -> dict[str, object]:
        return {
            "cast_id": self.cast_id,
            "display_name": self.display_name,
            "score": self.score,
        }


@dataclass(slots=True)
class NetworkCommunitySummary:
    """Serializable community summary for the undirected projection."""

    community_index: int
    actor_count: int
    internal_weight: float
    member_cast_ids: list[str]
    member_display_names: list[str]

    def to_dict(self) -> dict[str, object]:
        return {
            "community_index": self.community_index,
            "actor_count": self.actor_count,
            "internal_weight": self.internal_weight,
            "member_cast_ids": self.member_cast_ids,
            "member_display_names": self.member_display_names,
        }


@dataclass(slots=True)
class NetworkReport:
    """Serializable actor network bundle."""

    nodes: list[ActorNodeMetrics]
    edges: list[ActorEdgeMetrics]
    summary: NetworkSummary
    leaderboards: dict[str, list[NetworkLeaderboardEntry]] = field(default_factory=dict)
    communities: list[NetworkCommunitySummary] = field(default_factory=list)

    def to_dict(self) -> dict[str, object]:
        return {
            "summary": self.summary.to_dict(),
            "benchmark_metrics": self.summary.benchmark_metrics.to_dict(),
            "leaderboards": {
                key: [entry.to_dict() for entry in entries]
                for key, entries in sorted(self.leaderboards.items())
            },
            "communities": [community.to_dict() for community in self.communities],
        }


@dataclass(slots=True)
class NetworkGrowthRecord:
    """One cumulative round snapshot for network growth analysis."""

    round_index: int
    cumulative_activity_count: int
    participating_actor_count: int
    edge_count: int
    largest_component_ratio: float | None
    density: float | None
    top1_actor_share: float | None
    top3_actor_share: float | None
    actor_weight_hhi: float | None
    actor_weight_gini: float | None
    top1_edge_share: float | None
    top3_edge_share: float | None
    edge_weight_hhi: float | None
    edge_weight_gini: float | None
    new_actor_count: int
    new_edge_count: int
    average_path_depth: float | None = None
    edge_growth_rate: float | None = None
    active_actor_growth_rate: float | None = None
    top20_interaction_share: float | None = None
    top_degree_cast_id: str = ""
    top_degree_display_name: str = ""
    top_degree_score: float | None = None
    top_broker_cast_id: str = ""
    top_broker_display_name: str = ""
    top_broker_score: float | None = None
    top_influence_cast_id: str = ""
    top_influence_display_name: str = ""
    top_influence_score: float | None = None

    def to_row(self) -> dict[str, object]:
        return {
            "round_index": self.round_index,
            "cumulative_activity_count": self.cumulative_activity_count,
            "participating_actor_count": self.participating_actor_count,
            "edge_count": self.edge_count,
            "largest_component_ratio": self.largest_component_ratio,
            "density": self.density,
            "average_path_depth": self.average_path_depth,
            "edge_growth_rate": self.edge_growth_rate,
            "active_actor_growth_rate": self.active_actor_growth_rate,
            "top20_interaction_share": self.top20_interaction_share,
            "top1_actor_share": self.top1_actor_share,
            "top3_actor_share": self.top3_actor_share,
            "actor_weight_hhi": self.actor_weight_hhi,
            "actor_weight_gini": self.actor_weight_gini,
            "top1_edge_share": self.top1_edge_share,
            "top3_edge_share": self.top3_edge_share,
            "edge_weight_hhi": self.edge_weight_hhi,
            "edge_weight_gini": self.edge_weight_gini,
            "new_actor_count": self.new_actor_count,
            "new_edge_count": self.new_edge_count,
            "top_degree_cast_id": self.top_degree_cast_id,
            "top_degree_display_name": self.top_degree_display_name,
            "top_degree_score": self.top_degree_score,
            "top_broker_cast_id": self.top_broker_cast_id,
            "top_broker_display_name": self.top_broker_display_name,
            "top_broker_score": self.top_broker_score,
            "top_influence_cast_id": self.top_influence_cast_id,
            "top_influence_display_name": self.top_influence_display_name,
            "top_influence_score": self.top_influence_score,
        }


@dataclass(slots=True)
class NetworkGrowthReport:
    """Cumulative network growth series and reusable summary facts."""

    rows: list[NetworkGrowthRecord]
    empty_reason: str | None = None

    @property
    def final_row(self) -> NetworkGrowthRecord | None:
        if not self.rows:
            return None
        return self.rows[-1]
