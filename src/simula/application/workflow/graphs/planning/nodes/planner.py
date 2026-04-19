"""Purpose:
- Provide the compact planning pipeline nodes.
"""

from __future__ import annotations

import json
from typing import cast

from langgraph.runtime import Runtime
from langgraph.types import Overwrite, Send

from simula.shared.logging.llm import build_llm_log_context
from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.planning.nodes.planner_payloads import (
    build_plan_payload,
)
from simula.application.workflow.graphs.planning.nodes.planner_validation import (
    build_action_catalog_repair_context,
    build_cast_roster_outline_repair_context,
    build_cast_roster_outline_items,
    build_cast_roster_outline_model,
    build_major_event_plan_batch_repair_context,
    build_plan_cast_chunk_repair_context,
    validate_action_catalog_semantics,
    validate_cast_roster_count,
    validate_cast_roster_outline_semantics,
    validate_execution_plan_frame_semantics,
    validate_major_event_plan_batch_semantics,
    validate_major_events,
    validate_plan_cast_chunk_semantics,
    validate_unique_cast_roster,
)
from simula.application.workflow.graphs.planning.output_schema.bundles import (
    build_action_catalog_prompt_bundle,
    build_cast_roster_outline_prompt_bundle,
    build_coordination_frame_prompt_bundle,
    build_major_event_plan_batch_prompt_bundle,
    build_plan_cast_chunk_prompt_bundle,
    build_planning_analysis_prompt_bundle,
    build_situation_prompt_bundle,
)
from simula.application.workflow.graphs.planning.prompts.build_action_catalog_prompt import (
    PROMPT as BUILD_ACTION_CATALOG_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.build_cast_roster_outline_prompt import (
    PROMPT as BUILD_CAST_ROSTER_OUTLINE_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.build_coordination_frame_prompt import (
    PROMPT as BUILD_COORDINATION_FRAME_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.build_major_event_plan_batch_prompt import (
    PROMPT as BUILD_MAJOR_EVENT_PLAN_BATCH_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.build_plan_cast_chunk_prompt import (
    PROMPT as BUILD_PLAN_CAST_CHUNK_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.build_planning_analysis_prompt import (
    PROMPT as BUILD_PLANNING_ANALYSIS_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.build_situation_prompt import (
    PROMPT as BUILD_SITUATION_PROMPT,
)
from simula.application.workflow.graphs.planning.states.state import (
    GeneratedPlanCastResult,
    PlanCastChunkSpec,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.shared.io.streaming import record_simulation_log_event
from simula.domain.contracts import (
    ActionCatalog,
    CastRosterItem,
    CastRosterOutlineItem,
    CoordinationFrame,
    ExecutionPlanFrameBundle,
    MajorEventPlanItem,
    PlanningAnalysis,
    SituationBundle,
)
from simula.domain.reporting.events import build_plan_finalized_event

_PLAN_CAST_CHUNK_SIZE = 5


async def build_planning_analysis(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Build the required scenario analysis bundle in one call."""

    prompt = BUILD_PLANNING_ANALYSIS_PROMPT.format(
        scenario_text=state["scenario"],
        max_rounds=state["max_rounds"],
        **build_planning_analysis_prompt_bundle(),
    )
    analysis, meta = await runtime.context.llms.ainvoke_object_with_meta(
        "planner",
        prompt,
        PlanningAnalysis,
        log_context=build_llm_log_context(
            scope="planning-analysis",
            phase="planning",
            task_key="planning_analysis",
            task_label="계획 분석",
            artifact_key="planning_analysis",
            artifact_label="planning_analysis",
            schema=PlanningAnalysis,
        ),
    )
    return {
        "planning_analysis": analysis.model_dump(mode="json"),
        "planned_max_rounds": analysis.progression_plan.max_rounds,
        "planning_latency_seconds": float(state["planning_latency_seconds"])
        + meta.duration_seconds,
    }


async def build_cast_roster_outline(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Build the compact cast outline before chunk expansion."""

    prompt = BUILD_CAST_ROSTER_OUTLINE_PROMPT.format(
        scenario_text=state["scenario"],
        planning_analysis_json=json.dumps(
            state["planning_analysis"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        num_cast=state["scenario_controls"]["num_cast"],
        allow_additional_cast=str(
            state["scenario_controls"]["allow_additional_cast"]
        ).lower(),
        **build_cast_roster_outline_prompt_bundle(
            num_cast=state["scenario_controls"]["num_cast"],
            allow_additional_cast=state["scenario_controls"][
                "allow_additional_cast"
            ],
        ),
    )
    outline_items, meta = await runtime.context.llms.ainvoke_simple_with_meta(
        "planner",
        prompt,
        list[CastRosterOutlineItem],
        failure_policy="fixer",
        repair_context=build_cast_roster_outline_repair_context(
            num_cast=int(state["scenario_controls"]["num_cast"]),
            allow_additional_cast=bool(
                state["scenario_controls"]["allow_additional_cast"]
            ),
        ),
        log_context=build_llm_log_context(
            scope="cast-roster-outline",
            phase="planning",
            task_key="cast_roster_outline",
            task_label="등장 인물 개요 정리",
            artifact_key="cast_roster_outline",
            artifact_label="cast_roster_outline",
            contract_kind="simple",
            output_type_name="list[CastRosterOutlineItem]",
        ),
        semantic_validator=lambda parsed: validate_cast_roster_outline_semantics(
            cast_roster_outline=parsed,
            num_cast=int(state["scenario_controls"]["num_cast"]),
            allow_additional_cast=bool(
                state["scenario_controls"]["allow_additional_cast"]
            ),
        ),
    )
    return {
        "cast_roster_outline": [
            item.model_dump(mode="json") for item in outline_items
        ],
        "planning_latency_seconds": float(state["planning_latency_seconds"])
        + meta.duration_seconds,
    }


async def build_execution_plan_frame(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Build the execution-plan frame without the full cast roster."""

    planning_analysis_json = json.dumps(
        state["planning_analysis"],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    cast_roster_outline_json = json.dumps(
        state["cast_roster_outline"],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    cast_roster_outline = build_cast_roster_outline_model(state["cast_roster_outline"])
    planned_max_rounds = int(state["planned_max_rounds"])
    total_duration_seconds = 0.0

    situation_prompt = BUILD_SITUATION_PROMPT.format(
        scenario_text=state["scenario"],
        planning_analysis_json=planning_analysis_json,
        **build_situation_prompt_bundle(),
    )
    situation, situation_meta = await runtime.context.llms.ainvoke_object_with_meta(
        "planner",
        situation_prompt,
        SituationBundle,
        log_context=build_llm_log_context(
            scope="execution-plan-frame",
            phase="planning",
            task_key="execution_plan_situation",
            task_label="실행 계획 프레임 정리",
            artifact_key="execution_plan_frame",
            artifact_label="execution_plan_frame",
            schema=SituationBundle,
        ),
    )
    total_duration_seconds += float(situation_meta.duration_seconds)

    action_catalog_prompt = BUILD_ACTION_CATALOG_PROMPT.format(
        scenario_text=state["scenario"],
        planning_analysis_json=planning_analysis_json,
        **build_action_catalog_prompt_bundle(),
    )
    action_catalog, action_catalog_meta = (
        await runtime.context.llms.ainvoke_object_with_meta(
            "planner",
            action_catalog_prompt,
            ActionCatalog,
            failure_policy="fixer",
            semantic_validator=lambda parsed: validate_action_catalog_semantics(
                action_catalog=parsed.model_dump(mode="json")
            ),
            repair_context=build_action_catalog_repair_context(),
            log_context=build_llm_log_context(
                scope="execution-plan-frame",
                phase="planning",
                task_key="execution_plan_action_catalog",
                task_label="실행 계획 프레임 정리",
                artifact_key="execution_plan_frame",
                artifact_label="execution_plan_frame",
                schema=ActionCatalog,
            ),
        )
    )
    total_duration_seconds += float(action_catalog_meta.duration_seconds)

    coordination_frame_prompt = BUILD_COORDINATION_FRAME_PROMPT.format(
        scenario_text=state["scenario"],
        planning_analysis_json=planning_analysis_json,
        cast_roster_outline_json=cast_roster_outline_json,
        situation_json=json.dumps(
            situation.model_dump(mode="json"),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        action_catalog_json=json.dumps(
            action_catalog.model_dump(mode="json"),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        **build_coordination_frame_prompt_bundle(),
    )
    coordination_frame, coordination_frame_meta = (
        await runtime.context.llms.ainvoke_object_with_meta(
            "planner",
            coordination_frame_prompt,
            CoordinationFrame,
            log_context=build_llm_log_context(
                scope="execution-plan-frame",
                phase="planning",
                task_key="execution_plan_coordination_frame",
                task_label="실행 계획 프레임 정리",
                artifact_key="execution_plan_frame",
                artifact_label="execution_plan_frame",
                schema=CoordinationFrame,
            ),
        )
    )
    total_duration_seconds += float(coordination_frame_meta.duration_seconds)

    major_event_prompt = BUILD_MAJOR_EVENT_PLAN_BATCH_PROMPT.format(
        scenario_text=state["scenario"],
        planning_analysis_json=planning_analysis_json,
        cast_roster_outline_json=cast_roster_outline_json,
        action_catalog_json=json.dumps(
            action_catalog.model_dump(mode="json"),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        planned_max_rounds=planned_max_rounds,
        **build_major_event_plan_batch_prompt_bundle(),
    )
    major_event_batch, major_event_meta = (
        await runtime.context.llms.ainvoke_simple_with_meta(
            "planner",
            major_event_prompt,
            list[MajorEventPlanItem],
            failure_policy="fixer",
            repair_context=build_major_event_plan_batch_repair_context(
                cast_roster_outline=cast_roster_outline,
                action_catalog=action_catalog,
                planned_max_rounds=planned_max_rounds,
            ),
            semantic_validator=lambda parsed: validate_major_event_plan_batch_semantics(
                major_event_batch=parsed,
                cast_roster_outline=cast_roster_outline,
                action_catalog=action_catalog,
                planned_max_rounds=planned_max_rounds,
            ),
            log_context=build_llm_log_context(
                scope="execution-plan-frame",
                phase="planning",
                task_key="execution_plan_major_events",
                task_label="실행 계획 프레임 정리",
                artifact_key="execution_plan_frame",
                artifact_label="execution_plan_frame",
                contract_kind="simple",
                output_type_name="list[MajorEventPlanItem]",
            ),
        )
    )
    total_duration_seconds += float(major_event_meta.duration_seconds)

    frame_bundle = ExecutionPlanFrameBundle(
        situation=situation,
        action_catalog=action_catalog,
        coordination_frame=coordination_frame,
        major_events=major_event_batch,
    )
    semantic_issues = validate_execution_plan_frame_semantics(
        execution_plan_frame=frame_bundle,
        cast_roster_outline=cast_roster_outline,
        planned_max_rounds=planned_max_rounds,
    )
    if semantic_issues:
        raise ValueError("; ".join(semantic_issues))
    return {
        "execution_plan_frame": frame_bundle.model_dump(mode="json"),
        "planning_latency_seconds": float(state["planning_latency_seconds"])
        + total_duration_seconds,
    }


def prepare_plan_cast_chunks(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Prepare fixed-size cast chunks for parallel expansion."""

    outline_bundle = build_cast_roster_outline_model(state["cast_roster_outline"])
    pending_chunks: list[PlanCastChunkSpec] = []
    items = list(outline_bundle)
    for start_index in range(0, len(items), _PLAN_CAST_CHUNK_SIZE):
        pending_chunks.append(
            {
                "chunk_index": (start_index // _PLAN_CAST_CHUNK_SIZE) + 1,
                "cast_outline_items": [
                    item.model_dump(mode="json")
                    for item in items[start_index : start_index + _PLAN_CAST_CHUNK_SIZE]
                ],
            }
        )
    runtime.context.logger.info(
        "등장 인물 planning chunk 준비 | chunks=%s chunk_size=%s cast=%s",
        len(pending_chunks),
        _PLAN_CAST_CHUNK_SIZE,
        len(items),
    )
    return {
        "pending_plan_cast_chunks": pending_chunks,
        "generated_plan_cast_results": Overwrite(value=[]),
    }


def dispatch_plan_cast_chunks(state: SimulationWorkflowState) -> list[Send] | str:
    """Fan out cast chunk planning tasks."""

    pending_chunks = list(state.get("pending_plan_cast_chunks", []))
    if not pending_chunks:
        return "assemble_execution_plan"
    return [
        Send(
            "build_plan_cast_chunk",
            {
                "run_id": state["run_id"],
                "scenario": state["scenario"],
                "planning_analysis": state["planning_analysis"],
                "execution_plan_frame": state["execution_plan_frame"],
                "plan_cast_chunk": chunk,
            },
        )
        for chunk in pending_chunks
    ]


async def build_plan_cast_chunk(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Build one assigned cast chunk."""

    chunk_spec = state["plan_cast_chunk"]
    assigned_outline = build_cast_roster_outline_items(
        chunk_spec.get("cast_outline_items", [])
    )
    prompt = BUILD_PLAN_CAST_CHUNK_PROMPT.format(
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
        **build_plan_cast_chunk_prompt_bundle(),
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


def assemble_execution_plan(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Assemble the execution-plan payload from the frame and chunk results."""

    frame = cast(dict[str, object], state["execution_plan_frame"])
    generated_results = [
        cast(dict[str, object], item)
        for item in state.get("generated_plan_cast_results", [])
        if isinstance(item, dict)
    ]
    cast_items: list[dict[str, object]] = []
    for result in sorted(
        generated_results,
        key=lambda item: int(item.get("chunk_index", 0)),
    ):
        for cast_item in cast(list[object], result.get("cast_items", [])):
            if isinstance(cast_item, dict):
                cast_items.append(cast(dict[str, object], cast_item))
    cast_items.sort(key=lambda item: int(item.get("slot_index", 0)))
    normalized_cast_items = [
        {key: value for key, value in item.items() if key != "slot_index"}
        for item in cast_items
    ]
    plan = build_plan_payload(
        planning_analysis=state["planning_analysis"],
        execution_plan_frame=frame,
        cast_roster=normalized_cast_items,
    )
    runtime.context.logger.info(
        "실행 계획 조립 완료 | chunks=%s cast=%s",
        len(generated_results),
        len(normalized_cast_items),
    )
    return {"plan": plan}


def finalize_plan(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Validate and persist the compact execution plan."""

    plan = dict(state["plan"])
    cast_roster = list(plan.get("cast_roster", []))
    validate_unique_cast_roster(cast_roster)
    validate_cast_roster_count(
        cast_roster=cast_roster,
        num_cast=int(state["scenario_controls"]["num_cast"]),
        allow_additional_cast=bool(
            state["scenario_controls"]["allow_additional_cast"]
        ),
    )
    validate_major_events(
        major_events=[
            cast(dict[str, object], item)
            for item in cast(list[object], plan.get("major_events", []))
            if isinstance(item, dict)
        ],
        cast_roster=cast_roster,
        planned_max_rounds=int(state["planned_max_rounds"]),
    )
    action_catalog = cast(dict[str, object], plan.get("action_catalog", {}))
    raw_actions = action_catalog.get("actions", [])
    action_count = len(raw_actions) if isinstance(raw_actions, list) else 0
    progression_plan = cast(dict[str, object], plan.get("progression_plan", {}))
    major_event_count = len(
        [
            item
            for item in cast(list[object], plan.get("major_events", []))
            if isinstance(item, dict)
        ]
    )
    runtime.context.store.save_plan(state["run_id"], plan)
    record_simulation_log_event(
        runtime.context,
        build_plan_finalized_event(run_id=str(state["run_id"]), plan=plan),
    )
    runtime.context.logger.info(
        "계획 정리 완료 | cast=%s action_types=%s major_events=%s planned_rounds=%s default_elapsed_unit=%s",
        len(cast_roster),
        action_count,
        major_event_count,
        progression_plan.get("max_rounds", "-"),
        progression_plan.get("default_elapsed_unit", "-"),
    )
    return {"plan": plan}
