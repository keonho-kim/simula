"""목적:
- runtime 수명주기 노드를 제공한다.

설명:
- 런타임 초기화, active actor 선택, 다음 단계 분기를 담당한다.

사용한 설계 패턴:
- lifecycle node 패턴
"""

from __future__ import annotations

import time

from langgraph.runtime import Runtime
from langgraph.types import Overwrite

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.activity_feeds import initialize_activity_feeds
from simula.domain.runtime_policy import build_initial_intent_snapshots


def initialize_runtime_state(state: SimulationWorkflowState) -> dict[str, object]:
    """planner/generation 이후 시간 단계 실행 상태를 초기화한다."""

    return {
        "activity_feeds": initialize_activity_feeds(state["actors"]),
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
        "actor_intent_states": build_initial_intent_snapshots(list(state["actors"])),
        "pending_intent_updates": [],
        "intent_history": [],
        "pending_step_time_advance": None,
        "pending_actor_proposals": Overwrite(value=[]),
        "pending_observer_report": None,
        "step_index": 0,
        "stop_requested": False,
        "stop_reason": None,
        "final_report": None,
        "errors": [],
        "parse_failures": 0,
        "forced_idles": 0,
        "stagnation_steps": 0,
        "observer_event_probability": None,
        "world_state_summary": str(
            state.get("plan", {}).get("situation", {}).get("world_summary", "")
        ),
    }


def route_after_stop(state: SimulationWorkflowState) -> str:
    """다음 단계 재시작 또는 runtime 종료로 분기한다."""

    return "complete" if state.get("stop_requested") else "coordinator"
