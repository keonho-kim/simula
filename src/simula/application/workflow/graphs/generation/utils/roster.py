"""Actor roster generation helpers."""

from __future__ import annotations

from typing import cast

from langgraph.types import Send

from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import ActorRosterBundle


def dispatch_actor_roster_chunks(state: SimulationWorkflowState) -> list[Send] | str:
    """Fan out actor roster chunks only when parallel graph execution is used."""

    chunks = list(state.get("pending_actor_roster_chunks", []))
    if not chunks:
        return "finalize_actor_roster"
    return [
        Send(
            "generate_actor_roster_chunk",
            {
                "run_id": state["run_id"],
                "scenario_controls": state["scenario_controls"],
                "plan": state["plan"],
                "actor_roster_chunk": chunk,
            },
        )
        for chunk in chunks
    ]


def route_actor_roster_chunk_queue(state: SimulationWorkflowState) -> str:
    """Route the serial actor roster chunk queue."""

    if list(state.get("pending_actor_roster_chunks", [])):
        return "generate_actor_roster_chunk_serial"
    return "finalize_actor_roster"


def validate_actor_roster_bundle(
    bundle: ActorRosterBundle,
    *,
    cast_items: list[dict[str, object]],
    valid_action_types: set[str] | None = None,
) -> list[str]:
    """Return semantic issues for a generated actor bundle."""

    expected_ids = [str(item.get("cast_id", "")) for item in cast_items]
    actual_ids = [actor.cast_id for actor in bundle.actors]
    issues: list[str] = []
    if actual_ids != expected_ids:
        issues.append("actors must match assigned cast_id order exactly.")
    expected_names = {
        str(item.get("cast_id", "")): str(item.get("display_name", ""))
        for item in cast_items
    }
    for actor in bundle.actors:
        if actor.display_name != expected_names.get(actor.cast_id, actor.display_name):
            issues.append(f"actor `{actor.cast_id}` display_name changed.")
        for action_type in actor.preferred_action_types:
            if valid_action_types is not None and action_type not in valid_action_types:
                issues.append(
                    f"actor `{actor.cast_id}` preferred_action_types contains "
                    f"unknown action_type `{action_type}`."
                )
    return issues


def slot_index(cast_items: list[dict[str, object]], cast_id: str) -> int:
    for index, item in enumerate(cast_items, start=1):
        if str(item.get("cast_id", "")) == cast_id:
            return int(str(item.get("slot_index", index)))
    return 0


def object_list(value: object) -> list[object]:
    if not isinstance(value, list):
        return []
    return list(value)


def valid_action_types(plan: dict[str, object]) -> set[str]:
    action_catalog_value = plan.get("action_catalog")
    if not isinstance(action_catalog_value, dict):
        return set()
    action_catalog = cast(dict[str, object], action_catalog_value)
    actions = action_catalog.get("actions")
    if not isinstance(actions, list):
        return set()
    values: set[str] = set()
    for action in actions:
        if not isinstance(action, dict):
            continue
        action_item = cast(dict[str, object], action)
        action_type = str(action_item.get("action_type", "")).strip()
        if action_type:
            values.add(action_type)
    return values
