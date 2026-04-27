"""Runtime scene event and actor selection."""

from __future__ import annotations

from typing import Any, cast

from simula.domain.contracts import ActorPolicy, SimulationPlan
from simula.domain.event_memory import refresh_event_memory


def select_next_event(
    *,
    simulation_plan: SimulationPlan,
    event_memory: dict[str, Any],
    current_round_index: int,
) -> dict[str, Any] | None:
    """Select the next unresolved event deterministically."""

    refreshed = refresh_event_memory(
        event_memory,
        current_round_index=current_round_index,
    )
    events_by_id = {
        str(event.get("event_id", "")): event
        for event in _dict_list(refreshed.get("events", []))
    }
    queue_order = [item.event_id for item in simulation_plan.event_queue]
    next_ids = [
        str(event_id) for event_id in _object_list(refreshed.get("next_event_ids", []))
    ]
    ordered_ids = [*next_ids, *queue_order]
    seen: set[str] = set()
    for event_id in ordered_ids:
        if event_id in seen:
            continue
        seen.add(event_id)
        event = events_by_id.get(event_id)
        if event is None:
            continue
        if str(event.get("status", "")) in {"completed", "missed"}:
            continue
        return event
    return None


def select_scene_actors(
    *,
    event: dict[str, Any],
    actors: list[dict[str, Any]],
    simulation_plan: SimulationPlan,
) -> list[dict[str, Any]]:
    """Select the small actor set for one scene tick."""

    participants = [
        str(cast_id)
        for cast_id in list(event.get("participant_cast_ids", []))
        if str(cast_id).strip()
    ]
    actor_by_id = {
        str(actor.get("cast_id", "")): actor
        for actor in actors
        if str(actor.get("cast_id", "")).strip()
    }
    policy_by_id = {item.cast_id: item for item in simulation_plan.actor_policies}
    ranked_ids = sorted(
        participants,
        key=lambda cast_id: (
            _policy_rank(policy_by_id.get(cast_id)),
            participants.index(cast_id),
        ),
    )
    selected = [
        actor_by_id[cast_id]
        for cast_id in ranked_ids
        if cast_id in actor_by_id
    ]
    if len(selected) < simulation_plan.runtime_budget.max_scene_actors:
        for actor in actors:
            cast_id = str(actor.get("cast_id", ""))
            if not cast_id or any(
                str(item.get("cast_id", "")) == cast_id for item in selected
            ):
                continue
            selected.append(actor)
            if len(selected) >= simulation_plan.runtime_budget.max_scene_actors:
                break
    return selected[: simulation_plan.runtime_budget.max_scene_actors]


def _policy_rank(policy: ActorPolicy | None) -> int:
    return 0 if policy and policy.priorities else 1


def _dict_list(value: object) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, Any], item) for item in value if isinstance(item, dict)]


def _object_list(value: object) -> list[object]:
    if not isinstance(value, list):
        return []
    return list(value)
