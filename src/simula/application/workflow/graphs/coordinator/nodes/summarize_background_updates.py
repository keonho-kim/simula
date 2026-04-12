"""목적:
- background update 요약 노드를 제공한다.

설명:
- 직접 호출하지 않은 actor의 배경 변화를 구조화 digest로 정리한다.

사용한 설계 패턴:
- single node module 패턴
"""

from __future__ import annotations

import json

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.coordinator.prompts.summarize_background_updates_prompt import (
    PROMPT as SUMMARIZE_BACKGROUND_UPDATES_PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import BackgroundUpdateBatch
from simula.prompts.shared.output_examples import build_output_prompt_bundle


async def summarize_background_updates(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """직접 호출하지 않는 actor의 배경 변화를 요약한다."""

    deferred_actors = [
        actor
        for actor in list(state.get("actors", []))
        if str(actor.get("actor_id", "")) in set(state.get("deferred_actor_ids", []))
    ]
    if not deferred_actors:
        return {"latest_background_updates": []}

    prompt = SUMMARIZE_BACKGROUND_UPDATES_PROMPT.format(
        step_index=state["step_index"],
        deferred_actors_json=json.dumps(
            deferred_actors,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        selected_actor_ids_json=json.dumps(
            list(state.get("selected_actor_ids", [])),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        recent_activities_json=json.dumps(
            list(state.get("activities", []))[-8:],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        actor_intent_states_json=json.dumps(
            list(state.get("actor_intent_states", [])),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        world_state_summary=str(state.get("world_state_summary", "")),
        coordination_frame_json=json.dumps(
            state["plan"]["coordination_frame"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        **build_output_prompt_bundle(BackgroundUpdateBatch),
    )
    batch, _ = await runtime.context.llms.ainvoke_structured_with_meta(
        "coordinator",
        prompt,
        BackgroundUpdateBatch,
        allow_default_on_failure=True,
        default_payload={"background_updates": []},
        log_context={
            "scope": "background-updates",
            "step_index": int(state["step_index"]),
        },
    )
    updates = [item.model_dump(mode="json") for item in batch.background_updates]
    return {
        "latest_background_updates": updates,
        "background_updates": list(state.get("background_updates", [])) + updates,
    }
