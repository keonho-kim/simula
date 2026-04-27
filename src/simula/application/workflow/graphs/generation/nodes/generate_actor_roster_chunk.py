"""Generate actor roster chunks."""

from __future__ import annotations

import json
from typing import cast

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.generation.prompts.actor_roster_bundle_prompt import (
    ACTOR_ROSTER_BUNDLE_EXAMPLE,
    PROMPT as ACTOR_ROSTER_BUNDLE_PROMPT,
)
from simula.application.workflow.graphs.generation.utils.roster import (
    object_list,
    slot_index,
    valid_action_types,
    validate_actor_roster_bundle,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import ActorRosterBundle
from simula.shared.logging.llm import build_llm_log_context
from simula.shared.prompts.output_schema_utils import object_prompt_bundle


async def generate_actor_roster_chunk_serial(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Generate the next actor roster chunk on the serial path."""

    chunks = list(state.get("pending_actor_roster_chunks", []))
    if not chunks:
        return {}
    result = await generate_actor_roster_chunk(
        cast(
            SimulationWorkflowState,
            {
                **state,
                "actor_roster_chunk": chunks[0],
            },
        ),
        runtime,
    )
    return {
        "pending_actor_roster_chunks": chunks[1:],
        **result,
    }


async def generate_actor_roster_chunk(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Generate one actor roster chunk in a single LLM call."""

    chunk = cast(dict[str, object], state["actor_roster_chunk"])
    chunk_index = int(str(chunk.get("chunk_index", 0)))
    cast_items = [
        cast(dict[str, object], item)
        for item in object_list(chunk.get("cast_items", []))
        if isinstance(item, dict)
    ]
    plan = cast(dict[str, object], state["plan"])
    compact_plan = {
        "interpretation": plan.get("interpretation", {}),
        "situation": plan.get("situation", {}),
        "action_catalog": plan.get("action_catalog", {}),
        "coordination_frame": plan.get("coordination_frame", {}),
        "major_events": plan.get("major_events", []),
    }
    controls = {
        "requested_num_cast": int(state["scenario_controls"]["num_cast"]),
        "allow_additional_cast": bool(
            state["scenario_controls"]["allow_additional_cast"]
        ),
        "chunk_size": len(cast_items),
    }
    prompt = ACTOR_ROSTER_BUNDLE_PROMPT.format(
        controls_json=json.dumps(
            controls,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        compact_plan_json=json.dumps(
            compact_plan,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        cast_items_json=json.dumps(
            cast_items,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        **object_prompt_bundle(example=ACTOR_ROSTER_BUNDLE_EXAMPLE),
    )
    bundle, meta = await runtime.context.llms.ainvoke_object_with_meta(
        "generator",
        prompt,
        ActorRosterBundle,
        failure_policy="fixer",
        semantic_validator=lambda parsed: validate_actor_roster_bundle(
            parsed,
            cast_items=cast_items,
            valid_action_types=valid_action_types(
                cast(dict[str, object], state["plan"])
            ),
        ),
        log_context=build_llm_log_context(
            scope="actor-roster-generation",
            phase="generation",
            task_key="actor_roster_bundle",
            task_label="인물 카드 bundle 생성",
            artifact_key="generated_actor_results",
            artifact_label="generated_actor_results",
            schema=ActorRosterBundle,
            chunk_index=chunk_index,
        ),
    )
    runtime.context.logger.debug(
        "등장 인물 bundle 결과 | chunk=%s actors=%s | %.2fs | in=%s out=%s total=%s",
        chunk_index,
        ",".join(actor.cast_id for actor in bundle.actors),
        meta.duration_seconds,
        meta.input_tokens,
        meta.output_tokens,
        meta.total_tokens,
    )
    return {
        "generated_actor_results": [
            {
                "slot_index": slot_index(cast_items, actor.cast_id),
                "cast_id": actor.cast_id,
                "display_name": actor.display_name,
                "actor": actor.model_dump(mode="json"),
                "latency_seconds": meta.duration_seconds,
                "parse_failure_count": meta.parse_failure_count,
            }
            for actor in bundle.actors
        ],
    }
