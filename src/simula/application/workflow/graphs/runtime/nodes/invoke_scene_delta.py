"""LangGraph node for invoking the single SceneDelta LLM call."""

from __future__ import annotations

import json

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.runtime.prompts.scene_delta_prompt import (
    PROMPT as SCENE_DELTA_PROMPT,
    SCENE_DELTA_EXAMPLE,
)
from simula.application.workflow.graphs.runtime.utils.scene_delta import (
    compact_scene_input,
    default_scene_delta_payload,
    llm_meta_dict,
    scene_delta_validator,
)
from simula.application.workflow.graphs.runtime.utils.scene_events import (
    record_scene_event,
)
from simula.application.workflow.graphs.runtime.utils.scene_logging import (
    log_scene_request,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import SceneDelta, SimulationPlan
from simula.shared.prompts.output_schema_utils import object_prompt_bundle


async def invoke_scene_delta(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Invoke the coordinator once to dramatize the current scene candidates."""

    if state.get("stop_requested"):
        return {}
    round_index = int(state["round_index"])
    selected_event = dict(state["current_scene_event"])
    scene_actors = list(state["current_scene_actors"])
    candidates = list(state["scene_candidates"])
    simulation_plan = SimulationPlan.model_validate(state["simulation_plan"])
    compact_input = compact_scene_input(
        state=state,
        simulation_plan=simulation_plan,
        round_index=round_index,
        selected_event=selected_event,
        scene_actors=scene_actors,
        candidates=candidates,
    )
    log_scene_request(
        runtime.context.logger,
        round_index=round_index,
        selected_event=selected_event,
        scene_actors=scene_actors,
        candidates=candidates,
        compact_input=compact_input,
    )
    record_scene_event(
        runtime.context,
        "scene_tick_started",
        state,
        round_index,
        {
            "selected_event_id": str(selected_event.get("event_id", "")),
            "scene_actor_ids": [
                str(actor.get("cast_id", "")) for actor in scene_actors
            ],
        },
    )
    record_scene_event(
        runtime.context,
        "scene_candidates_built",
        state,
        round_index,
        {"candidates": candidates},
    )
    default_delta = default_scene_delta_payload(
        state=state,
        selected_event=selected_event,
        scene_actors=scene_actors,
        candidates=candidates,
        max_scene_beats=simulation_plan.runtime_budget.max_scene_beats,
    )
    delta, meta = await runtime.context.llms.ainvoke_object_with_meta(
        "coordinator",
        SCENE_DELTA_PROMPT.format(
            compact_input_json=json.dumps(
                compact_input,
                ensure_ascii=False,
                indent=2,
            ),
            **object_prompt_bundle(example=SCENE_DELTA_EXAMPLE),
        ),
        SceneDelta,
        failure_policy="default",
        default_payload=default_delta,
        log_context={
            "stage": "runtime_scene_tick",
            "round_index": round_index,
            "selected_event_id": str(selected_event.get("event_id", "")),
        },
        semantic_validator=scene_delta_validator(
            selected_event_id=str(selected_event.get("event_id", "")),
            scene_actor_ids=[
                str(actor.get("cast_id", "")) for actor in scene_actors
            ],
            candidate_ids=[
                str(candidate.get("candidate_id", "")) for candidate in candidates
            ],
            candidates=candidates,
            max_scene_beats=simulation_plan.runtime_budget.max_scene_beats,
        ),
        max_attempts=1,
    )
    return {
        "current_scene_compact_input": compact_input,
        "current_scene_delta": delta.model_dump(mode="json"),
        "current_scene_llm_meta": llm_meta_dict(meta),
    }
