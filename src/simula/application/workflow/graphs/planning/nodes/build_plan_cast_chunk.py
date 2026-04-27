"""Build assigned planning cast chunks."""

from __future__ import annotations

import json
from typing import cast

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.planning.prompts.plan_cast_chunk_prompt import (
    PLAN_CAST_CHUNK_ITEM_EXAMPLE,
    PROMPT as PLAN_CAST_CHUNK_PROMPT,
)
from simula.application.workflow.graphs.planning.states.state import (
    GeneratedPlanCastResult,
)
from simula.application.workflow.graphs.planning.utils.validation import (
    build_cast_roster_outline_items,
    build_plan_cast_chunk_repair_context,
    validate_plan_cast_chunk_semantics,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import CastRosterItem
from simula.shared.logging.llm import build_llm_log_context
from simula.shared.prompts.output_schema_utils import simple_array_prompt_bundle


async def build_plan_cast_chunk_serial(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Build the next cast chunk on the serial planning path."""

    chunks = list(state.get("pending_plan_cast_chunks", []))
    if not chunks:
        return {}
    result = await build_plan_cast_chunk(
        cast(
            SimulationWorkflowState,
            {
                **state,
                "plan_cast_chunk": chunks[0],
            },
        ),
        runtime,
    )
    return {
        "pending_plan_cast_chunks": chunks[1:],
        **result,
    }


async def build_plan_cast_chunk(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Build one assigned cast chunk."""

    chunk_spec = state["plan_cast_chunk"]
    assigned_outline = build_cast_roster_outline_items(
        chunk_spec.get("cast_outline_items", [])
    )
    prompt = PLAN_CAST_CHUNK_PROMPT.format(
        scenario_text=state["scenario"],
        planning_analysis_json=json.dumps(
            state["planning_analysis"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        execution_plan_frame_json=json.dumps(
            state["execution_plan_frame"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        assigned_outline_json=json.dumps(
            {"items": [item.model_dump(mode="json") for item in assigned_outline]},
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        **simple_array_prompt_bundle(
            example_item=PLAN_CAST_CHUNK_ITEM_EXAMPLE,
        ),
    )
    cast_chunk, meta = await runtime.context.llms.ainvoke_simple_with_meta(
        "planner",
        prompt,
        list[CastRosterItem],
        failure_policy="fixer",
        log_context=build_llm_log_context(
            scope="plan-cast-chunk",
            phase="planning",
            task_key="plan_cast_chunk",
            task_label="등장 인물 chunk 정리",
            artifact_key="generated_plan_cast_results",
            artifact_label="generated_plan_cast_results",
            contract_kind="simple",
            output_type_name="list[CastRosterItem]",
            chunk_index=chunk_spec["chunk_index"],
        ),
        semantic_validator=lambda parsed: validate_plan_cast_chunk_semantics(
            cast_roster=parsed,
            assigned_outline=assigned_outline,
        ),
        repair_context=build_plan_cast_chunk_repair_context(
            chunk_index=int(chunk_spec["chunk_index"]),
            assigned_outline=assigned_outline,
        ),
    )
    slot_map = {item.cast_id: item.slot_index for item in assigned_outline}
    generated_result: GeneratedPlanCastResult = {
        "chunk_index": int(chunk_spec["chunk_index"]),
        "cast_items": [
            {
                **item.model_dump(mode="json"),
                "slot_index": slot_map[item.cast_id],
            }
            for item in cast_chunk
        ],
        "parse_failure_count": meta.parse_failure_count,
    }
    return {"generated_plan_cast_results": [generated_result]}
