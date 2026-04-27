"""SceneDelta prompt input, default, and validation helpers."""

from __future__ import annotations

from typing import Any

from simula.application.workflow.graphs.runtime.utils.agent_state import (
    scene_agent_state_view,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import SceneDelta, SimulationPlan


def compact_scene_input(
    *,
    state: SimulationWorkflowState,
    simulation_plan: SimulationPlan,
    round_index: int,
    selected_event: dict[str, Any],
    scene_actors: list[dict[str, Any]],
    candidates: list[dict[str, Any]],
) -> dict[str, Any]:
    actor_symbols = simulation_plan.symbol_table.actors
    action_symbols = simulation_plan.symbol_table.actions
    return {
        "round_index": round_index,
        "symbols": {
            "actors": {
                str(actor.get("cast_id", "")): actor_symbols.get(
                    str(actor.get("cast_id", "")),
                    "",
                )
                for actor in scene_actors
            },
            "selected_event": simulation_plan.symbol_table.events.get(
                str(selected_event.get("event_id", "")),
                "",
            ),
            "actions": action_symbols,
        },
        "selected_event": {
            "event_id": str(selected_event.get("event_id", "")),
            "title": str(selected_event.get("title", "")),
            "status": str(selected_event.get("status", "")),
            "progress_summary": str(selected_event.get("progress_summary", "")),
            "participant_cast_ids": [
                str(item)
                for item in list(selected_event.get("participant_cast_ids", []))
            ],
            "completion_action_types": [
                str(item)
                for item in list(selected_event.get("completion_action_types", []))
            ],
            "completion_signals": [
                str(item)
                for item in list(selected_event.get("completion_signals", []))
            ],
        },
        "scene_actors": [
            {
                "cast_id": str(actor.get("cast_id", "")),
                "symbol": actor_symbols.get(str(actor.get("cast_id", "")), ""),
                "display_name": str(actor.get("display_name", "")),
                "role": str(actor.get("role", "")),
                "narrative_profile": str(actor.get("narrative_profile", "")),
                "private_goal": str(actor.get("private_goal", "")),
                "voice": str(actor.get("voice", "")),
            }
            for actor in scene_actors
        ],
        "policies": [
            item.model_dump(mode="json")
            for item in simulation_plan.actor_policies
            if item.cast_id
            in {str(actor.get("cast_id", "")) for actor in scene_actors}
        ],
        "agent_states": scene_agent_state_view(
            state=list(state.get("actor_agent_states", [])),
            scene_actor_ids=[str(actor.get("cast_id", "")) for actor in scene_actors],
        ),
        "candidates": candidates,
        "runtime_budget": {
            "max_scene_beats": simulation_plan.runtime_budget.max_scene_beats,
        },
        "recent_effects": list(state.get("latest_round_activities", []))[-3:],
        "world_state_summary": str(state.get("world_state_summary", "")),
    }


def default_scene_delta_payload(
    *,
    state: SimulationWorkflowState,
    selected_event: dict[str, Any],
    scene_actors: list[dict[str, Any]],
    candidates: list[dict[str, Any]],
    max_scene_beats: int,
) -> dict[str, Any]:
    chosen = candidates[:max_scene_beats]
    scene_beats = [
        {
            "beat_id": f"B{index}",
            "candidate_id": str(item.get("candidate_id", "")),
            "source_cast_id": str(item.get("source_cast_id", "")),
            "target_cast_ids": [
                str(target) for target in list(item.get("target_cast_ids", []))
            ],
            "intent": str(item.get("goal", "Move the selected event.")),
            "action_type": str(item.get("action_type", "")),
            "summary": str(item.get("summary", "The scene moves forward.")),
            "detail": str(
                item.get("detail", "The actor takes the next concrete step.")
            ),
            "utterance": str(item.get("utterance", "")),
            "reaction": "The targeted actors register the move and adjust their stance.",
            "emotional_tone": "controlled",
            "event_effect": "The selected event gains concrete forward motion.",
        }
        for index, item in enumerate(chosen, start=1)
    ]
    return {
        "selected_event_id": str(selected_event.get("event_id", "")),
        "scene_beats": scene_beats,
        "intent_updates": [
            {
                "cast_id": str(item.get("source_cast_id", "")),
                "goal": str(item.get("goal", "Move the selected event.")),
                "target_cast_ids": [
                    str(target) for target in list(item.get("target_cast_ids", []))
                ],
                "confidence": 0.6,
                "changed_from_previous": True,
            }
            for item in chosen
        ]
        or [
            {
                "cast_id": str(scene_actors[0].get("cast_id", "")),
                "goal": "Wait for a clearer opening.",
                "target_cast_ids": [],
                "confidence": 0.4,
                "changed_from_previous": False,
            }
        ],
        "event_updates": [
            {
                "event_id": str(selected_event.get("event_id", "")),
                "status": "in_progress",
                "progress_summary": "The selected event moved through a compact default action.",
                "matched_activity_ids": [],
            }
        ],
        "world_state_summary": str(state.get("world_state_summary", "")).strip()
        or str(selected_event.get("summary", "")).strip()
        or "The scenario remains in motion.",
        "time_advance": default_time_advance(state),
        "stop_reason": "",
        "debug_rationale": "Default scene delta selected the first deterministic candidate.",
    }


def scene_delta_validator(
    *,
    selected_event_id: str,
    scene_actor_ids: list[str],
    candidate_ids: list[str],
    candidates: list[dict[str, Any]],
    max_scene_beats: int,
):
    scene_actor_set = set(scene_actor_ids)
    candidate_id_set = set(candidate_ids)
    candidate_by_id = {str(item.get("candidate_id", "")): item for item in candidates}

    def validator(delta: SceneDelta) -> list[str]:
        errors: list[str] = []
        if delta.selected_event_id != selected_event_id:
            errors.append("selected_event_id must match the selected event.")
        if len(delta.scene_beats) > max_scene_beats:
            errors.append("scene_beats exceeds max_scene_beats.")
        for beat in delta.scene_beats:
            if beat.candidate_id not in candidate_id_set:
                errors.append(f"unknown scene beat candidate_id: {beat.candidate_id}")
                continue
            candidate = candidate_by_id[beat.candidate_id]
            if beat.source_cast_id != str(candidate.get("source_cast_id", "")):
                errors.append("scene beat source_cast_id must match its candidate.")
            if beat.action_type != str(candidate.get("action_type", "")):
                errors.append("scene beat action_type must match its candidate.")
            if beat.target_cast_ids != [
                str(item) for item in list(candidate.get("target_cast_ids", []))
            ]:
                errors.append("scene beat target_cast_ids must match its candidate.")
            if beat.source_cast_id not in scene_actor_set:
                errors.append(f"scene beat outside scene actors: {beat.source_cast_id}")
        for intent in delta.intent_updates:
            if intent.cast_id not in scene_actor_set:
                errors.append(f"intent update outside scene actors: {intent.cast_id}")
        for event_update in delta.event_updates:
            if event_update.event_id != selected_event_id:
                errors.append("event_updates may update only the selected event.")
        return errors

    return validator


def scene_beats(delta: SceneDelta) -> list[dict[str, Any]]:
    return [beat.model_dump(mode="json") for beat in delta.scene_beats]


def llm_meta_dict(meta: Any) -> dict[str, Any]:
    return {
        "parse_failure_count": int(getattr(meta, "parse_failure_count", 0)),
        "forced_default": bool(getattr(meta, "forced_default", False)),
        "duration_seconds": float(getattr(meta, "duration_seconds", 0.0)),
        "last_content": str(getattr(meta, "last_content", "")),
        "ttft_seconds": getattr(meta, "ttft_seconds", None),
        "input_tokens": getattr(meta, "input_tokens", None),
        "output_tokens": getattr(meta, "output_tokens", None),
        "total_tokens": getattr(meta, "total_tokens", None),
        "fixer_used": bool(getattr(meta, "fixer_used", False)),
    }


def default_time_advance(state: SimulationWorkflowState) -> dict[str, Any]:
    progression_plan = dict(dict(state.get("plan", {})).get("progression_plan", {}))
    allowed_units = [
        str(item)
        for item in list(progression_plan.get("allowed_elapsed_units", []))
    ]
    elapsed_unit = "minute" if "minute" in allowed_units else str(
        progression_plan.get("default_elapsed_unit", "minute")
    )
    return {
        "elapsed_unit": elapsed_unit,
        "elapsed_amount": 30 if elapsed_unit == "minute" else 1,
        "reason": "Use the current runtime's compact default time step.",
    }
