"""Stateful runtime agent memory."""

from __future__ import annotations

from typing import Any

from simula.domain.contracts import (
    ActorAgentState,
    ActorIntentSnapshot,
    SimulationPlan,
)
from simula.domain.runtime.policy import build_initial_intent_snapshots


def build_initial_actor_agent_states(
    *,
    actors: list[dict[str, Any]],
    simulation_plan: SimulationPlan,
) -> list[dict[str, Any]]:
    """Build mutable agent state from runtime policies."""

    policy_by_id = {policy.cast_id: policy for policy in simulation_plan.actor_policies}
    states: list[dict[str, Any]] = []
    for actor in actors:
        cast_id = str(actor.get("cast_id", "")).strip()
        if not cast_id:
            continue
        policy = policy_by_id.get(cast_id)
        if policy is None:
            continue
        states.append(
            ActorAgentState(
                cast_id=cast_id,
                current_intent=policy.current_intent,
                relationship_notes=dict(policy.relationship_notes),
                recent_memory=list(policy.recent_memory),
                pressure_level=policy.pressure_level,
                hidden_information=list(policy.hidden_information),
                speech_cooldown=policy.speech_cooldown,
                action_cooldown=policy.action_cooldown,
            ).model_dump(mode="json")
        )
    return states


def agent_state_by_id(
    *,
    actors: list[dict[str, Any]],
    simulation_plan: SimulationPlan,
    current: list[dict[str, Any]],
) -> dict[str, ActorAgentState]:
    current_by_id = {
        str(item.get("cast_id", "")): ActorAgentState.model_validate(item)
        for item in current
        if str(item.get("cast_id", "")).strip()
    }
    policy_by_id = {policy.cast_id: policy for policy in simulation_plan.actor_policies}
    states: dict[str, ActorAgentState] = {}
    for actor in actors:
        cast_id = str(actor.get("cast_id", "")).strip()
        if not cast_id:
            continue
        if cast_id in current_by_id:
            states[cast_id] = current_by_id[cast_id]
            continue
        policy = policy_by_id[cast_id]
        states[cast_id] = ActorAgentState(
            cast_id=cast_id,
            current_intent=policy.current_intent,
            relationship_notes=dict(policy.relationship_notes),
            recent_memory=list(policy.recent_memory),
            pressure_level=policy.pressure_level,
            hidden_information=list(policy.hidden_information),
            speech_cooldown=policy.speech_cooldown,
            action_cooldown=policy.action_cooldown,
        )
    return states


def update_actor_agent_states(
    *,
    actors: list[dict[str, Any]],
    simulation_plan: SimulationPlan,
    current: list[dict[str, Any]],
    scene_beats: list[dict[str, Any]],
    latest_round_activities: list[dict[str, Any]],
    intent_updates: list[dict[str, Any]],
    selected_event: dict[str, Any],
) -> list[dict[str, Any]]:
    states = agent_state_by_id(
        actors=actors,
        simulation_plan=simulation_plan,
        current=current,
    )
    intent_by_id = {
        str(item.get("cast_id", "")): item
        for item in intent_updates
        if str(item.get("cast_id", "")).strip()
    }
    activities_by_beat = {
        str(item.get("beat_id", "")): item for item in latest_round_activities
    }
    acted_ids: set[str] = set()
    for beat in scene_beats:
        source_id = str(beat.get("source_cast_id", ""))
        if source_id not in states:
            continue
        acted_ids.add(source_id)
        state = states[source_id]
        activity = activities_by_beat.get(str(beat.get("beat_id", "")), {})
        memory = _agent_memory_line(
            event_title=str(selected_event.get("title", "")),
            activity=activity,
            beat=beat,
            role="acted",
        )
        states[source_id] = state.model_copy(
            update={
                "current_intent": str(
                    intent_by_id.get(source_id, {}).get(
                        "goal",
                        beat.get("intent", state.current_intent),
                    )
                ),
                "recent_memory": [memory, *state.recent_memory][:4],
                "pressure_level": max(0, min(5, state.pressure_level - 1)),
                "speech_cooldown": (
                    1 if str(beat.get("action_type", "")) == "speech" else 0
                ),
                "action_cooldown": 1,
            }
        )
        for target_id in [str(item) for item in list(beat.get("target_cast_ids", []))]:
            if target_id not in states:
                continue
            target_state = states[target_id]
            target_memory = _agent_memory_line(
                event_title=str(selected_event.get("title", "")),
                activity=activity,
                beat=beat,
                role="received",
            )
            relationships = dict(target_state.relationship_notes)
            relationships[source_id] = str(beat.get("reaction", "")).strip() or (
                "상대의 행동에 대응할 압력이 생겼다."
            )
            states[target_id] = target_state.model_copy(
                update={
                    "relationship_notes": relationships,
                    "recent_memory": [target_memory, *target_state.recent_memory][:4],
                    "pressure_level": min(5, target_state.pressure_level + 1),
                    "speech_cooldown": max(0, target_state.speech_cooldown - 1),
                    "action_cooldown": max(0, target_state.action_cooldown - 1),
                }
            )
    for cast_id, state in list(states.items()):
        if cast_id in acted_ids:
            continue
        states[cast_id] = state.model_copy(
            update={
                "speech_cooldown": max(0, state.speech_cooldown - 1),
                "action_cooldown": max(0, state.action_cooldown - 1),
            }
        )
    return [
        states[str(actor.get("cast_id", ""))].model_dump(mode="json")
        for actor in actors
        if str(actor.get("cast_id", "")) in states
    ]


def merge_actor_intent_states(
    *,
    actors: list[dict[str, Any]],
    current: list[dict[str, Any]],
    updated: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    current_by_id = {
        str(item.get("cast_id", "")): item
        for item in current
        if str(item.get("cast_id", "")).strip()
    }
    updated_by_id = {
        str(item.get("cast_id", "")): ActorIntentSnapshot.model_validate(
            item
        ).model_dump(mode="json")
        for item in updated
        if str(item.get("cast_id", "")).strip()
    }
    merged: list[dict[str, Any]] = []
    for actor in actors:
        cast_id = str(actor.get("cast_id", "")).strip()
        if not cast_id:
            continue
        merged.append(
            updated_by_id.get(cast_id)
            or current_by_id.get(cast_id)
            or build_initial_intent_snapshots([actor])[0]
        )
    return merged


def agent_updates_for_scene(
    *,
    before: list[dict[str, Any]],
    after: list[dict[str, Any]],
    scene_actor_ids: list[str],
) -> list[dict[str, Any]]:
    before_by_id = {str(item.get("cast_id", "")): item for item in before}
    updates: list[dict[str, Any]] = []
    for item in after:
        cast_id = str(item.get("cast_id", ""))
        if cast_id not in scene_actor_ids:
            continue
        previous = before_by_id.get(cast_id, {})
        updates.append(
            {
                "cast_id": cast_id,
                "current_intent": str(item.get("current_intent", "")),
                "pressure_level": int(item.get("pressure_level", 0)),
                "pressure_delta": int(item.get("pressure_level", 0))
                - int(previous.get("pressure_level", item.get("pressure_level", 0))),
                "latest_memory": _string_list(item.get("recent_memory", []))[:2],
            }
        )
    return updates


def scene_agent_state_view(
    *,
    state: list[dict[str, Any]],
    scene_actor_ids: list[str],
) -> list[dict[str, Any]]:
    scene_actor_set = set(scene_actor_ids)
    return [
        {
            "cast_id": str(item.get("cast_id", "")),
            "current_intent": str(item.get("current_intent", "")),
            "pressure_level": int(item.get("pressure_level", 0)),
            "recent_memory": _string_list(item.get("recent_memory", []))[:3],
            "relationship_notes": _dict_value(item.get("relationship_notes", {})),
            "hidden_information": _string_list(item.get("hidden_information", []))[:2],
            "speech_cooldown": int(item.get("speech_cooldown", 0)),
            "action_cooldown": int(item.get("action_cooldown", 0)),
        }
        for item in state
        if str(item.get("cast_id", "")) in scene_actor_set
    ]


def _agent_memory_line(
    *,
    event_title: str,
    activity: dict[str, Any],
    beat: dict[str, Any],
    role: str,
) -> str:
    if role == "acted":
        text = str(activity.get("summary") or beat.get("summary") or "").strip()
        return f"{event_title}: 내가 {text}"
    text = str(beat.get("event_effect") or beat.get("summary") or "").strip()
    source = str(beat.get("source_cast_id", "상대"))
    return f"{event_title}: {source}의 행동으로 {text}"


def _dict_value(value: object) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    return {str(key): item for key, item in value.items()}


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item).strip()]
