"""Purpose:
- Aggregate adopted activities into network nodes and edges.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field

from simula.application.analysis.models import (
    ActorEdgeMetrics,
    ActorRecord,
    AdoptedActivityRecord,
)


@dataclass(slots=True)
class MutableNodeState:
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
    label_samples: list[str] = field(default_factory=list)


@dataclass(slots=True)
class AggregatedNetworkData:
    node_state: dict[str, MutableNodeState]
    counterparties: dict[str, set[str]]
    edges: list[ActorEdgeMetrics]


def aggregate_relationship_network(
    *,
    actors_by_id: dict[str, ActorRecord],
    activities: list[AdoptedActivityRecord],
) -> AggregatedNetworkData:
    """Aggregate raw adopted activities into deterministic node and edge rows."""

    node_state = {
        cast_id: MutableNodeState(
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
                label_preview=_build_edge_label_preview(item.label_samples),
                label_variant_count=len(item.label_samples),
            )
            for item in edge_state.values()
        ),
        key=lambda item: (
            -item.total_weight,
            item.source_display_name,
            item.target_display_name,
        ),
    )
    return AggregatedNetworkData(
        node_state=node_state,
        counterparties=counterparties,
        edges=edges,
    )


def _ensure_node(
    node_state: dict[str, MutableNodeState],
    *,
    actors_by_id: dict[str, ActorRecord],
    cast_id: str,
) -> None:
    if cast_id in node_state:
        return
    actor = actors_by_id.get(cast_id)
    display_name = actor.display_name if actor is not None else cast_id
    node_state[cast_id] = MutableNodeState(cast_id=cast_id, display_name=display_name)


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
    label_candidate = _activity_label_of(activity)
    if label_candidate and label_candidate not in edge.label_samples:
        edge.label_samples.append(label_candidate)
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


def _activity_label_of(activity: AdoptedActivityRecord) -> str:
    for value in (
        activity.action_summary,
        activity.utterance,
        activity.intent,
        activity.action_type,
    ):
        text = value.strip()
        if text:
            return _truncate_label(text)
    return ""


def _build_edge_label_preview(samples: list[str]) -> str:
    if not samples:
        return ""
    return samples[0]


def _truncate_label(text: str, *, limit: int = 36) -> str:
    compact = " ".join(text.split())
    if len(compact) <= limit:
        return compact
    return compact[: limit - 1].rstrip() + "…"
