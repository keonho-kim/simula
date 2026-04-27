"""LangGraph node for applying a SceneDelta to runtime state."""

from __future__ import annotations

import time

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.runtime.utils.agent_state import (
    agent_updates_for_scene,
    merge_actor_intent_states,
    update_actor_agent_states,
)
from simula.application.workflow.graphs.runtime.utils.scene_apply import (
    actor_digest,
    apply_scene_beats,
    build_updated_clock,
    effective_stop_reason,
    event_updates,
    next_stagnation_rounds,
    observer_report,
    scene_errors,
)
from simula.application.workflow.graphs.runtime.utils.scene_delta import scene_beats
from simula.application.workflow.graphs.runtime.utils.scene_events import (
    event_memory_prompt_view,
    record_scene_event,
)
from simula.application.workflow.graphs.runtime.utils.scene_logging import (
    log_scene_result,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import SceneDelta, SimulationPlan
from simula.domain.event_memory import (
    apply_event_updates,
    build_transition_event_updates,
    has_required_unresolved_events,
)


def apply_scene_delta(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Apply the current scene delta and persist runtime artifacts."""

    if state.get("stop_requested"):
        return {}
    round_index = int(state["round_index"])
    simulation_plan = SimulationPlan.model_validate(state["simulation_plan"])
    current_event_memory = dict(state["event_memory"])
    selected_event = dict(state["current_scene_event"])
    scene_actors = list(state["current_scene_actors"])
    candidates = list(state["scene_candidates"])
    delta = SceneDelta.model_validate(state["current_scene_delta"])
    meta = dict(state["current_scene_llm_meta"])
    beats = scene_beats(delta)
    routed = apply_scene_beats(
        state=state,
        round_index=round_index,
        scene_beats=beats,
        candidates=candidates,
    )
    sanitized_event_updates = event_updates(
        event_memory=current_event_memory,
        proposed_updates=[item.model_dump(mode="json") for item in delta.event_updates],
        latest_round_activities=routed["latest_round_activities"],
        current_round_index=round_index,
    )
    next_event_memory = apply_event_updates(
        current_event_memory,
        event_updates=sanitized_event_updates,
        current_round_index=round_index,
    )
    stop_reason = effective_stop_reason(
        state=state,
        round_index=round_index,
        requested_stop_reason=delta.stop_reason,
        event_memory=next_event_memory,
        chosen_count=len(beats),
    )
    if stop_reason == "simulation_done" and has_required_unresolved_events(
        next_event_memory
    ):
        next_event_memory = apply_event_updates(
            next_event_memory,
            event_updates=[],
            current_round_index=round_index,
            finalize_unresolved_as_missed=True,
        )
    actual_event_updates = build_transition_event_updates(
        current_event_memory,
        next_event_memory,
    )
    clock = build_updated_clock(
        state=state,
        round_index=round_index,
        time_advance=delta.time_advance.model_dump(mode="json"),
    )
    report = observer_report(
        round_index=round_index,
        delta=delta,
        event=selected_event,
        actual_event_updates=actual_event_updates,
    )
    digest = actor_digest(
        round_index=round_index,
        world_state_summary=delta.world_state_summary,
        latest_round_activities=routed["latest_round_activities"],
        event=selected_event,
    )
    next_actor_intent_states = merge_actor_intent_states(
        actors=list(state["actors"]),
        current=list(state.get("actor_intent_states", [])),
        updated=[item.model_dump(mode="json") for item in delta.intent_updates],
    )
    next_actor_agent_states = update_actor_agent_states(
        actors=list(state["actors"]),
        simulation_plan=simulation_plan,
        current=list(state.get("actor_agent_states", [])),
        scene_beats=beats,
        latest_round_activities=routed["latest_round_activities"],
        intent_updates=[item.model_dump(mode="json") for item in delta.intent_updates],
        selected_event=selected_event,
    )
    agent_updates = agent_updates_for_scene(
        before=list(state.get("actor_agent_states", [])),
        after=next_actor_agent_states,
        scene_actor_ids=[str(actor.get("cast_id", "")) for actor in scene_actors],
    )
    event_memory_history_entry = {
        "round_index": round_index,
        "source": "scene_tick",
        "event_updates": actual_event_updates,
        "event_memory_summary": event_memory_prompt_view(
            next_event_memory,
            limit=5,
        ),
        "stop_context": {
            "requested_stop_reason": delta.stop_reason,
            "effective_stop_reason": stop_reason,
        },
    }
    scene_debug_trace = {
        "selected_event_id": str(selected_event.get("event_id", "")),
        "candidate_ids": [str(item.get("candidate_id", "")) for item in candidates],
        "beat_ids": [str(item.get("beat_id", "")) for item in beats],
        "candidate_ids_applied": [
            str(item.get("candidate_id", "")) for item in beats
        ],
        "scene_beats": beats,
        "agent_updates": agent_updates,
        "actor_agent_states": [
            item
            for item in next_actor_agent_states
            if str(item.get("cast_id", ""))
            in {str(actor.get("cast_id", "")) for actor in scene_actors}
        ],
        "default_used": bool(meta.get("forced_default", False)),
        "debug_rationale": delta.debug_rationale,
        "llm": {
            "duration_seconds": meta.get("duration_seconds"),
            "input_tokens": meta.get("input_tokens"),
            "output_tokens": meta.get("output_tokens"),
            "total_tokens": meta.get("total_tokens"),
            "parse_failures": meta.get("parse_failure_count"),
            "fixer_used": meta.get("fixer_used"),
        },
    }
    log_scene_result(
        runtime.context.logger,
        round_index=round_index,
        scene_actors=scene_actors,
        candidates=candidates,
        scene_beats=beats,
        agent_updates=agent_updates,
        actual_event_updates=actual_event_updates,
        stop_reason=stop_reason,
        time_advance=clock["time_advance"],
        meta=meta,
    )
    record_scene_event(
        runtime.context,
        "scene_delta_applied",
        state,
        round_index,
        {
            "selected_event_id": str(selected_event.get("event_id", "")),
            "scene_beats": beats,
            "actual_event_updates": actual_event_updates,
            "world_state_summary": delta.world_state_summary,
            "stop_reason": stop_reason,
        },
    )
    record_scene_event(
        runtime.context,
        "scene_event_memory_updated",
        state,
        round_index,
        event_memory_history_entry,
    )
    record_scene_event(
        runtime.context,
        "scene_debug_trace",
        state,
        round_index,
        scene_debug_trace,
    )
    runtime.context.store.save_round_artifacts(
        state["run_id"],
        activities=routed["latest_round_activities"],
        observer_report=report,
    )
    started_at = float(state.get("current_round_started_at", 0.0))
    return {
        "activity_feeds": routed["activity_feeds"],
        "activities": routed["activities"],
        "latest_round_activities": routed["latest_round_activities"],
        "actor_intent_states": next_actor_intent_states,
        "actor_agent_states": next_actor_agent_states,
        "agent_memory_history": list(state.get("agent_memory_history", []))
        + [
            {
                "round_index": round_index,
                "selected_event_id": str(selected_event.get("event_id", "")),
                "agent_updates": agent_updates,
            }
        ],
        "event_memory": next_event_memory,
        "event_memory_history": list(state.get("event_memory_history", []))
        + [event_memory_history_entry],
        "intent_history": list(state.get("intent_history", []))
        + [
            {
                "round_index": round_index,
                "actor_intent_states": next_actor_intent_states,
            }
        ],
        "time_advance": clock["time_advance"],
        "simulation_clock": clock["simulation_clock"],
        "round_time_history": list(state.get("round_time_history", []))
        + [clock["time_advance"]],
        "observer_reports": list(state.get("observer_reports", [])) + [report],
        "actor_facing_scenario_digest": digest,
        "world_state_summary": delta.world_state_summary,
        "stagnation_rounds": next_stagnation_rounds(
            previous=int(state.get("stagnation_rounds", 0)),
            chosen_count=len(beats),
            stop_reason=stop_reason,
        ),
        "stop_requested": bool(stop_reason),
        "stop_reason": stop_reason,
        "parse_failures": int(state.get("parse_failures", 0))
        + int(meta.get("parse_failure_count", 0)),
        "forced_idles": int(state.get("forced_idles", 0))
        + int(bool(meta.get("forced_default", False))),
        "last_round_latency_seconds": time.perf_counter() - started_at
        if started_at
        else 0.0,
        "scene_tick_history": list(state.get("scene_tick_history", []))
        + [scene_debug_trace],
        "scene_llm_call_count": int(state.get("scene_llm_call_count", 0)) + 1,
        "errors": scene_errors(state, round_index, meta),
        "current_scene_event": {},
        "current_scene_actors": [],
        "current_scene_compact_input": {},
        "current_scene_delta": {},
        "current_scene_llm_meta": {},
    }
