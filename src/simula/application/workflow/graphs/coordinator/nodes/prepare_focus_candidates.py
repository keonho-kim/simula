"""목적:
- focus 후보 actor pool 계산 노드를 제공한다.

설명:
- step 시작 시점의 후보 압축과 관련 상태 reset만 담당한다.

사용한 설계 패턴:
- single node module 패턴
"""

from __future__ import annotations

import time

from langgraph.runtime import Runtime
from langgraph.types import Overwrite

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.coordinator_policy import build_focus_candidates


def prepare_focus_candidates(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """현재 step의 coordinator 후보 pool을 계산한다."""

    next_step_index = int(state["step_index"]) + 1
    candidates = build_focus_candidates(
        actors=list(state.get("actors", [])),
        activity_feeds=dict(state.get("activity_feeds", {})),
        activities=list(state.get("activities", [])),
        actor_intent_states=list(state.get("actor_intent_states", [])),
        background_updates=list(state.get("background_updates", [])),
        step_focus_history=list(state.get("step_focus_history", [])),
        observer_reports=list(state.get("observer_reports", [])),
        current_step_index=next_step_index,
        rng_seed=int(state["rng_seed"]),
    )
    runtime.context.logger.info(
        "step %s 후보 actor 압축 완료 | 후보 %s명 / 전체 %s명",
        next_step_index,
        len(candidates),
        len(list(state.get("actors", []))),
    )
    return {
        "step_index": next_step_index,
        "focus_candidates": candidates,
        "selected_actor_ids": [],
        "deferred_actor_ids": [],
        "step_focus_plan": None,
        "latest_background_updates": [],
        "pending_actor_proposals": Overwrite(value=[]),
        "pending_step_time_advance": None,
        "latest_step_activities": [],
        "pending_observer_report": None,
        "actor_proposal_task": {},
        "current_step_started_at": time.perf_counter(),
    }
