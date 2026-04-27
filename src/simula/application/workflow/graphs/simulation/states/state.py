"""Purpose:
- Define the required simulation workflow state contracts.
"""

from __future__ import annotations

from typing import Annotated, Any, TypedDict

from simula.application.workflow.graphs.generation.states.state import (
    ActorRosterChunkSpec,
    GeneratedActorResult,
)
from simula.application.workflow.graphs.planning.states.state import (
    GeneratedPlanCastResult,
    PlanCastChunkSpec,
)
from simula.application.workflow.reducer.collections import extend_list, extend_str_list
from simula.domain.contracts import StopReason
from simula.domain.scenario.controls import ScenarioControls


class SimulationInputState(TypedDict):
    """Public graph input."""

    run_id: str
    scenario: str
    scenario_controls: ScenarioControls
    max_rounds: int
    rng_seed: int
    parallel_graph_calls: bool


class SimulationOutputState(TypedDict):
    """Public graph output."""

    run_id: str
    final_report: dict[str, Any]
    llm_usage_summary: dict[str, Any]
    final_report_markdown: str
    simulation_log_jsonl: str
    stop_reason: StopReason
    errors: list[str]


class SimulationWorkflowState(TypedDict):
    """Internal graph state with required fields only."""

    run_id: str
    scenario: str
    scenario_controls: ScenarioControls
    max_rounds: int
    planned_max_rounds: int
    checkpoint_enabled: bool
    rng_seed: int
    parallel_graph_calls: bool
    planning_analysis: dict[str, Any]
    cast_roster_outline: list[dict[str, Any]]
    situation: dict[str, Any]
    action_catalog: dict[str, Any]
    coordination_frame: dict[str, Any]
    major_events: list[dict[str, Any]]
    execution_plan_frame: dict[str, Any]
    plan: dict[str, Any]
    simulation_plan: dict[str, Any]
    actors: list[dict[str, Any]]
    activity_feeds: dict[str, dict[str, Any]]
    activities: list[dict[str, Any]]
    latest_round_activities: list[dict[str, Any]]
    observer_reports: list[dict[str, Any]]
    focus_candidates: list[dict[str, Any]]
    round_focus_history: list[dict[str, Any]]
    latest_background_updates: list[dict[str, Any]]
    background_updates: list[dict[str, Any]]
    event_memory: dict[str, Any]
    event_memory_history: list[dict[str, Any]]
    actor_agent_states: list[dict[str, Any]]
    agent_memory_history: list[dict[str, Any]]
    actor_intent_states: list[dict[str, Any]]
    intent_history: list[dict[str, Any]]
    round_focus_plan: dict[str, Any]
    time_advance: dict[str, Any]
    simulation_clock: dict[str, Any]
    round_time_history: list[dict[str, Any]]
    actor_facing_scenario_digest: dict[str, Any]
    pending_plan_cast_chunks: list[PlanCastChunkSpec]
    plan_cast_chunk: PlanCastChunkSpec
    generated_plan_cast_results: Annotated[list[GeneratedPlanCastResult], extend_list]
    generated_actor_results: Annotated[list[GeneratedActorResult], extend_list]
    pending_actor_roster_chunks: list[ActorRosterChunkSpec]
    actor_roster_chunk: ActorRosterChunkSpec
    parse_failures: int
    forced_idles: int
    stagnation_rounds: int
    planning_latency_seconds: float
    generation_started_at: float
    generation_latency_seconds: float
    current_round_started_at: float
    last_round_latency_seconds: float
    round_index: int
    stop_requested: bool
    stop_reason: StopReason
    world_state_summary: str
    current_scene_event: dict[str, Any]
    current_scene_actors: list[dict[str, Any]]
    scene_tick_history: list[dict[str, Any]]
    scene_candidates: list[dict[str, Any]]
    current_scene_compact_input: dict[str, Any]
    current_scene_delta: dict[str, Any]
    current_scene_llm_meta: dict[str, Any]
    current_scene_event_id: str
    scene_llm_call_count: int
    final_report: dict[str, Any]
    llm_usage_summary: dict[str, Any]
    simulation_log_jsonl: str
    report_projection_json: str
    report_timeline_anchor_json: dict[str, Any]
    report_conclusion_section: str
    report_timeline_section: str
    report_actor_dynamics_section: str
    report_major_events_section: str
    final_report_sections: dict[str, Any]
    final_report_markdown: str
    errors: Annotated[list[str], extend_str_list]
