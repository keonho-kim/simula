"""목적:
- planning 서브그래프 노드를 제공한다.

설명:
- 시나리오 해석 파트 생성, 상황 번들 확정, 등장인물 roster 생성과 저장을 담당한다.

사용한 설계 패턴:
- planner pipeline node 패턴
"""

from __future__ import annotations

import json
from typing import cast

from langgraph.runtime import Runtime
from pydantic import BaseModel

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.planning.prompts.decide_runtime_progression_prompt import (
    PROMPT as DECIDE_RUNTIME_PROGRESSION_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.build_action_catalog_prompt import (
    PROMPT as BUILD_ACTION_CATALOG_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.build_coordination_frame_prompt import (
    PROMPT as BUILD_COORDINATION_FRAME_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.build_cast_roster_prompt import (
    PROMPT as BUILD_CAST_ROSTER_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.finalize_situation_prompt import (
    PROMPT as FINALIZE_SITUATION_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.interpret_core_prompt import (
    PROMPT as INTERPRET_CORE_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.interpret_pressure_points_prompt import (
    PROMPT as INTERPRET_PRESSURE_POINTS_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.interpret_time_scope_prompt import (
    PROMPT as INTERPRET_TIME_SCOPE_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.interpret_visibility_context_prompt import (
    PROMPT as INTERPRET_VISIBILITY_CONTEXT_PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import (
    ActionCatalog,
    CastRosterItem,
    CoordinationFrame,
    RuntimeProgressionPlan,
    ScenarioInterpretation,
    ScenarioTimeScope,
    SituationBundle,
)
from simula.prompts.shared.output_examples import (
    build_ndjson_prompt_bundle,
    build_output_prompt_bundle,
)


async def interpret_core(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """시나리오의 핵심 전제를 해석한다."""

    prompt = INTERPRET_CORE_PROMPT.format(
        scenario_text=state["scenario"],
        max_steps=state["max_steps"],
    )
    premise, meta = await runtime.context.llms.ainvoke_text_with_meta(
        "planner",
        prompt,
        log_context={"scope": "interpretation-core"},
    )
    return {
        "pending_interpretation_core": premise.strip(),
        "planning_latency_seconds": meta.duration_seconds,
    }


async def decide_runtime_progression(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """실행 시간 진행 계획을 결정한다."""

    prompt = DECIDE_RUNTIME_PROGRESSION_PROMPT.format(
        scenario_text=state["scenario"],
        core_premise=str(state.get("pending_interpretation_core", "")),
        max_steps=state["max_steps"],
        **build_output_prompt_bundle(RuntimeProgressionPlan),
    )
    progression_plan, meta = await runtime.context.llms.ainvoke_structured_with_meta(
        "planner",
        prompt,
        RuntimeProgressionPlan,
        log_context={"scope": "runtime-progression"},
    )
    runtime.context.logger.info(
        "시간 진행 계획 결정 완료 | 허용 단위 %s | 기본 단위 %s | 이유: %s",
        ",".join(progression_plan.allowed_units),
        progression_plan.default_unit,
        progression_plan.selection_reason,
    )
    return {
        "pending_progression_plan": progression_plan.model_dump(mode="json"),
        "progression_plan": progression_plan.model_dump(mode="json"),
        "planning_latency_seconds": float(state.get("planning_latency_seconds", 0.0))
        + meta.duration_seconds,
    }


async def interpret_time_scope(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """시나리오의 시간 범위를 해석한다."""

    prompt = INTERPRET_TIME_SCOPE_PROMPT.format(
        scenario_text=state["scenario"],
        max_steps=state["max_steps"],
        **build_output_prompt_bundle(ScenarioTimeScope),
    )
    time_scope, meta = await runtime.context.llms.ainvoke_structured_with_meta(
        "planner",
        prompt,
        ScenarioTimeScope,
        log_context={"scope": "interpretation-time"},
    )
    return {
        "pending_time_scope": time_scope.model_dump(mode="json"),
        "planning_latency_seconds": float(state.get("planning_latency_seconds", 0.0))
        + meta.duration_seconds,
    }


async def interpret_visibility_context(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """공개/비공개 맥락을 해석한다."""

    prompt = INTERPRET_VISIBILITY_CONTEXT_PROMPT.format(
        scenario_text=state["scenario"],
        **build_output_prompt_bundle(VisibilityContextBundle),
    )
    context_bundle, meta = await runtime.context.llms.ainvoke_structured_with_meta(
        "planner",
        prompt,
        VisibilityContextBundle,
        log_context={"scope": "interpretation-visibility"},
    )
    return {
        "pending_public_context": context_bundle.public_context,
        "pending_private_context": context_bundle.private_context,
        "planning_latency_seconds": float(state.get("planning_latency_seconds", 0.0))
        + meta.duration_seconds,
    }


async def interpret_pressure_points(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """핵심 압박과 관찰 포인트를 해석한다."""

    prompt = INTERPRET_PRESSURE_POINTS_PROMPT.format(
        scenario_text=state["scenario"],
        **build_output_prompt_bundle(PressurePointBundle),
    )
    pressure_bundle, meta = await runtime.context.llms.ainvoke_structured_with_meta(
        "planner",
        prompt,
        PressurePointBundle,
        log_context={"scope": "interpretation-pressure"},
    )
    return {
        "pending_key_pressures": pressure_bundle.key_pressures,
        "pending_observation_points": pressure_bundle.observation_points,
        "planning_latency_seconds": float(state.get("planning_latency_seconds", 0.0))
        + meta.duration_seconds,
    }


def assemble_interpretation(state: SimulationWorkflowState) -> dict[str, object]:
    """해석 파트를 ScenarioInterpretation으로 조립한다."""

    interpretation = ScenarioInterpretation(
        premise=str(state["pending_interpretation_core"]),
        time_scope=ScenarioTimeScope.model_validate(state["pending_time_scope"]),
        public_context=[str(item) for item in state.get("pending_public_context", [])],
        private_context=[
            str(item) for item in state.get("pending_private_context", [])
        ],
        key_pressures=[str(item) for item in state.get("pending_key_pressures", [])],
        observation_points=[
            str(item) for item in state.get("pending_observation_points", [])
        ],
    )
    return {
        "pending_interpretation": interpretation.model_dump(mode="json"),
    }


async def finalize_situation(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """시나리오 해석을 실행용 상황 번들로 확정한다."""

    prompt = FINALIZE_SITUATION_PROMPT.format(
        scenario_text=state["scenario"],
        interpretation_json=json.dumps(
            state["pending_interpretation"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        max_steps=state["max_steps"],
        **build_output_prompt_bundle(SituationBundle),
    )
    situation, meta = await runtime.context.llms.ainvoke_structured_with_meta(
        "planner",
        prompt,
        SituationBundle,
        log_context={"scope": "situation"},
    )
    return {
        "pending_situation": situation.model_dump(mode="json"),
        "planning_latency_seconds": float(state.get("planning_latency_seconds", 0.0))
        + meta.duration_seconds,
    }


async def build_action_catalog(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """시나리오 공통 action catalog를 구성한다."""

    prompt = BUILD_ACTION_CATALOG_PROMPT.format(
        scenario_text=state["scenario"],
        interpretation_json=json.dumps(
            state["pending_interpretation"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        situation_json=json.dumps(
            state["pending_situation"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        **build_output_prompt_bundle(ActionCatalog),
    )
    action_catalog, meta = await runtime.context.llms.ainvoke_structured_with_meta(
        "planner",
        prompt,
        ActionCatalog,
        log_context={"scope": "action_catalog"},
    )
    return {
        "pending_action_catalog": action_catalog.model_dump(mode="json"),
        "planning_latency_seconds": float(state.get("planning_latency_seconds", 0.0))
        + meta.duration_seconds,
    }


async def build_coordination_frame(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """runtime 조율 기준 프레임을 구성한다."""

    prompt = BUILD_COORDINATION_FRAME_PROMPT.format(
        scenario_text=state["scenario"],
        interpretation_json=json.dumps(
            state["pending_interpretation"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        situation_json=json.dumps(
            state["pending_situation"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        action_catalog_json=json.dumps(
            state["pending_action_catalog"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        **build_output_prompt_bundle(CoordinationFrame),
    )
    coordination_frame, meta = await runtime.context.llms.ainvoke_structured_with_meta(
        "planner",
        prompt,
        CoordinationFrame,
        log_context={"scope": "coordination_frame"},
    )
    dumped = coordination_frame.model_dump(mode="json")
    return {
        "pending_coordination_frame": dumped,
        "planning_latency_seconds": float(state.get("planning_latency_seconds", 0.0))
        + meta.duration_seconds,
    }


async def build_cast_roster(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """상황 번들에서 unique cast roster를 NDJSON으로 생성한다."""

    prompt_bundle = build_ndjson_prompt_bundle(CastRosterItem)
    prompt = BUILD_CAST_ROSTER_PROMPT.format(
        scenario_text=state["scenario"],
        interpretation_json=json.dumps(
            state["pending_interpretation"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        situation_json=json.dumps(
            state["pending_situation"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        action_catalog_json=json.dumps(
            state["pending_action_catalog"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        **prompt_bundle,
    )
    raw_text, meta = await runtime.context.llms.ainvoke_text_with_meta(
        "planner",
        prompt,
        log_context={"scope": "cast_roster"},
    )
    cast_roster = _parse_cast_roster_ndjson(raw_text)
    _validate_unique_cast_roster(cast_roster)
    interpretation = state.get("pending_interpretation")
    situation = state.get("pending_situation")
    if not isinstance(interpretation, dict) or not isinstance(situation, dict):
        raise ValueError(
            "planner 중간 상태가 비어 있어 cast roster를 확정할 수 없습니다."
        )
    action_catalog = state.get("pending_action_catalog")
    if not isinstance(action_catalog, dict):
        raise ValueError(
            "planner 중간 상태가 비어 있어 action catalog를 확정할 수 없습니다."
        )
    coordination_frame = state.get("pending_coordination_frame")
    if not isinstance(coordination_frame, dict):
        raise ValueError(
            "planner 중간 상태가 비어 있어 coordination frame을 확정할 수 없습니다."
        )
    plan_payload = {
        "interpretation": dict(interpretation),
        "situation": dict(situation),
        "progression_plan": _build_progression_plan_payload(state),
        "action_catalog": dict(action_catalog),
        "coordination_frame": dict(coordination_frame),
        "cast_roster": cast_roster,
    }
    progression_plan = plan_payload["progression_plan"]
    runtime.context.logger.info(
        "기획 단계 완료 | 허용 단위 %s | 기본 단위 %s | max_steps %s",
        ",".join(cast(list[str], progression_plan["allowed_units"])),
        progression_plan["default_unit"],
        progression_plan["max_steps"],
    )
    return {
        "plan": plan_payload,
        "pending_plan": plan_payload,
        "pending_cast_roster": cast_roster,
        "planning_latency_seconds": float(state.get("planning_latency_seconds", 0.0))
        + meta.duration_seconds,
    }


def _parse_cast_roster_ndjson(raw_text: str) -> list[dict[str, object]]:
    lines = [line.strip() for line in raw_text.splitlines() if line.strip()]
    if not lines:
        raise ValueError("cast roster NDJSON 응답이 비어 있습니다.")

    cast_roster: list[dict[str, object]] = []
    for line in lines:
        item = CastRosterItem.model_validate(json.loads(line))
        cast_roster.append(item.model_dump(mode="json"))
    return cast_roster


def _validate_unique_cast_roster(cast_roster: list[dict[str, object]]) -> None:
    cast_ids = [str(item["cast_id"]) for item in cast_roster]
    display_names = [str(item["display_name"]) for item in cast_roster]
    if len(cast_ids) != len(set(cast_ids)):
        raise ValueError("cast roster에 중복 cast_id를 허용하지 않습니다.")
    if len(display_names) != len(set(display_names)):
        raise ValueError("cast roster에 중복 display_name을 허용하지 않습니다.")


class VisibilityContextBundle(BaseModel):
    public_context: list[str]
    private_context: list[str]


class PressurePointBundle(BaseModel):
    key_pressures: list[str]
    observation_points: list[str]


def _build_progression_plan_payload(
    state: SimulationWorkflowState,
) -> dict[str, object]:
    """계획 payload에 넣을 실행 시간 진행 계획을 만든다."""

    pending_progression_plan = state.get("pending_progression_plan")
    if not isinstance(pending_progression_plan, dict):
        raise ValueError("planner progression plan이 비어 있습니다.")
    return dict(pending_progression_plan)
