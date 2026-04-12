"""목적:
- simulation workflow 초기 상태를 생성한다.

설명:
- executor가 workflow 실행 전에 필요한 기본 상태를 한 곳에서 초기화한다.

사용한 설계 패턴:
- 상태 빌더 패턴
"""

from __future__ import annotations

from typing import cast

from simula.domain.runtime_policy import derive_rng_seed
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.infrastructure.config.models import AppSettings


def build_initial_workflow_state(
    *,
    run_id: str,
    scenario_text: str,
    settings: AppSettings,
) -> SimulationWorkflowState:
    """workflow 실행용 초기 상태를 만든다."""

    return cast(
        SimulationWorkflowState,
        {
            "run_id": run_id,
            "scenario": scenario_text,
            "plan": {},
            "action_catalog": None,
            "coordination_frame": None,
            "actors": [],
            "activity_feeds": {},
            "activities": [],
            "latest_step_activities": [],
            "observer_reports": [],
            "focus_candidates": [],
            "step_focus_plan": None,
            "step_focus_history": [],
            "selected_actor_ids": [],
            "deferred_actor_ids": [],
            "latest_background_updates": [],
            "background_updates": [],
            "pending_adopted_actions": [],
            "rejected_action_notes": [],
            "actor_intent_states": [],
            "pending_intent_updates": [],
            "intent_history": [],
            "pending_step_time_advance": None,
            "simulation_clock": {
                "total_elapsed_minutes": 0,
                "total_elapsed_label": "0분",
                "last_elapsed_minutes": 0,
                "last_elapsed_label": "0분",
                "last_advanced_step_index": 0,
            },
            "step_time_history": [],
            "pending_interpretation_core": None,
            "pending_progression_plan": None,
            "pending_time_scope": None,
            "pending_public_context": [],
            "pending_private_context": [],
            "pending_key_pressures": [],
            "pending_observation_points": [],
            "pending_interpretation": None,
            "pending_situation": None,
            "pending_action_catalog": None,
            "pending_coordination_frame": None,
            "pending_cast_roster": [],
            "pending_cast_slots": [],
            "generated_actor_results": [],
            "actor_proposal_task": {},
            "pending_actor_proposals": [],
            "pending_plan": None,
            "pending_actors": [],
            "pending_observer_report": None,
            "parse_failures": 0,
            "forced_idles": 0,
            "stagnation_steps": 0,
            "observer_event_roll": None,
            "observer_event_probability": None,
            "observer_event_triggered": False,
            "planning_latency_seconds": 0.0,
            "generation_started_at": 0.0,
            "generation_latency_seconds": 0.0,
            "current_step_started_at": 0.0,
            "last_step_latency_seconds": 0.0,
            "step_index": 0,
            "max_steps": settings.runtime.max_steps,
            "checkpoint_enabled": settings.runtime.enable_checkpointing,
            "rng_seed": derive_rng_seed(
                run_id=run_id,
                configured_seed=settings.runtime.rng_seed,
            ),
            "stop_requested": False,
            "stop_reason": None,
            "world_state_summary": "",
            "final_report": None,
            "simulation_log_jsonl": None,
            "report_projection_json": None,
            "report_timeline_anchor_json": None,
            "report_timeline_section": None,
            "report_actor_dynamics_section": None,
            "report_major_events_section": None,
            "report_body_sections": [],
            "report_body_sections_markdown": None,
            "report_actor_final_results_section": None,
            "report_simulation_conclusion_section": None,
            "final_report_markdown": None,
            "errors": [],
        },
    )
