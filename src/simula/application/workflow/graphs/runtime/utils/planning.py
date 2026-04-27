"""Runtime plan builders."""

from __future__ import annotations

from typing import Any, cast

from simula.domain.contracts import (
    ActionCatalog,
    ActionTemplate,
    ActorPolicy,
    EventQueueItem,
    RuntimeBudget,
    SimulationPlan,
    SymbolTable,
    VisibilityType,
)


def build_simulation_plan(
    *,
    plan: dict[str, Any],
    actors: list[dict[str, Any]],
    max_rounds: int,
    max_recipients_per_message: int,
    max_scene_actors: int,
    max_scene_candidates: int,
    max_scene_beats: int,
) -> SimulationPlan:
    """Build the runtime-ready plan from planner/generator output."""

    major_events = build_runtime_major_events(
        plan=plan,
        actors=actors,
        max_rounds=max_rounds,
    )
    action_catalog = _normalized_action_catalog(plan)
    action_items = list(action_catalog.get("actions", []))
    symbol_table = SymbolTable(
        actors={
            str(actor["cast_id"]): f"A{index}"
            for index, actor in enumerate(actors, start=1)
        },
        events={
            str(event["event_id"]): f"E{index}"
            for index, event in enumerate(major_events, start=1)
        },
        actions={
            str(action["action_type"]): f"T{index}"
            for index, action in enumerate(action_items, start=1)
        },
    )
    all_action_types = [str(action["action_type"]) for action in action_items]
    return SimulationPlan(
        symbol_table=symbol_table,
        actor_policies=[
            _actor_policy(
                actor=actor,
                symbol=symbol_table.actors[str(actor["cast_id"])],
                actors=actors,
                all_action_types=all_action_types,
                max_recipients=max_recipients_per_message,
            )
            for actor in actors
        ],
        event_queue=[
            EventQueueItem(
                event_id=str(event["event_id"]),
                symbol=symbol_table.events[str(event["event_id"])],
                title=str(event["title"]),
                status="pending",
                participant_cast_ids=[
                    str(cast_id)
                    for cast_id in list(event.get("participant_cast_ids", []))
                ],
                must_resolve=bool(event.get("must_resolve", False)),
                earliest_round=int(event.get("earliest_round", 1)),
                latest_round=int(event.get("latest_round", max_rounds)),
            )
            for event in major_events
        ],
        action_templates=[
            ActionTemplate(
                action_type=str(action["action_type"]),
                symbol=symbol_table.actions[str(action["action_type"])],
                label=str(action.get("label", action["action_type"])),
                description=str(action.get("description", action["action_type"])),
                supported_visibility=[
                    cast(VisibilityType, visibility)
                    for visibility in _object_list(
                        action.get("supported_visibility", [])
                    )
                ],
                requires_target=bool(action.get("requires_target", False)),
            )
            for action in action_items
        ],
        runtime_budget=RuntimeBudget(
            max_scene_actors=max_scene_actors,
            max_candidates=max_scene_candidates,
            max_scene_beats=max_scene_beats,
            runtime_narrative=False,
        ),
    )


def build_runtime_major_events(
    *,
    plan: dict[str, Any],
    actors: list[dict[str, Any]],
    max_rounds: int,
) -> list[dict[str, Any]]:
    major_events = _dict_list(plan.get("major_events", []))
    if major_events:
        return major_events
    cast_ids = [
        str(actor.get("cast_id", ""))
        for actor in actors
        if str(actor.get("cast_id", ""))
    ]
    action_catalog = _normalized_action_catalog(plan)
    action_types = [
        str(item.get("action_type", ""))
        for item in _dict_list(action_catalog.get("actions", []))
        if str(item.get("action_type", "")).strip()
    ]
    return [
        {
            "event_id": "evt-main",
            "title": "Primary simulation pressure",
            "summary": str(
                dict(plan.get("situation", {})).get(
                    "simulation_objective",
                    "The main scenario pressure advances.",
                )
            ),
            "participant_cast_ids": cast_ids or ["cast-1"],
            "earliest_round": 1,
            "latest_round": max_rounds,
            "completion_action_types": action_types[:2] or ["speech"],
            "completion_signals": ["decision", "commitment", "response"],
            "must_resolve": True,
        }
    ]


def _normalized_action_catalog(plan: dict[str, Any]) -> dict[str, Any]:
    raw_catalog = dict(plan.get("action_catalog", {}) or {})
    raw_actions = _dict_list(raw_catalog.get("actions", []))
    if raw_actions:
        return ActionCatalog.model_validate({"actions": raw_actions}).model_dump(
            mode="json"
        )
    return {
        "actions": [
            {
                "action_type": "speech",
                "label": "Direct speech",
                "description": "Use a direct statement to move the scene.",
                "supported_visibility": ["public", "private", "group"],
                "requires_target": False,
            }
        ]
    }


def _actor_policy(
    *,
    actor: dict[str, Any],
    symbol: str,
    actors: list[dict[str, Any]],
    all_action_types: list[str],
    max_recipients: int,
) -> ActorPolicy:
    cast_id = str(actor.get("cast_id", "")).strip()
    preferred = [
        str(action_type)
        for action_type in list(actor.get("preferred_action_types", []))
        if str(action_type) in set(all_action_types)
    ]
    other_cast_ids = [
        str(item.get("cast_id", ""))
        for item in actors
        if str(item.get("cast_id", "")) and str(item.get("cast_id", "")) != cast_id
    ]
    priorities = [
        str(actor.get("private_goal", "")).strip(),
        str(actor.get("narrative_profile", "")).strip(),
        str(actor.get("core_tension", "")).strip(),
    ]
    priorities = [item for item in priorities if item]
    current_intent = priorities[0] if priorities else "Advance the selected event."
    return ActorPolicy(
        cast_id=cast_id,
        symbol=symbol,
        priorities=priorities or ["Advance the selected event."],
        preferred_target_cast_ids=other_cast_ids[:max_recipients],
        allowed_action_types=preferred or all_action_types or ["speech"],
        trigger_rules=[
            "Act when the selected event names this actor or their preferred target.",
            "Prefer concrete movement over narrative explanation.",
        ],
        current_intent=current_intent,
        relationship_notes={
            other_id: "관계 압력은 아직 장면 안에서 확정되지 않았다."
            for other_id in other_cast_ids[:max_recipients]
        },
        recent_memory=[],
        pressure_level=2,
        hidden_information=[current_intent],
        speech_cooldown=0,
        action_cooldown=0,
    )


def _dict_list(value: object) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, Any], item) for item in value if isinstance(item, dict)]


def _object_list(value: object) -> list[object]:
    if not isinstance(value, list):
        return []
    return list(value)
