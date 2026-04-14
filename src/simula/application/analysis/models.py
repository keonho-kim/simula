"""Purpose:
- Define typed records used by the JSONL run analyzer.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from simula.application.analysis.localization import (
    call_kind_label,
    metric_label,
    role_label,
)


@dataclass(slots=True)
class LLMCallRecord:
    """Normalized `llm_call` event row."""

    run_id: str
    sequence: int
    role: str
    call_kind: str
    prompt: str
    raw_response: str
    log_context: dict[str, object]
    duration_seconds: float
    ttft_seconds: float | None
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None

    @property
    def scope(self) -> str:
        return str(self.log_context.get("scope", "")).strip()

    def to_row(self) -> dict[str, object]:
        return {
            "run_id": self.run_id,
            "sequence": self.sequence,
            "role": self.role,
            "role_label": role_label(self.role),
            "call_kind": self.call_kind,
            "call_kind_label": call_kind_label(self.call_kind),
            "scope": self.scope,
            "duration_seconds": self.duration_seconds,
            "ttft_seconds": self.ttft_seconds,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
            "log_context": self.log_context,
            "prompt": self.prompt,
            "raw_response": self.raw_response,
        }


@dataclass(slots=True)
class ActorRecord:
    """Minimal actor reference used by relationship analysis."""

    cast_id: str
    display_name: str


@dataclass(slots=True)
class AdoptedActivityRecord:
    """Normalized activity extracted from `round_actions_adopted`."""

    round_index: int
    source_cast_id: str
    target_cast_ids: list[str]
    intent_target_cast_ids: list[str]
    visibility: str
    thread_id: str


@dataclass(slots=True)
class LoadedRunAnalysis:
    """Loaded analyzer input data for one run."""

    run_id: str
    source_path: Path
    event_count: int
    llm_calls: list[LLMCallRecord]
    actors_by_id: dict[str, ActorRecord]
    adopted_activities: list[AdoptedActivityRecord]

    @property
    def roles(self) -> list[str]:
        return sorted({record.role for record in self.llm_calls})


@dataclass(slots=True)
class NumericSummary:
    """Compact numeric summary for one metric series."""

    count: int
    min_value: float | None
    max_value: float | None
    mean_value: float | None
    median_value: float | None
    p95_value: float | None
    p99_value: float | None

    def to_dict(self) -> dict[str, object]:
        return {
            "count": self.count,
            "min": self.min_value,
            "max": self.max_value,
            "mean": self.mean_value,
            "median": self.median_value,
            "p95": self.p95_value,
            "p99": self.p99_value,
        }

    def to_flat_dict(self, *, prefix: str) -> dict[str, object]:
        return {
            f"{prefix}_count": self.count,
            f"{prefix}_min": self.min_value,
            f"{prefix}_max": self.max_value,
            f"{prefix}_mean": self.mean_value,
            f"{prefix}_median": self.median_value,
            f"{prefix}_p95": self.p95_value,
            f"{prefix}_p99": self.p99_value,
        }


@dataclass(slots=True)
class MetricDistribution:
    """Serializable metric distribution artifact."""

    metric: str
    record_count: int
    sample_count: int
    missing_count: int
    min_value: float | None
    max_value: float | None
    mean_value: float | None
    median_value: float | None
    p95_value: float | None
    p99_value: float | None
    histogram_bin_edges: list[float] = field(default_factory=list)
    histogram_counts: list[int] = field(default_factory=list)
    kde_x: list[float] = field(default_factory=list)
    kde_y: list[float] = field(default_factory=list)
    kde_skipped_reason: str | None = None

    def to_dict(self) -> dict[str, object]:
        return {
            "metric": self.metric,
            "metric_label": metric_label(self.metric),
            "record_count": self.record_count,
            "sample_count": self.sample_count,
            "missing_count": self.missing_count,
            "min": self.min_value,
            "max": self.max_value,
            "mean": self.mean_value,
            "median": self.median_value,
            "p95": self.p95_value,
            "p99": self.p99_value,
            "histogram_bin_edges": self.histogram_bin_edges,
            "histogram_counts": self.histogram_counts,
            "kde_x": self.kde_x,
            "kde_y": self.kde_y,
            "kde_skipped_reason": self.kde_skipped_reason,
        }


@dataclass(slots=True)
class DistributionReport:
    """Top-level distribution bundle for artifact writing."""

    overall: dict[str, MetricDistribution]
    by_role: dict[str, dict[str, MetricDistribution]]


@dataclass(slots=True)
class FixerAttemptRecord:
    """One fixer `llm_call` annotated with role attribution."""

    sequence: int
    attempt: int
    attributed_role: str
    schema_name: str
    ttft_seconds: float | None
    duration_seconds: float
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None

    def to_dict(self) -> dict[str, object]:
        return {
            "sequence": self.sequence,
            "attempt": self.attempt,
            "attributed_role": self.attributed_role,
            "attributed_role_label": role_label(self.attributed_role),
            "schema_name": self.schema_name,
            "ttft_seconds": self.ttft_seconds,
            "duration_seconds": self.duration_seconds,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
        }


@dataclass(slots=True)
class FixerSessionRecord:
    """One grouped fixer session starting from attempt 1."""

    session_index: int
    attributed_role: str
    schema_name: str
    attempt_count: int
    retry_count: int
    first_sequence: int
    last_sequence: int
    ttft_seconds: float | None
    duration_seconds: float
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None

    def to_dict(self) -> dict[str, object]:
        return {
            "session_index": self.session_index,
            "attributed_role": self.attributed_role,
            "attributed_role_label": role_label(self.attributed_role),
            "schema_name": self.schema_name,
            "attempt_count": self.attempt_count,
            "retry_count": self.retry_count,
            "first_sequence": self.first_sequence,
            "last_sequence": self.last_sequence,
            "ttft_seconds": self.ttft_seconds,
            "duration_seconds": self.duration_seconds,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
        }


@dataclass(slots=True)
class FixerRoleSummary:
    """Aggregated fixer summary for one attributed role."""

    role: str
    fixer_call_count: int
    session_count: int
    retry_count: int
    ttft: NumericSummary
    duration: NumericSummary

    def to_dict(self) -> dict[str, object]:
        return {
            "role": self.role,
            "role_label": role_label(self.role),
            "fixer_call_count": self.fixer_call_count,
            "session_count": self.session_count,
            "retry_count": self.retry_count,
            "ttft": self.ttft.to_dict(),
            "duration": self.duration.to_dict(),
        }

    def to_row(self) -> dict[str, object]:
        return {
            "role": self.role,
            "role_label": role_label(self.role),
            "fixer_call_count": self.fixer_call_count,
            "session_count": self.session_count,
            "retry_count": self.retry_count,
            **self.ttft.to_flat_dict(prefix="ttft"),
            **self.duration.to_flat_dict(prefix="duration"),
        }


@dataclass(slots=True)
class FixerReport:
    """Serializable fixer analysis bundle."""

    attempts: list[FixerAttemptRecord]
    sessions: list[FixerSessionRecord]
    overall: FixerRoleSummary
    by_role: dict[str, FixerRoleSummary]

    def to_dict(self) -> dict[str, object]:
        return {
            "overall": self.overall.to_dict(),
            "by_role": {
                role: summary.to_dict() for role, summary in sorted(self.by_role.items())
            },
            "sessions": [session.to_dict() for session in self.sessions],
        }

    def summary_rows(self) -> list[dict[str, object]]:
        rows = [self.overall.to_row()]
        rows.extend(self.by_role[role].to_row() for role in sorted(self.by_role))
        return rows


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
    skipped_metrics: dict[str, str] = field(default_factory=dict)
    empty_reason: str | None = None

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
            "leaderboards": {
                key: [entry.to_dict() for entry in entries]
                for key, entries in sorted(self.leaderboards.items())
            },
            "communities": [community.to_dict() for community in self.communities],
        }


@dataclass(slots=True)
class ArtifactManifest:
    """Manifest describing generated analyzer artifacts."""

    run_id: str
    input_path: str
    output_dir: str
    analyzed_at: str
    total_events: int
    llm_call_count: int
    roles: list[str]
    artifact_paths: list[str]
    fixer_summary: dict[str, object]
    network_summary: dict[str, object]

    def to_dict(self) -> dict[str, object]:
        return {
            "run_id": self.run_id,
            "input_path": self.input_path,
            "output_dir": self.output_dir,
            "analyzed_at": self.analyzed_at,
            "total_events": self.total_events,
            "llm_call_count": self.llm_call_count,
            "roles": self.roles,
            "roles_display": [role_label(item) for item in self.roles],
            "artifact_paths": self.artifact_paths,
            "fixer_summary": self.fixer_summary,
            "network_summary": self.network_summary,
        }
