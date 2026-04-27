"""Stateful scene candidate generation."""

from __future__ import annotations

import hashlib
from typing import Any, cast

from simula.application.workflow.graphs.runtime.utils.agent_state import (
    agent_state_by_id,
)
from simula.domain.contracts import (
    ActionCandidate,
    ActionTemplate,
    ActorAgentState,
    ActorPolicy,
    SimulationPlan,
    VisibilityType,
)


def build_action_candidates(
    *,
    event: dict[str, Any],
    scene_actors: list[dict[str, Any]],
    simulation_plan: SimulationPlan,
    max_recipients_per_message: int,
    actor_agent_states: list[dict[str, Any]] | None = None,
    current_round_index: int = 0,
    rng_seed: int | None = None,
) -> list[dict[str, Any]]:
    """Generate stateful agent action candidates for one scene tick."""

    policies = {item.cast_id: item for item in simulation_plan.actor_policies}
    templates = {item.action_type: item for item in simulation_plan.action_templates}
    agent_states = agent_state_by_id(
        actors=scene_actors,
        simulation_plan=simulation_plan,
        current=actor_agent_states or [],
    )
    event_action_types = [
        str(item)
        for item in list(event.get("completion_action_types", []))
        if str(item).strip()
    ]
    participant_ids = [
        str(cast_id)
        for cast_id in list(event.get("participant_cast_ids", []))
        if str(cast_id).strip()
    ]
    ordered_scene_actors = _initiative_ordered_actors(
        event=event,
        scene_actors=scene_actors,
        actor_agent_states=list(agent_states.values()),
        current_round_index=current_round_index,
        rng_seed=rng_seed,
    )
    candidate_pool: list[tuple[int, int, int, ActionCandidate]] = []
    for actor_index, actor in enumerate(ordered_scene_actors):
        source_cast_id = str(actor.get("cast_id", "")).strip()
        policy = policies.get(source_cast_id)
        if policy is None:
            continue
        agent_state = agent_states[source_cast_id]
        action_types = _candidate_action_types(
            allowed_action_types=policy.allowed_action_types,
            event_action_types=event_action_types,
        )
        for action_index, action_type in enumerate(action_types[:2]):
            template = templates.get(action_type)
            if template is None:
                continue
            targets = _candidate_targets(
                source_cast_id=source_cast_id,
                participant_ids=participant_ids,
                policy=policy,
                agent_state=agent_state,
                max_recipients=max_recipients_per_message,
            )
            if template.requires_target and not targets:
                continue
            visibility = _candidate_visibility(template, targets)
            initiative_score = _candidate_initiative_score(
                event=event,
                cast_id=source_cast_id,
                action_type=action_type,
                agent_state=agent_state,
                action_index=action_index,
                current_round_index=current_round_index,
                rng_seed=rng_seed,
            )
            candidate_pool.append(
                (
                    initiative_score,
                    actor_index,
                    action_index,
                    ActionCandidate(
                        candidate_id="C0",
                        event_id=str(event.get("event_id", "")),
                        source_cast_id=source_cast_id,
                        target_cast_ids=targets,
                        action_type=action_type,
                        visibility=cast(VisibilityType, visibility),
                        goal=agent_state.current_intent,
                        summary=_candidate_summary(
                            actor=actor,
                            event=event,
                            template=template,
                        ),
                        detail=_candidate_detail(
                            actor=actor,
                            event=event,
                            template=template,
                            agent_state=agent_state,
                        ),
                        utterance="",
                        intent=agent_state.current_intent,
                        stakes=_candidate_stakes(event, agent_state),
                        expected_effect=_candidate_expected_effect(
                            event=event,
                            action_type=action_type,
                        ),
                        risk=_candidate_risk(action_type, agent_state),
                        target_reason=_candidate_target_reason(targets, agent_state),
                        initiative_score=initiative_score,
                    ),
                )
            )
    candidate_pool.sort(key=lambda item: (-item[0], item[1], item[2]))
    selected = candidate_pool[: simulation_plan.runtime_budget.max_candidates]
    return [
        candidate.model_copy(update={"candidate_id": f"C{index}"}).model_dump(
            mode="json"
        )
        for index, (_, _, _, candidate) in enumerate(selected, start=1)
    ]


def _initiative_ordered_actors(
    *,
    event: dict[str, Any],
    scene_actors: list[dict[str, Any]],
    actor_agent_states: list[ActorAgentState],
    current_round_index: int,
    rng_seed: int | None,
) -> list[dict[str, Any]]:
    state_by_id = {state.cast_id: state for state in actor_agent_states}
    event_id = str(event.get("event_id", ""))
    scored: list[tuple[int, int, dict[str, Any]]] = []
    for index, actor in enumerate(scene_actors):
        cast_id = str(actor.get("cast_id", ""))
        agent_state = state_by_id.get(cast_id)
        pressure = agent_state.pressure_level if agent_state is not None else 0
        cooldown = (
            (agent_state.speech_cooldown + agent_state.action_cooldown)
            if agent_state is not None
            else 0
        )
        seed_value = rng_seed if rng_seed is not None else 0
        jitter = int(
            hashlib.sha256(
                f"{seed_value}:{current_round_index}:{event_id}:{cast_id}".encode(
                    "utf-8"
                )
            ).hexdigest()[:6],
            16,
        )
        score = pressure * 1_000_000 - cooldown * 100_000 + jitter
        scored.append((score, index, actor))
    scored.sort(key=lambda item: (-item[0], item[1]))
    return [actor for _, _, actor in scored]


def _candidate_initiative_score(
    *,
    event: dict[str, Any],
    cast_id: str,
    action_type: str,
    agent_state: ActorAgentState,
    action_index: int,
    current_round_index: int,
    rng_seed: int | None,
) -> int:
    seed_value = rng_seed if rng_seed is not None else 0
    event_id = str(event.get("event_id", ""))
    jitter = int(
        hashlib.sha256(
            f"{seed_value}:{current_round_index}:{event_id}:{cast_id}:{action_type}".encode(
                "utf-8"
            )
        ).hexdigest()[:6],
        16,
    )
    event_match = (
        20
        if action_type in _string_list(event.get("completion_action_types", []))
        else 0
    )
    cooldown_penalty = (
        8 if action_type == "speech" and agent_state.speech_cooldown else 0
    )
    cooldown_penalty += 5 if agent_state.action_cooldown else 0
    return (
        agent_state.pressure_level * 20
        + event_match
        - cooldown_penalty
        - action_index * 3
        + jitter % 17
        + len(event_id) % 5
    )


def _candidate_action_types(
    *,
    allowed_action_types: list[str],
    event_action_types: list[str],
) -> list[str]:
    ordered: list[str] = []
    for action_type in event_action_types:
        if action_type in allowed_action_types:
            ordered.append(action_type)
    for action_type in allowed_action_types:
        if action_type not in ordered:
            ordered.append(action_type)
    return ordered or ["speech"]


def _candidate_targets(
    *,
    source_cast_id: str,
    participant_ids: list[str],
    policy: ActorPolicy,
    agent_state: ActorAgentState,
    max_recipients: int,
) -> list[str]:
    relationship_ids = [
        cast_id
        for cast_id, note in agent_state.relationship_notes.items()
        if cast_id != source_cast_id and str(note).strip()
    ]
    ordered = relationship_ids + [
        cast_id for cast_id in participant_ids if cast_id != source_cast_id
    ] + [
        cast_id
        for cast_id in policy.preferred_target_cast_ids
        if cast_id != source_cast_id
    ]
    unique: list[str] = []
    for cast_id in ordered:
        if cast_id not in unique:
            unique.append(cast_id)
    return unique[:max_recipients]


def _candidate_summary(
    *,
    actor: dict[str, Any],
    event: dict[str, Any],
    template: ActionTemplate,
) -> str:
    return (
        f"{str(actor.get('display_name', actor.get('cast_id', 'Actor')))} uses "
        f"{template.label} inside {str(event.get('title', 'the current event'))}."
    )


def _candidate_detail(
    *,
    actor: dict[str, Any],
    event: dict[str, Any],
    template: ActionTemplate,
    agent_state: ActorAgentState,
) -> str:
    memory = agent_state.recent_memory[0] if agent_state.recent_memory else "no prior beat"
    return (
        f"{str(actor.get('display_name', actor.get('cast_id', 'Actor')))} acts from "
        f"intent `{agent_state.current_intent}` using {template.label}; recent memory: {memory}; "
        f"event pressure: {str(event.get('title', 'the current event'))}."
    )


def _candidate_stakes(event: dict[str, Any], agent_state: ActorAgentState) -> str:
    signal = _string_list(event.get("completion_signals", []))
    goal = signal[0] if signal else str(event.get("title", "the event"))
    return f"pressure={agent_state.pressure_level}/5; unresolved signal: {goal}"


def _candidate_expected_effect(
    *,
    event: dict[str, Any],
    action_type: str,
) -> str:
    return (
        f"{action_type} should create observable movement in "
        f"{str(event.get('title', 'the selected event'))}."
    )


def _candidate_risk(action_type: str, agent_state: ActorAgentState) -> str:
    cooldown = (
        agent_state.speech_cooldown
        if action_type == "speech"
        else agent_state.action_cooldown
    )
    if cooldown:
        return "The actor risks repeating themselves before the room is ready."
    if agent_state.hidden_information:
        return "The actor may expose private leverage or reveal a hidden agenda."
    return "The move may invite a direct counteraction."


def _candidate_target_reason(
    targets: list[str],
    agent_state: ActorAgentState,
) -> str:
    if not targets:
        return "The actor addresses the room or situation rather than one target."
    notes = [
        f"{target}: {agent_state.relationship_notes.get(target, 'event participant')}"
        for target in targets
    ]
    return "; ".join(notes)


def _candidate_visibility(
    template: ActionTemplate,
    targets: list[str],
) -> str:
    supported = list(template.supported_visibility)
    if targets and "group" in supported and len(targets) > 1:
        return "group"
    if targets and "private" in supported:
        return "private"
    if "public" in supported:
        return "public"
    return supported[0]


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item).strip()]
