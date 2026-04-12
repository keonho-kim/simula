"""목적:
- simulation workflow 상태 구조를 정의한다.

설명:
- planning, generation, runtime, finalization 서브그래프가 공유하는 상태 채널을 정의한다.

사용한 설계 패턴:
- 명시적 상태 계약 패턴
"""

from __future__ import annotations

from typing import Annotated, Any, TypedDict

from simula.application.workflow.graphs.generation.states.state import (
    CastSlotSpec,
    GeneratedActorResult,
)
from simula.application.workflow.graphs.planning.states.state import (
    PlanningStateFragment,
)
from simula.application.workflow.reducer.collections import (
    extend_list,
    extend_str_list,
)
from simula.application.workflow.graphs.runtime.states.state import (
    ActorProposalResult,
    ActorProposalTask,
)


class SimulationWorkflowState(PlanningStateFragment, TypedDict, total=False):
    """simulation workflow 상태 계약이다."""

    run_id: str
    scenario: str
    plan: dict[str, Any]
    actors: list[dict[str, Any]]
    activity_feeds: dict[str, dict[str, Any]]
    activities: list[dict[str, Any]]
    latest_step_activities: list[dict[str, Any]]
    observer_reports: list[dict[str, Any]]
    focus_candidates: list[dict[str, Any]]
    step_focus_plan: dict[str, Any] | None
    step_focus_history: list[dict[str, Any]]
    selected_actor_ids: list[str]
    deferred_actor_ids: list[str]
    latest_background_updates: list[dict[str, Any]]
    background_updates: list[dict[str, Any]]
    actor_intent_states: list[dict[str, Any]]
    intent_history: list[dict[str, Any]]
    pending_step_time_advance: dict[str, Any] | None
    simulation_clock: dict[str, Any]
    step_time_history: list[dict[str, Any]]
    pending_cast_slots: list[CastSlotSpec]
    cast_slot: CastSlotSpec
    generated_actor_results: Annotated[list[GeneratedActorResult], extend_list]
    actor_proposal_task: ActorProposalTask
    pending_actor_proposals: Annotated[list[ActorProposalResult], extend_list]
    pending_actors: list[dict[str, Any]]
    pending_observer_report: dict[str, Any] | None
    parse_failures: int
    forced_idles: int
    stagnation_steps: int
    planning_latency_seconds: float
    generation_started_at: float
    generation_latency_seconds: float
    current_step_started_at: float
    last_step_latency_seconds: float
    step_index: int
    max_steps: int
    checkpoint_enabled: bool
    rng_seed: int
    stop_requested: bool
    stop_reason: str | None
    world_state_summary: str
    final_report: dict[str, Any] | None
    simulation_log_jsonl: str | None
    report_projection_json: str | None
    report_timeline_anchor_json: dict[str, Any] | None
    report_timeline_section: str | None
    report_actor_dynamics_section: str | None
    report_major_events_section: str | None
    report_body_sections: list[dict[str, str]]
    report_body_sections_markdown: str | None
    report_actor_final_results_section: str | None
    report_simulation_conclusion_section: str | None
    final_report_markdown: str | None
    errors: Annotated[list[str], extend_str_list]
