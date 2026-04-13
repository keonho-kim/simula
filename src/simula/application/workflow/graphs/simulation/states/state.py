"""Purpose:
- Define the required simulation workflow state contracts.
"""

from __future__ import annotations

from typing import Annotated, Any, TypedDict

from simula.application.workflow.graphs.generation.states.state import (
    CastSlotSpec,
    GeneratedActorResult,
)
from simula.application.workflow.graphs.runtime.states.state import (
    ActorProposalResult,
    ActorProposalTask,
)
from simula.application.workflow.reducer.collections import extend_list, extend_str_list


class SimulationInputState(TypedDict):
    """Public graph input."""

    run_id: str
    scenario: str
    max_steps: int
    rng_seed: int


class SimulationOutputState(TypedDict):
    """Public graph output."""

    run_id: str
    final_report: dict[str, Any]
    final_report_markdown: str
    simulation_log_jsonl: str
    stop_reason: str
    errors: list[str]


class SimulationWorkflowState(TypedDict):
    """Internal graph state with required fields only."""

    run_id: str
    scenario: str
    max_steps: int
    checkpoint_enabled: bool
    rng_seed: int
    planning_analysis: dict[str, Any]
    plan: dict[str, Any]
    actors: list[dict[str, Any]]
    activity_feeds: dict[str, dict[str, Any]]
    activities: list[dict[str, Any]]
    latest_step_activities: list[dict[str, Any]]
    observer_reports: list[dict[str, Any]]
    focus_candidates: list[dict[str, Any]]
    step_focus_history: list[dict[str, Any]]
    selected_actor_ids: list[str]
    deferred_actor_ids: list[str]
    latest_background_updates: list[dict[str, Any]]
    background_updates: list[dict[str, Any]]
    actor_intent_states: list[dict[str, Any]]
    intent_history: list[dict[str, Any]]
    step_focus_plan: dict[str, Any]
    step_time_advance: dict[str, Any]
    simulation_clock: dict[str, Any]
    step_time_history: list[dict[str, Any]]
    pending_cast_slots: list[CastSlotSpec]
    cast_slot: CastSlotSpec
    generated_actor_results: Annotated[list[GeneratedActorResult], extend_list]
    actor_proposal_task: ActorProposalTask
    pending_actor_proposals: Annotated[list[ActorProposalResult], extend_list]
    parse_failures: int
    forced_idles: int
    stagnation_steps: int
    planning_latency_seconds: float
    generation_started_at: float
    generation_latency_seconds: float
    current_step_started_at: float
    last_step_latency_seconds: float
    step_index: int
    stop_requested: bool
    stop_reason: str
    world_state_summary: str
    final_report: dict[str, Any]
    simulation_log_jsonl: str
    report_projection_json: str
    report_timeline_anchor_json: dict[str, Any]
    final_report_sections: dict[str, Any]
    final_report_markdown: str
    errors: Annotated[list[str], extend_str_list]
