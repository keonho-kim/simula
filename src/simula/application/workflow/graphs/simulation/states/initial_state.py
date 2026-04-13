"""Purpose:
- Build the compact public input and expand it into workflow state.
"""

from __future__ import annotations

from typing import cast

from simula.application.workflow.graphs.simulation.states.state import (
    SimulationInputState,
    SimulationWorkflowState,
)
from simula.domain.runtime_policy import derive_rng_seed
from simula.infrastructure.config.models import AppSettings


def build_simulation_input_state(
    *,
    run_id: str,
    scenario_text: str,
    settings: AppSettings,
) -> SimulationInputState:
    """Build the public graph input payload."""

    return {
        "run_id": run_id,
        "scenario": scenario_text,
        "max_steps": settings.runtime.max_steps,
        "rng_seed": derive_rng_seed(
            run_id=run_id,
            configured_seed=settings.runtime.rng_seed,
        ),
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
            "max_steps": input_state["max_steps"],
            "checkpoint_enabled": settings.runtime.enable_checkpointing,
            "rng_seed": input_state["rng_seed"],
            "planning_analysis": {},
            "plan": {},
            "actors": [],
            "activity_feeds": {},
            "activities": [],
            "latest_step_activities": [],
            "observer_reports": [],
            "focus_candidates": [],
            "step_focus_history": [],
            "selected_actor_ids": [],
            "deferred_actor_ids": [],
            "latest_background_updates": [],
            "background_updates": [],
            "actor_intent_states": [],
            "intent_history": [],
            "step_focus_plan": {},
            "step_time_advance": {},
            "simulation_clock": {
                "total_elapsed_minutes": 0,
                "total_elapsed_label": "0분",
                "last_elapsed_minutes": 0,
                "last_elapsed_label": "0분",
                "last_advanced_step_index": 0,
            },
            "step_time_history": [],
            "pending_cast_slots": [],
            "cast_slot": {"slot_index": 0, "cast_item": {}},
            "generated_actor_results": [],
            "actor_proposal_task": {
                "actor": {},
                "unread_activity_ids": [],
                "visible_action_context": [],
                "unread_backlog_digest": {},
                "visible_actors": [],
                "focus_slice": {},
                "runtime_guidance": {},
            },
            "pending_actor_proposals": [],
            "parse_failures": 0,
            "forced_idles": 0,
            "stagnation_steps": 0,
            "planning_latency_seconds": 0.0,
            "generation_started_at": 0.0,
            "generation_latency_seconds": 0.0,
            "current_step_started_at": 0.0,
            "last_step_latency_seconds": 0.0,
            "step_index": 0,
            "stop_requested": False,
            "stop_reason": "",
            "world_state_summary": "",
            "final_report": {},
            "simulation_log_jsonl": "",
            "report_projection_json": "",
            "report_timeline_anchor_json": {},
            "final_report_sections": {},
            "final_report_markdown": "",
            "errors": [],
        },
    )
