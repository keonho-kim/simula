"""목적:
- 개별 actor slot 생성 노드를 제공한다.

설명:
- generator 역할 호출로 cast slot 하나를 actor 카드로 확정한다.

사용한 설계 패턴:
- fan-out worker node 패턴
"""

from __future__ import annotations

import json

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.generation.prompts.generate_actor_prompt import (
    PROMPT as GENERATE_ACTOR_PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import ActorCard
from simula.prompts.shared.output_examples import build_output_prompt_bundle


async def generate_actor_slot(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """cast slot 하나에 대해 actor 하나를 생성한다."""

    slot = state["cast_slot"]
    cast_item = slot["cast_item"]
    prompt = GENERATE_ACTOR_PROMPT.format(
        scenario_text=state["scenario"],
        interpretation_json=json.dumps(
            state["plan"]["interpretation"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        situation_json=json.dumps(
            state["plan"]["situation"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        action_catalog_json=json.dumps(
            state["plan"]["action_catalog"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        coordination_frame_json=json.dumps(
            state["plan"]["coordination_frame"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        actor_slot_index=slot["slot_index"],
        target_actor_count=len(list(state["plan"].get("cast_roster", []))),
        cast_item_json=json.dumps(cast_item, ensure_ascii=False, separators=(",", ":")),
        **build_output_prompt_bundle(ActorCard),
    )
    actor, meta = await runtime.context.llms.ainvoke_structured_with_meta(
        "generator",
        prompt,
        ActorCard,
        log_context={"slot_index": int(slot["slot_index"])},
    )
    return {
        "generated_actor_results": [
            {
                "slot_index": slot["slot_index"],
                "cast_id": str(cast_item["cast_id"]),
                "actor": actor.model_dump(mode="json"),
                "latency_seconds": meta.duration_seconds,
                "parse_failure_count": meta.parse_failure_count,
            }
        ],
    }
