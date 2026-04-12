"""목적:
- runtime 서브그래프의 상태 조각 타입을 정의한다.

설명:
- actor proposal fan-out/fan-in과 step 실행 상태 필드를 명시한다.

사용한 설계 패턴:
- 상태 조각 타입 패턴
"""

from __future__ import annotations

from typing import Any, TypedDict


class ActorProposalTask(TypedDict, total=False):
    """actor proposal 실행 태스크 조각이다."""

    actor: dict[str, Any]
    unread_activity_ids: list[str]
    visible_action_context: list[dict[str, object]]
    unread_backlog_digest: dict[str, object] | None
    visible_actors: list[dict[str, object]]
    focus_slice: dict[str, Any]
    runtime_guidance: dict[str, object]


class ActorProposalResult(TypedDict):
    """병렬 actor 단계 결과다."""

    actor_id: str
    unread_activity_ids: list[str]
    proposal: dict[str, Any]
    forced_idle: bool
    parse_failure_count: int
    latency_seconds: float


class RuntimeStateFragment(TypedDict, total=False):
    """runtime 서브그래프 상태 조각이다."""

    focus_candidates: list[dict[str, Any]]
    step_focus_plan: dict[str, Any] | None
    step_focus_history: list[dict[str, Any]]
    selected_actor_ids: list[str]
    deferred_actor_ids: list[str]
    latest_background_updates: list[dict[str, Any]]
    background_updates: list[dict[str, Any]]
    actor_proposal_task: ActorProposalTask
    pending_actor_proposals: list[ActorProposalResult]
    pending_adopted_actions: list[dict[str, Any]]
    rejected_action_notes: list[str]
    actor_intent_states: list[dict[str, Any]]
    pending_intent_updates: list[dict[str, Any]]
    intent_history: list[dict[str, Any]]
    pending_step_time_advance: dict[str, Any] | None
    simulation_clock: dict[str, Any]
    step_time_history: list[dict[str, Any]]
    pending_observer_report: dict[str, Any] | None
    current_step_started_at: float
    last_step_latency_seconds: float
    step_index: int
    forced_idles: int
    stagnation_steps: int
    stop_requested: bool
    stop_reason: str | None
    world_state_summary: str
    rng_seed: int
