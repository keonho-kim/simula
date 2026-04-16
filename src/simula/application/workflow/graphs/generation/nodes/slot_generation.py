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

from simula.application.llm_logging import build_llm_log_context
from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.generation.prompts.generate_actor_prompt import (
    PROMPT as GENERATE_ACTOR_PROMPT,
)
from simula.application.workflow.graphs.generation.output_schema.bundles import (
    build_actor_card_prompt_bundle,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.application.workflow.utils.prompt_projections import (
    GENERATION_ACTION_LIMIT,
    build_compact_action_catalog_view,
    build_generation_coordination_frame_view,
    build_generation_interpretation_view,
    build_generation_situation_view,
)
from simula.domain.contracts import ActorCard, GeneratedActorCardDraft


async def generate_actor_slot(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """cast slot 하나에 대해 actor 하나를 생성한다."""

    slot = state["cast_slot"]
    cast_item = slot["cast_item"]
    prompt = GENERATE_ACTOR_PROMPT.format(
        interpretation_json=json.dumps(
            build_generation_interpretation_view(state["plan"]["interpretation"]),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        situation_json=json.dumps(
            build_generation_situation_view(state["plan"]["situation"]),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        action_catalog_json=json.dumps(
            build_compact_action_catalog_view(
                state["plan"]["action_catalog"],
                limit=GENERATION_ACTION_LIMIT,
            ),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        coordination_frame_json=json.dumps(
            build_generation_coordination_frame_view(
                state["plan"]["coordination_frame"]
            ),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        requested_num_cast=state["scenario_controls"]["num_cast"],
        allow_additional_cast=str(
            state["scenario_controls"]["allow_additional_cast"]
        ).lower(),
        actor_slot_index=slot["slot_index"],
        target_actor_count=len(list(state["plan"].get("cast_roster", []))),
        cast_item_json=json.dumps(cast_item, ensure_ascii=False, separators=(",", ":")),
        **build_actor_card_prompt_bundle(),
    )
    actor, meta = await runtime.context.llms.ainvoke_structured_with_meta(
        "generator",
        prompt,
        GeneratedActorCardDraft,
        log_context=build_llm_log_context(
            scope="actor-card-generation",
            phase="generation",
            task_key="actor_card_generation",
            task_label="인물 카드 생성",
            artifact_key="generated_actor_results",
            artifact_label="generated_actor_results",
            schema=GeneratedActorCardDraft,
            slot_index=int(slot["slot_index"]),
        ),
    )
    actor_card = ActorCard(
        cast_id=str(slot["cast_id"]),
        display_name=str(slot["display_name"]),
        group_name=str(slot["group_name"]),
        role=actor.role,
        public_profile=actor.public_profile,
        private_goal=actor.private_goal,
        speaking_style=actor.speaking_style,
        avatar_seed=actor.avatar_seed,
        baseline_attention_tier=actor.baseline_attention_tier,
        story_function=actor.story_function,
        preferred_action_types=actor.preferred_action_types,
        action_bias_notes=actor.action_bias_notes,
    )
    return {
        "generated_actor_results": [
            {
                "slot_index": slot["slot_index"],
                "cast_id": str(slot["cast_id"]),
                "display_name": str(slot["display_name"]),
                "actor": actor_card.model_dump(mode="json"),
                "latency_seconds": meta.duration_seconds,
                "parse_failure_count": meta.parse_failure_count,
            }
        ],
    }
