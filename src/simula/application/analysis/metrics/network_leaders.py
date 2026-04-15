"""Purpose:
- Select direct, broker, and influence leaders from network node metrics.
"""

from __future__ import annotations

from dataclasses import dataclass

from simula.application.analysis.models import ActorNodeMetrics


@dataclass(frozen=True)
class NetworkLeader:
    """One selected network leader."""

    cast_id: str
    display_name: str
    score: float | None


def select_top_degree_leader(nodes: list[ActorNodeMetrics]) -> NetworkLeader:
    """Select the actor with the widest direct connection breadth."""

    if not nodes:
        return NetworkLeader(cast_id="", display_name="", score=None)
    winner = max(
        nodes,
        key=lambda item: (
            item.counterpart_count,
            _float_or_default(item.out_degree_centrality),
            _float_or_default(item.in_degree_centrality),
            item.total_weight,
            item.display_name,
            item.cast_id,
        ),
    )
    if winner.counterpart_count <= 0:
        return NetworkLeader(cast_id="", display_name="", score=None)
    return NetworkLeader(
        cast_id=winner.cast_id,
        display_name=winner.display_name,
        score=float(winner.counterpart_count),
    )


def select_top_broker_leader(nodes: list[ActorNodeMetrics]) -> NetworkLeader:
    """Select the strongest brokerage actor."""

    return _select_metric_leader(nodes, metric_name="betweenness_centrality")


def select_top_influence_leader(nodes: list[ActorNodeMetrics]) -> NetworkLeader:
    """Select the strongest indirect influence actor."""

    return _select_metric_leader(nodes, metric_name="pagerank")


def _select_metric_leader(
    nodes: list[ActorNodeMetrics],
    *,
    metric_name: str,
) -> NetworkLeader:
    candidates = [
        item
        for item in nodes
        if isinstance(getattr(item, metric_name), (int, float))
    ]
    if not candidates:
        return NetworkLeader(cast_id="", display_name="", score=None)
    winner = max(
        candidates,
        key=lambda item: (
            _float_or_default(getattr(item, metric_name)),
            item.counterpart_count,
            item.total_weight,
            item.display_name,
            item.cast_id,
        ),
    )
    score = _float_or_default(getattr(winner, metric_name))
    if score <= 0.0:
        return NetworkLeader(cast_id="", display_name="", score=None)
    return NetworkLeader(
        cast_id=winner.cast_id,
        display_name=winner.display_name,
        score=score,
    )


def _float_or_default(value: float | int | None) -> float:
    if value is None:
        return 0.0
    return float(value)


__all__ = [
    "NetworkLeader",
    "select_top_broker_leader",
    "select_top_degree_leader",
    "select_top_influence_leader",
]
