"""Purpose:
- Build actor relationship metrics and a directed graph for visualization.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

import networkx as nx

from simula.application.analysis.models import (
    ActorEdgeMetrics,
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
) -> tuple[NetworkReport, nx.DiGraph]:
    """Build node and edge metrics for adopted actor interactions."""

    node_state = {
        cast_id: _MutableNodeState(
            cast_id=actor.cast_id,
            display_name=actor.display_name,
        )
        for cast_id, actor in actors_by_id.items()
    }
    edge_state: dict[tuple[str, str], _MutableEdgeState] = {}
    counterparties: dict[str, set[str]] = defaultdict(set)

    for activity in activities:
        source_cast_id = activity.source_cast_id
        if not source_cast_id:
            continue
        _ensure_node(node_state, actors_by_id=actors_by_id, cast_id=source_cast_id)
        node_state[source_cast_id].initiated_actions += 1

        target_cast_ids = _dedupe_ids(activity.target_cast_ids)
        intent_only_cast_ids = [
            cast_id
            for cast_id in _dedupe_ids(activity.intent_target_cast_ids)
            if cast_id not in set(target_cast_ids)
        ]
        for target_cast_id in target_cast_ids:
            if not target_cast_id or target_cast_id == source_cast_id:
                continue
            _ensure_node(node_state, actors_by_id=actors_by_id, cast_id=target_cast_id)
            node_state[source_cast_id].sent_relations += 1
            node_state[target_cast_id].received_relations += 1
            node_state[target_cast_id].received_actions += 1
            counterparties[source_cast_id].add(target_cast_id)
            counterparties[target_cast_id].add(source_cast_id)
            _update_edge(
                edge_state=edge_state,
                actors_by_id=actors_by_id,
                source_cast_id=source_cast_id,
                target_cast_id=target_cast_id,
                activity=activity,
                is_intent_only=False,
            )
        for target_cast_id in intent_only_cast_ids:
            if not target_cast_id or target_cast_id == source_cast_id:
                continue
            _ensure_node(node_state, actors_by_id=actors_by_id, cast_id=target_cast_id)
            node_state[source_cast_id].sent_relations += 1
            node_state[target_cast_id].received_relations += 1
            counterparties[source_cast_id].add(target_cast_id)
            counterparties[target_cast_id].add(source_cast_id)
            _update_edge(
                edge_state=edge_state,
                actors_by_id=actors_by_id,
                source_cast_id=source_cast_id,
                target_cast_id=target_cast_id,
                activity=activity,
                is_intent_only=True,
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
                counterpart_count=len(counterparties.get(item.cast_id, set())),
            )
            for item in node_state.values()
        ),
        key=lambda item: (-item.total_weight, item.display_name, item.cast_id),
    )
    edges = sorted(
        (
            ActorEdgeMetrics(
                source_cast_id=item.source_cast_id,
                source_display_name=item.source_display_name,
                target_cast_id=item.target_cast_id,
                target_display_name=item.target_display_name,
                action_count=item.action_count,
                intent_only_count=item.intent_only_count,
                public_count=item.public_count,
                group_count=item.group_count,
                private_count=item.private_count,
                thread_event_count=item.thread_event_count,
                first_round=item.first_round,
                last_round=item.last_round,
                total_weight=item.action_count + item.intent_only_count,
            )
            for item in edge_state.values()
        ),
        key=lambda item: (
            -item.total_weight,
            item.source_display_name,
            item.target_display_name,
        ),
    )
    summary = NetworkSummary(
        node_count=len(nodes),
        edge_count=len(edges),
        activity_count=len(activities),
        isolated_actor_count=sum(1 for item in nodes if item.total_weight == 0),
        max_edge_weight=max((item.total_weight for item in edges), default=0),
        empty_reason=(
            "채택된 행위자 상호작용이 없습니다."
            if not activities
            else "행위자 간 관계 엣지가 생성되지 않았습니다."
            if not edges
            else None
        ),
    )
    graph = build_network_graph(nodes=nodes, edges=edges)
    return NetworkReport(nodes=nodes, edges=edges, summary=summary), graph


def build_network_graph(
    *,
    nodes: list[ActorNodeMetrics],
    edges: list[ActorEdgeMetrics],
) -> nx.DiGraph:
    """Build a directed graph ready for GraphML export and plotting."""

    graph = nx.DiGraph()
    for node in nodes:
        graph.add_node(
            node.cast_id,
            display_name=node.display_name,
            initiated_actions=node.initiated_actions,
            received_actions=node.received_actions,
            sent_relations=node.sent_relations,
            received_relations=node.received_relations,
            total_weight=node.total_weight,
            counterpart_count=node.counterpart_count,
        )
    for edge in edges:
        graph.add_edge(
            edge.source_cast_id,
            edge.target_cast_id,
            source_display_name=edge.source_display_name,
            target_display_name=edge.target_display_name,
            action_count=edge.action_count,
            intent_only_count=edge.intent_only_count,
            public_count=edge.public_count,
            group_count=edge.group_count,
            private_count=edge.private_count,
            thread_event_count=edge.thread_event_count,
            first_round=edge.first_round,
            last_round=edge.last_round,
            total_weight=edge.total_weight,
        )
    return graph


@dataclass(slots=True)
class _MutableNodeState:
    cast_id: str
    display_name: str
    initiated_actions: int = 0
    received_actions: int = 0
    sent_relations: int = 0
    received_relations: int = 0


@dataclass(slots=True)
class _MutableEdgeState:
    source_cast_id: str
    source_display_name: str
    target_cast_id: str
    target_display_name: str
    action_count: int = 0
    intent_only_count: int = 0
    public_count: int = 0
    group_count: int = 0
    private_count: int = 0
    thread_event_count: int = 0
    first_round: int = 0
    last_round: int = 0


def _ensure_node(
    node_state: dict[str, _MutableNodeState],
    *,
    actors_by_id: dict[str, ActorRecord],
    cast_id: str,
) -> None:
    if cast_id in node_state:
        return
    actor = actors_by_id.get(cast_id)
    display_name = actor.display_name if actor is not None else cast_id
    node_state[cast_id] = _MutableNodeState(cast_id=cast_id, display_name=display_name)


def _update_edge(
    *,
    edge_state: dict[tuple[str, str], _MutableEdgeState],
    actors_by_id: dict[str, ActorRecord],
    source_cast_id: str,
    target_cast_id: str,
    activity: AdoptedActivityRecord,
    is_intent_only: bool,
) -> None:
    edge_key = (source_cast_id, target_cast_id)
    edge = edge_state.setdefault(
        edge_key,
        _MutableEdgeState(
            source_cast_id=source_cast_id,
            source_display_name=_display_name_of(actors_by_id, source_cast_id),
            target_cast_id=target_cast_id,
            target_display_name=_display_name_of(actors_by_id, target_cast_id),
        ),
    )
    if is_intent_only:
        edge.intent_only_count += 1
    else:
        edge.action_count += 1
    if activity.visibility == "public":
        edge.public_count += 1
    elif activity.visibility == "group":
        edge.group_count += 1
    elif activity.visibility == "private":
        edge.private_count += 1
    if activity.thread_id:
        edge.thread_event_count += 1
    if edge.first_round == 0 or activity.round_index < edge.first_round:
        edge.first_round = activity.round_index
    if activity.round_index > edge.last_round:
        edge.last_round = activity.round_index


def _display_name_of(
    actors_by_id: dict[str, ActorRecord],
    cast_id: str,
) -> str:
    actor = actors_by_id.get(cast_id)
    if actor is None:
        return cast_id
    return actor.display_name


def _dedupe_ids(values: list[str]) -> list[str]:
    deduped: list[str] = []
    for value in values:
        if value and value not in deduped:
            deduped.append(value)
    return deduped
