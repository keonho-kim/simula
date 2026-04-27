"""목적:
- runtime 수명주기 노드를 제공한다.

설명:
- 런타임 초기화와 다음 단계 분기를 담당한다.

사용한 설계 패턴:
- lifecycle node 패턴
"""

from __future__ import annotations

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.runtime.utils.agent_state import (
    build_initial_actor_agent_states,
)
from simula.application.workflow.graphs.runtime.utils.planning import (
    build_runtime_major_events,
    build_simulation_plan,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.activity.feeds import initialize_activity_feeds
from simula.domain.event_memory import build_event_memory
from simula.domain.runtime.policy import (
    build_initial_actor_facing_scenario_digest,
    build_initial_intent_snapshots,
)


def initialize_runtime_state(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext] | None = None,
) -> dict[str, object]:
    """planner/generation 이후 시간 단계 실행 상태를 초기화한다."""

    plan = dict(state.get("plan", {}))
    actors = list(state["actors"])
    max_recipients = (
        runtime.context.settings.runtime.max_recipients_per_message
        if runtime is not None
        else 2
    )
    max_scene_actors = (
        runtime.context.settings.runtime.max_scene_actors
        if runtime is not None
        else 3
    )
    max_scene_candidates = (
        runtime.context.settings.runtime.max_scene_candidates
        if runtime is not None
        else 6
    )
    max_scene_beats = (
        runtime.context.settings.runtime.max_scene_beats
        if runtime is not None
        else 3
    )
    simulation_plan = build_simulation_plan(
        plan=plan,
        actors=actors,
        max_rounds=int(state.get("max_rounds", 20)),
        max_recipients_per_message=max_recipients,
        max_scene_actors=max_scene_actors,
        max_scene_candidates=max_scene_candidates,
        max_scene_beats=max_scene_beats,
    )
    major_events = build_runtime_major_events(
        plan=plan,
        actors=actors,
        max_rounds=int(state.get("max_rounds", 20)),
    )
    initial_digest = build_initial_actor_facing_scenario_digest(
        plan
    )
    initial_event_memory = build_event_memory(
        major_events
    )
    return {
        "activity_feeds": initialize_activity_feeds(state["actors"]),
        "activities": [],
        "latest_round_activities": [],
        "simulation_plan": simulation_plan.model_dump(mode="json"),
        "observer_reports": [],
        "focus_candidates": [],
        "round_focus_plan": {},
        "round_focus_history": [],
        "latest_background_updates": [],
        "background_updates": [],
        "event_memory": initial_event_memory,
        "event_memory_history": [],
        "actor_agent_states": build_initial_actor_agent_states(
            actors=actors,
            simulation_plan=simulation_plan,
        ),
        "agent_memory_history": [],
        "actor_intent_states": build_initial_intent_snapshots(list(state["actors"])),
        "intent_history": [],
        "time_advance": {},
        "actor_facing_scenario_digest": initial_digest,
        "round_index": 0,
        "stop_requested": False,
        "stop_reason": "",
        "final_report": {},
        "errors": list(state.get("errors", [])),
        "parse_failures": int(state.get("parse_failures", 0)),
        "forced_idles": int(state.get("forced_idles", 0)),
        "stagnation_rounds": 0,
        "world_state_summary": str(
            initial_digest.get("world_state_summary", "")
        ),
        "current_scene_event": {},
        "current_scene_actors": [],
        "scene_tick_history": [],
        "scene_candidates": [],
        "current_scene_compact_input": {},
        "current_scene_delta": {},
        "current_scene_llm_meta": {},
        "current_scene_event_id": "",
        "scene_llm_call_count": 0,
    }
