"""Purpose:
- Build the compact public input and expand it into workflow state.
"""

from __future__ import annotations

from typing import cast

from simula.application.workflow.graphs.simulation.states.state import (
    SimulationInputState,
    SimulationWorkflowState,
)
from simula.application.workflow.graphs.planning.states.state import (
    empty_plan_cast_chunk_spec,
)
from simula.domain.runtime.policy import derive_rng_seed
from simula.domain.scenario.controls import ScenarioControls
from simula.infrastructure.config.models import AppSettings


def build_simulation_input_state(
    *,
    run_id: str,
    scenario_text: str,
    scenario_controls: ScenarioControls,
    settings: AppSettings,
    parallel_graph_calls: bool = False,
) -> SimulationInputState:
    """Build the public graph input payload."""

    return {
        "run_id": run_id,
        "scenario": scenario_text,
        "scenario_controls": scenario_controls,
        "max_rounds": settings.runtime.max_rounds,
        "rng_seed": derive_rng_seed(
            run_id=run_id,
            configured_seed=settings.runtime.rng_seed,
        ),
        "parallel_graph_calls": parallel_graph_calls,
    }


def expand_input_state_to_workflow_state(
    *,
    input_state: SimulationInputState,
    settings: AppSettings,
) -> SimulationWorkflowState:
    """Expand the compact public input into the full workflow state."""

    return cast(
        SimulationWorkflowState,
        {
            "run_id": input_state["run_id"],
            "scenario": input_state["scenario"],
            "scenario_controls": input_state["scenario_controls"],
            "max_rounds": input_state["max_rounds"],
            "planned_max_rounds": input_state["max_rounds"],
            "checkpoint_enabled": settings.runtime.enable_checkpointing,
            "rng_seed": input_state["rng_seed"],
            "parallel_graph_calls": bool(input_state.get("parallel_graph_calls", False)),
            "planning_analysis": {},
            "cast_roster_outline": [],
            "situation": {},
            "action_catalog": {},
            "coordination_frame": {},
            "major_events": [],
            "execution_plan_frame": {},
            "plan": {},
            "simulation_plan": {},
            "actors": [],
            "activity_feeds": {},
            "activities": [],
            "latest_round_activities": [],
            "observer_reports": [],
            "focus_candidates": [],
            "round_focus_history": [],
            "latest_background_updates": [],
            "background_updates": [],
            "event_memory": {
                "events": [],
                "next_event_ids": [],
                "overdue_event_ids": [],
                "completed_event_ids": [],
                "missed_event_ids": [],
                "endgame_gate_open": False,
            },
            "event_memory_history": [],
            "actor_agent_states": [],
            "agent_memory_history": [],
            "actor_intent_states": [],
            "intent_history": [],
            "round_focus_plan": {},
            "time_advance": {},
            "simulation_clock": {
                "total_elapsed_minutes": 0,
                "total_elapsed_label": "0분",
                "last_elapsed_minutes": 0,
                "last_elapsed_label": "0분",
                "last_advanced_round_index": 0,
            },
            "round_time_history": [],
            "actor_facing_scenario_digest": {},
            "pending_plan_cast_chunks": [],
            "plan_cast_chunk": empty_plan_cast_chunk_spec(),
            "generated_plan_cast_results": [],
            "generated_actor_results": [],
            "pending_actor_roster_chunks": [],
            "actor_roster_chunk": {"chunk_index": 0, "cast_items": []},
            "parse_failures": 0,
            "forced_idles": 0,
            "stagnation_rounds": 0,
            "planning_latency_seconds": 0.0,
            "generation_started_at": 0.0,
            "generation_latency_seconds": 0.0,
            "current_round_started_at": 0.0,
            "last_round_latency_seconds": 0.0,
            "round_index": 0,
            "stop_requested": False,
            "stop_reason": "",
            "world_state_summary": "",
            "current_scene_event": {},
            "current_scene_actors": [],
            "scene_tick_history": [],
            "scene_candidates": [],
            "current_scene_compact_input": {},
            "current_scene_delta": {},
            "current_scene_llm_meta": {},
            "current_scene_event_id": "",
            "scene_llm_call_count": 0,
            "final_report": {},
            "llm_usage_summary": {},
            "simulation_log_jsonl": "",
            "report_projection_json": "",
            "report_timeline_anchor_json": {},
            "report_conclusion_section": "",
            "report_timeline_section": "",
            "report_actor_dynamics_section": "",
            "report_major_events_section": "",
            "final_report_sections": {},
            "final_report_markdown": "",
            "errors": [],
        },
    )
