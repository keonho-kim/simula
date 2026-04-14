"""Purpose:
- Provide the compact planning pipeline nodes.
"""

from __future__ import annotations

import json
from typing import cast

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.planning.output_schema.bundles import (
    build_execution_plan_prompt_bundle,
    build_planning_analysis_prompt_bundle,
)
from simula.application.workflow.graphs.planning.prompts.build_execution_plan_prompt import (
    PROMPT as BUILD_EXECUTION_PLAN_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.build_planning_analysis_prompt import (
    PROMPT as BUILD_PLANNING_ANALYSIS_PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.application.workflow.utils.streaming import record_simulation_log_event
from simula.domain.contracts import ExecutionPlanBundle, PlanningAnalysis
from simula.domain.log_events import build_plan_finalized_event


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
        log_context={"scope": "planning-analysis"},
    )
    return {
        "planning_analysis": analysis.model_dump(mode="json"),
        "planned_max_rounds": analysis.progression_plan.max_rounds,
        "planning_latency_seconds": float(state["planning_latency_seconds"])
        + meta.duration_seconds,
    }


async def build_execution_plan(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Build the required execution plan bundle in one call."""

    prompt = BUILD_EXECUTION_PLAN_PROMPT.format(
        scenario_text=state["scenario"],
        planning_analysis_json=json.dumps(
            state["planning_analysis"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        max_rounds=state["max_rounds"],
        num_cast=state["scenario_controls"]["num_cast"],
        allow_additional_cast=str(
            state["scenario_controls"]["allow_additional_cast"]
        ).lower(),
        **build_execution_plan_prompt_bundle(
            num_cast=state["scenario_controls"]["num_cast"],
            allow_additional_cast=state["scenario_controls"][
                "allow_additional_cast"
            ],
        ),
    )
    plan_bundle, meta = await runtime.context.llms.ainvoke_structured_with_meta(
        "planner",
        prompt,
        ExecutionPlanBundle,
        log_context={"scope": "execution-plan"},
    )
    return {
        "plan": _build_plan_payload(
            planning_analysis=state["planning_analysis"],
            execution_plan=plan_bundle.model_dump(mode="json"),
        ),
        "planning_latency_seconds": float(state["planning_latency_seconds"])
        + meta.duration_seconds,
    }


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


def _build_plan_payload(
    *,
    planning_analysis: dict[str, object],
    execution_plan: dict[str, object],
) -> dict[str, object]:
    time_scope = cast(dict[str, object], planning_analysis.get("time_scope", {}))
    public_context = planning_analysis.get("public_context", [])
    private_context = planning_analysis.get("private_context", [])
    key_pressures = planning_analysis.get("key_pressures", [])
    situation = cast(dict[str, object], execution_plan["situation"])
    progression_plan = cast(dict[str, object], planning_analysis["progression_plan"])
    action_catalog = cast(dict[str, object], execution_plan["action_catalog"])
    coordination_frame = cast(dict[str, object], execution_plan["coordination_frame"])
    cast_roster = cast(
        dict[str, object],
        execution_plan["cast_roster"],
    )
    major_events = cast(list[object], execution_plan.get("major_events", []))
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
        "cast_roster": list(cast(list[object], cast_roster.get("items", []))),
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
