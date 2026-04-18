"""Default payload helpers for round resolution."""

from __future__ import annotations

from typing import cast

from simula.application.workflow.graphs.coordinator.nodes.resolve_round_state import (
    default_actor_facing_scenario_digest,
    default_time_advance,
    merge_actor_intent_states,
    string_list,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)


def build_default_round_resolution_payload(
    state: SimulationWorkflowState,
    *,
    event_updates: list[dict[str, object]],
) -> dict[str, object]:
    adopted_cast_ids = [
        str(item.get("cast_id", ""))
        for item in list(state["pending_actor_proposals"])
        if str(item.get("cast_id", "")) in set(state["selected_cast_ids"])
        and not bool(item.get("forced_idle"))
        and isinstance(item.get("proposal", {}), dict)
        and item.get("proposal", {})
    ]
    goal_states = merge_actor_intent_states(
        actors=list(state["actors"]),
        current_actor_intent_states=list(state.get("actor_intent_states", [])),
        updated_actor_intent_states=[],
    )
    latest_activities = [
        cast(dict[str, object], item.get("proposal", {}))
        for item in list(state["pending_actor_proposals"])
        if str(item.get("cast_id", "")) in set(adopted_cast_ids)
        and isinstance(item.get("proposal", {}), dict)
    ]
    world_state_summary = str(
        state["world_state_summary"] or "현재 압력은 유지되고 있다."
    )
    return {
        "adopted_cast_ids": adopted_cast_ids[:2],
        "intent_states": goal_states,
        "event_updates": event_updates,
        "time_advance": default_time_advance(state),
        "observer_report": {
            "round_index": int(state["round_index"]),
            "summary": "직접 행동과 배경 압력을 기준으로 현재 단계를 정리했다.",
            "notable_events": [
                str(item.get("summary", "")).strip()
                for item in latest_activities[:2]
                if str(item.get("summary", "")).strip()
            ]
            or ["큰 변화 없이 현재 국면이 유지됐다."],
            "atmosphere": "긴장",
            "momentum": "medium",
            "world_state_summary": world_state_summary,
        },
        "actor_facing_scenario_digest": default_actor_facing_scenario_digest(
            state=state,
            world_state_summary=world_state_summary,
            latest_activities=latest_activities,
        ),
        "world_state_summary": world_state_summary,
        "stop_reason": "",
    }


def build_default_round_resolution_core_payload(
    *,
    default_resolution: dict[str, object],
) -> dict[str, object]:
    return {
        "adopted_cast_ids": string_list(default_resolution.get("adopted_cast_ids", [])),
        "time_advance": cast(
            dict[str, object],
            default_resolution.get("time_advance", {}),
        ),
        "world_state_summary": str(default_resolution.get("world_state_summary", "")),
        "stop_reason": str(default_resolution.get("stop_reason", "")),
    }


def build_default_round_resolution_narrative_bodies_payload(
    *,
    default_resolution: dict[str, object],
) -> dict[str, object]:
    observer_report = cast(
        dict[str, object],
        default_resolution.get("observer_report", {}),
    )
    digest = cast(
        dict[str, object],
        default_resolution.get("actor_facing_scenario_digest", {}),
    )
    return {
        "observer_report": {
            "summary": str(observer_report.get("summary", "")),
            "notable_events": string_list(observer_report.get("notable_events", [])),
            "atmosphere": str(observer_report.get("atmosphere", "")),
            "momentum": str(observer_report.get("momentum", "medium")),
        },
        "actor_facing_scenario_digest": {
            "current_pressures": string_list(digest.get("current_pressures", [])),
            "next_step_notes": string_list(
                digest.get("next_step_notes", [])
            ),
        },
    }
