"""Purpose:
- Provide the compact planning pipeline nodes.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from typing import cast

from langgraph.runtime import Runtime
from langgraph.types import Overwrite, Send

from simula.application.llm_logging import build_llm_log_context
from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.planning.output_schema.bundles import (
    build_cast_roster_outline_prompt_bundle,
    build_execution_plan_frame_prompt_bundle,
    build_plan_cast_chunk_prompt_bundle,
    build_planning_analysis_prompt_bundle,
)
from simula.application.workflow.graphs.planning.prompts.build_cast_roster_outline_prompt import (
    PROMPT as BUILD_CAST_ROSTER_OUTLINE_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.build_execution_plan_prompt import (
    PROMPT as BUILD_EXECUTION_PLAN_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.build_plan_cast_chunk_prompt import (
    PROMPT as BUILD_PLAN_CAST_CHUNK_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.build_planning_analysis_prompt import (
    PROMPT as BUILD_PLANNING_ANALYSIS_PROMPT,
)
from simula.application.workflow.graphs.planning.states.state import (
    GeneratedPlanCastResult,
    PlanCastChunkSpec,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.application.workflow.utils.streaming import record_simulation_log_event
from simula.domain.contracts import (
    CastRoster,
    CastRosterOutlineBundle,
    CastRosterOutlineItem,
    ExecutionPlanFrameBundle,
    PlanningAnalysis,
)
from simula.domain.log_events import build_plan_finalized_event

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
    analysis, meta = await runtime.context.llms.ainvoke_structured_with_meta(
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
    outline_bundle, meta = await runtime.context.llms.ainvoke_structured_with_meta(
        "planner",
        prompt,
        CastRosterOutlineBundle,
        log_context=build_llm_log_context(
            scope="cast-roster-outline",
            phase="planning",
            task_key="cast_roster_outline",
            task_label="등장 인물 개요 정리",
            artifact_key="cast_roster_outline",
            artifact_label="cast_roster_outline",
            schema=CastRosterOutlineBundle,
        ),
        semantic_validator=lambda parsed: validate_cast_roster_outline_semantics(
            cast_roster_outline=parsed,
            num_cast=int(state["scenario_controls"]["num_cast"]),
            allow_additional_cast=bool(
                state["scenario_controls"]["allow_additional_cast"]
            ),
        ),
        repair_context=build_cast_roster_outline_repair_context(
            num_cast=int(state["scenario_controls"]["num_cast"]),
            allow_additional_cast=bool(
                state["scenario_controls"]["allow_additional_cast"]
            ),
        ),
    )
    return {
        "cast_roster_outline": outline_bundle.model_dump(mode="json"),
        "planning_latency_seconds": float(state["planning_latency_seconds"])
        + meta.duration_seconds,
    }


async def build_execution_plan_frame(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Build the execution-plan frame without the full cast roster."""

    prompt = BUILD_EXECUTION_PLAN_PROMPT.format(
        scenario_text=state["scenario"],
        planning_analysis_json=json.dumps(
            state["planning_analysis"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        cast_roster_outline_json=json.dumps(
            state["cast_roster_outline"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        max_rounds=state["max_rounds"],
        **build_execution_plan_frame_prompt_bundle(),
    )
    frame_bundle, meta = await runtime.context.llms.ainvoke_structured_with_meta(
        "planner",
        prompt,
        ExecutionPlanFrameBundle,
        log_context=build_llm_log_context(
            scope="execution-plan-frame",
            phase="planning",
            task_key="execution_plan_frame",
            task_label="실행 계획 프레임 정리",
            artifact_key="execution_plan_frame",
            artifact_label="execution_plan_frame",
            schema=ExecutionPlanFrameBundle,
        ),
        semantic_validator=lambda parsed: validate_execution_plan_frame_semantics(
            execution_plan_frame=parsed,
            cast_roster_outline=build_cast_roster_outline_model(
                state["cast_roster_outline"]
            ),
            planned_max_rounds=int(state["planned_max_rounds"]),
        ),
        repair_context=build_execution_plan_frame_repair_context(
            cast_roster_outline=build_cast_roster_outline_model(
                state["cast_roster_outline"]
            ),
            planned_max_rounds=int(state["planned_max_rounds"]),
        ),
    )
    return {
        "execution_plan_frame": frame_bundle.model_dump(mode="json"),
        "planning_latency_seconds": float(state["planning_latency_seconds"])
        + meta.duration_seconds,
    }


def prepare_plan_cast_chunks(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Prepare fixed-size cast chunks for parallel expansion."""

    outline_bundle = build_cast_roster_outline_model(state["cast_roster_outline"])
    pending_chunks: list[PlanCastChunkSpec] = []
    items = list(outline_bundle.items)
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
    cast_chunk, meta = await runtime.context.llms.ainvoke_structured_with_meta(
        "planner",
        prompt,
        CastRoster,
        log_context=build_llm_log_context(
            scope="plan-cast-chunk",
            phase="planning",
            task_key="plan_cast_chunk",
            task_label="등장 인물 chunk 정리",
            artifact_key="generated_plan_cast_results",
            artifact_label="generated_plan_cast_results",
            schema=CastRoster,
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
            for item in cast_chunk.items
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
    plan = _build_plan_payload(
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
    _validate_unique_cast_roster(cast_roster)
    _validate_cast_roster_count(
        cast_roster=cast_roster,
        num_cast=int(state["scenario_controls"]["num_cast"]),
        allow_additional_cast=bool(
            state["scenario_controls"]["allow_additional_cast"]
        ),
    )
    _validate_major_events(
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
        build_plan_finalized_event(
            run_id=str(state["run_id"]),
            plan=plan,
        )
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


def validate_cast_roster_outline_semantics(
    *,
    cast_roster_outline: CastRosterOutlineBundle,
    num_cast: int,
    allow_additional_cast: bool,
) -> list[str]:
    """Return semantic issues for the cast roster outline."""

    issues: list[str] = []
    items = list(cast_roster_outline.items)
    cast_count = len(items)
    if allow_additional_cast:
        if cast_count < num_cast:
            issues.append(
                f"cast roster outline는 최소 {num_cast}명을 포함해야 합니다. 현재 {cast_count}명입니다."
            )
    elif cast_count != num_cast:
        issues.append(
            f"cast roster outline는 정확히 {num_cast}명이어야 합니다. 현재 {cast_count}명입니다."
        )

    expected_slots = list(range(1, cast_count + 1))
    actual_slots = [item.slot_index for item in items]
    if actual_slots != expected_slots:
        issues.append(
            "cast roster outline의 slot_index 는 1부터 끊김 없이 증가해야 합니다."
        )
    return issues


def build_cast_roster_outline_repair_context(
    *,
    num_cast: int,
    allow_additional_cast: bool,
) -> dict[str, object]:
    """Build repair context for the cast roster outline."""

    return {
        "num_cast": num_cast,
        "allow_additional_cast": allow_additional_cast,
        "repair_guidance": [
            "`slot_index` must start at 1 and increase without gaps up to the final cast count.",
            (
                f"Return exactly {num_cast} cast outline items."
                if not allow_additional_cast
                else f"Return at least {num_cast} cast outline items."
            ),
            "Reuse scenario-grounded participant names or role labels only.",
        ],
    }


def validate_execution_plan_frame_semantics(
    *,
    execution_plan_frame: ExecutionPlanFrameBundle,
    cast_roster_outline: CastRosterOutlineBundle,
    planned_max_rounds: int,
) -> list[str]:
    """Return semantic issues for the execution-plan frame."""

    issues: list[str] = []
    cast_roster = cast(
        list[dict[str, object]],
        [
            {"cast_id": item.cast_id, "display_name": item.display_name}
            for item in cast_roster_outline.items
        ],
    )
    try:
        _validate_major_events(
            major_events=[
                item.model_dump(mode="json") for item in execution_plan_frame.major_events
            ],
            cast_roster=cast_roster,
            planned_max_rounds=planned_max_rounds,
        )
    except ValueError as exc:
        issues.append(str(exc))
    return issues


def build_execution_plan_frame_repair_context(
    *,
    cast_roster_outline: CastRosterOutlineBundle,
    planned_max_rounds: int,
) -> dict[str, object]:
    """Build repair context for the execution-plan frame."""

    return {
        "valid_cast_ids": [item.cast_id for item in cast_roster_outline.items],
        "max_actions": 5,
        "max_major_events": 6,
        "planned_max_rounds": planned_max_rounds,
        "repair_guidance": [
            "Keep `action_catalog.actions` at 5 items or fewer.",
            "Keep `major_events` at 6 items or fewer.",
            "Use only the provided cast ids in `major_events.participant_cast_ids`.",
        ],
    }


def validate_plan_cast_chunk_semantics(
    *,
    cast_roster: CastRoster,
    assigned_outline: list[CastRosterOutlineItem],
) -> list[str]:
    """Return semantic issues for one cast chunk."""

    issues: list[str] = []
    expected_by_id = {
        item.cast_id: item.display_name for item in assigned_outline
    }
    actual_items = list(cast_roster.items)
    if len(actual_items) != len(assigned_outline):
        issues.append(
            f"cast chunk는 정확히 {len(assigned_outline)}명이어야 합니다. 현재 {len(actual_items)}명입니다."
        )
        return issues

    actual_ids = [item.cast_id for item in actual_items]
    unexpected_ids = [cast_id for cast_id in actual_ids if cast_id not in expected_by_id]
    missing_ids = [cast_id for cast_id in expected_by_id if cast_id not in actual_ids]
    if unexpected_ids:
        issues.append(
            "cast chunk에 배정되지 않은 cast_id가 포함되어 있습니다: "
            + ", ".join(unexpected_ids)
        )
    if missing_ids:
        issues.append(
            "cast chunk에 누락된 cast_id가 있습니다: " + ", ".join(missing_ids)
        )
    for item in actual_items:
        expected_display_name = expected_by_id.get(item.cast_id)
        if (
            expected_display_name is not None
            and item.display_name != expected_display_name
        ):
            issues.append(
                f"cast_id `{item.cast_id}` 의 display_name 은 `{expected_display_name}` 이어야 합니다."
            )
    return issues


def build_plan_cast_chunk_repair_context(
    *,
    chunk_index: int,
    assigned_outline: list[CastRosterOutlineItem],
) -> dict[str, object]:
    """Build repair context for one cast chunk."""

    return {
        "chunk_index": chunk_index,
        "assigned_cast_ids": [item.cast_id for item in assigned_outline],
        "assigned_display_names": {
            item.cast_id: item.display_name for item in assigned_outline
        },
        "exact_chunk_size": len(assigned_outline),
        "repair_guidance": [
            "Return only the assigned cast ids for this chunk.",
            "Reuse each assigned display_name exactly as provided.",
            f"Return exactly {len(assigned_outline)} cast items.",
        ],
    }


def build_cast_roster_outline_model(
    payload: dict[str, object],
) -> CastRosterOutlineBundle:
    """Build the typed cast-roster outline model from JSON payload."""

    return CastRosterOutlineBundle.model_validate(payload)


def build_cast_roster_outline_items(
    values: Sequence[object],
) -> list[CastRosterOutlineItem]:
    """Build typed cast-roster outline items from raw values."""

    return [
        CastRosterOutlineItem.model_validate(item)
        for item in values
        if isinstance(item, dict)
    ]


def _build_plan_payload(
    *,
    planning_analysis: dict[str, object],
    execution_plan_frame: dict[str, object],
    cast_roster: list[dict[str, object]],
) -> dict[str, object]:
    time_scope = cast(dict[str, object], planning_analysis.get("time_scope", {}))
    public_context = planning_analysis.get("public_context", [])
    private_context = planning_analysis.get("private_context", [])
    key_pressures = planning_analysis.get("key_pressures", [])
    situation = cast(dict[str, object], execution_plan_frame["situation"])
    progression_plan = cast(dict[str, object], planning_analysis["progression_plan"])
    action_catalog = cast(dict[str, object], execution_plan_frame["action_catalog"])
    coordination_frame = cast(
        dict[str, object], execution_plan_frame["coordination_frame"]
    )
    major_events = cast(list[object], execution_plan_frame.get("major_events", []))
    interpretation = {
        "brief_summary": str(planning_analysis.get("brief_summary", "")),
        "premise": str(planning_analysis.get("premise", "")),
        "time_scope": dict(time_scope),
        "public_context": list(cast(list[object], public_context)),
        "private_context": list(cast(list[object], private_context)),
        "key_pressures": list(cast(list[object], key_pressures)),
    }
    return {
        "interpretation": interpretation,
        "situation": dict(situation),
        "progression_plan": dict(progression_plan),
        "action_catalog": dict(action_catalog),
        "coordination_frame": dict(coordination_frame),
        "cast_roster": list(cast_roster),
        "major_events": list(major_events),
    }


def _validate_unique_cast_roster(cast_roster: list[dict[str, object]]) -> None:
    cast_ids = [str(item["cast_id"]) for item in cast_roster]
    display_names = [str(item["display_name"]) for item in cast_roster]
    if len(cast_ids) != len(set(cast_ids)):
        raise ValueError("cast roster에 중복 cast_id를 허용하지 않습니다.")
    if len(display_names) != len(set(display_names)):
        raise ValueError("cast roster에 중복 display_name을 허용하지 않습니다.")


def _validate_cast_roster_count(
    *,
    cast_roster: list[dict[str, object]],
    num_cast: int,
    allow_additional_cast: bool,
) -> None:
    cast_count = len(cast_roster)
    if allow_additional_cast:
        if cast_count < num_cast:
            raise ValueError(
                f"cast roster는 최소 {num_cast}명을 포함해야 합니다. 현재 {cast_count}명입니다."
            )
        return
    if cast_count != num_cast:
        raise ValueError(
            f"cast roster는 정확히 {num_cast}명이어야 합니다. 현재 {cast_count}명입니다."
        )


def _validate_major_events(
    *,
    major_events: list[dict[str, object]],
    cast_roster: list[dict[str, object]],
    planned_max_rounds: int,
) -> None:
    cast_ids = {
        str(item.get("cast_id", "")).strip()
        for item in cast_roster
        if str(item.get("cast_id", "")).strip()
    }
    event_ids: set[str] = set()
    for event in major_events:
        event_id = str(event.get("event_id", "")).strip()
        if not event_id:
            raise ValueError("major event에 빈 event_id를 허용하지 않습니다.")
        if event_id in event_ids:
            raise ValueError(f"major event_id 중복을 허용하지 않습니다: {event_id}")
        event_ids.add(event_id)
        earliest_round = _int_value(event.get("earliest_round", 0))
        latest_round = _int_value(event.get("latest_round", 0))
        if earliest_round < 1 or latest_round < 1:
            raise ValueError("major event round window는 1 이상이어야 합니다.")
        if earliest_round > latest_round:
            raise ValueError(
                f"major event `{event_id}` 는 earliest_round가 latest_round보다 클 수 없습니다."
            )
        if latest_round > planned_max_rounds:
            raise ValueError(
                f"major event `{event_id}` 는 planned max round {planned_max_rounds} 안에 있어야 합니다."
            )
        participant_values = event.get("participant_cast_ids", [])
        participant_cast_ids = (
            [str(item).strip() for item in participant_values if str(item).strip()]
            if isinstance(participant_values, list)
            else []
        )
        invalid_cast_ids = [
            cast_id for cast_id in participant_cast_ids if cast_id not in cast_ids
        ]
        if invalid_cast_ids:
            raise ValueError(
                f"major event `{event_id}` 의 participant_cast_ids가 cast roster에 없습니다: {', '.join(invalid_cast_ids)}"
            )


def _int_value(value: object) -> int:
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return 0
