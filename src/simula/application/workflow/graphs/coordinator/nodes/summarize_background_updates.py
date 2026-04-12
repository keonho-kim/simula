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
from simula.application.workflow.graphs.coordinator.output_schema.bundles import (
    build_background_update_batch_prompt_bundle,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.application.workflow.utils.prompt_projections import (
    WORLD_STATE_SUMMARY_LIMIT,
    build_background_coordination_frame_view,
    build_deferred_actor_views,
    build_relevant_intent_states,
    build_visible_action_context,
    truncate_text,
)
from simula.domain.contracts import BackgroundUpdateBatch


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

    recent_actions, _ = build_visible_action_context(
        unread_visible_activities=[],
        recent_visible_activities=list(state.get("activities", []))[-8:],
        limit=6,
    )
    deferred_actor_ids = [
        str(actor.get("actor_id", ""))
        for actor in deferred_actors
        if str(actor.get("actor_id", "")).strip()
    ]

    prompt = SUMMARIZE_BACKGROUND_UPDATES_PROMPT.format(
        step_index=state["step_index"],
        deferred_actors_json=json.dumps(
            build_deferred_actor_views(deferred_actors),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        selected_actor_ids_json=json.dumps(
            list(state.get("selected_actor_ids", [])),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        latest_actions_json=json.dumps(
            recent_actions,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        actor_intent_states_json=json.dumps(
            build_relevant_intent_states(
                list(state.get("actor_intent_states", [])),
                relevant_actor_ids=deferred_actor_ids,
                limit=8,
            ),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        world_state_summary=truncate_text(
            state.get("world_state_summary", ""),
            WORLD_STATE_SUMMARY_LIMIT,
        ),
        coordination_frame_json=json.dumps(
            build_background_coordination_frame_view(
                state["plan"]["coordination_frame"]
            ),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        **build_background_update_batch_prompt_bundle(),
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
    current_step_index = int(state["step_index"])
    updates = [
        item.model_copy(update={"step_index": current_step_index}).model_dump(mode="json")
        for item in batch.background_updates
    ]
    return {
        "latest_background_updates": updates,
        "background_updates": list(state.get("background_updates", [])) + updates,
    }
