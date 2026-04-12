"""목적:
- step별 시간 경과 추론 노드를 제공한다.

설명:
- 최신 action과 현재 intent 상태를 읽고 이번 step의 실제 경과 시간을 정규화한다.

사용한 설계 패턴:
- 시간 추론 node 패턴
"""

from __future__ import annotations

import json

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.runtime.prompts.estimate_step_time_advance_prompt import (
    PROMPT as ESTIMATE_STEP_TIME_ADVANCE_PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import (
    RuntimeProgressionPlan,
    SimulationClockSnapshot,
    StepTimeAdvanceProposal,
    StepTimeAdvanceRecord,
)
from simula.domain.time_steps import (
    cumulative_elapsed_label,
    duration_label,
    duration_minutes,
)
from simula.prompts.shared.output_examples import build_output_prompt_bundle

_MINIMUM_STEP_MINUTES = 30


async def estimate_step_time_advance(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """이번 step의 실제 경과 시간을 추론하고 clock 상태를 갱신한다."""

    prompt = _build_estimate_prompt(state)
    default_payload = _build_default_time_advance_payload(state)
    proposal, meta = await runtime.context.llms.ainvoke_structured_with_meta(
        "observer",
        prompt,
        StepTimeAdvanceProposal,
        allow_default_on_failure=True,
        default_payload=default_payload,
        log_context={
            "step_index": int(state["step_index"]),
            "scope": "time-progression",
        },
    )
    record = _build_time_record(state=state, proposal=proposal)
    runtime.context.logger.info(
        "step 시간 진행 추론 완료 | step %s | +%s | 누적 %s",
        state["step_index"],
        record.elapsed_label,
        record.total_elapsed_label,
    )
    return {
        "pending_step_time_advance": record.model_dump(mode="json"),
        "simulation_clock": SimulationClockSnapshot(
            total_elapsed_minutes=record.total_elapsed_minutes,
            total_elapsed_label=record.total_elapsed_label,
            last_elapsed_minutes=record.elapsed_minutes,
            last_elapsed_label=record.elapsed_label,
            last_advanced_step_index=record.step_index,
        ).model_dump(mode="json"),
        "step_time_history": list(state.get("step_time_history", []))
        + [record.model_dump(mode="json")],
        "parse_failures": int(state.get("parse_failures", 0))
        + meta.parse_failure_count,
    }


def _build_estimate_prompt(state: SimulationWorkflowState) -> str:
    return ESTIMATE_STEP_TIME_ADVANCE_PROMPT.format(
        step_index=state["step_index"],
        latest_actions_json=json.dumps(
            list(state.get("latest_step_activities", [])),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        current_intent_states_json=json.dumps(
            list(state.get("actor_intent_states", [])),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        progression_plan_json=json.dumps(
            state["plan"]["progression_plan"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        simulation_clock_json=json.dumps(
            state.get("simulation_clock", {}),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
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
        **build_output_prompt_bundle(StepTimeAdvanceProposal),
    )


def _build_default_time_advance_payload(
    state: SimulationWorkflowState,
) -> dict[str, object]:
    plan = RuntimeProgressionPlan.model_validate(state["plan"]["progression_plan"])
    default_amount = 30 if plan.default_unit == "minute" else 1
    return {
        "elapsed_unit": plan.default_unit,
        "elapsed_amount": default_amount,
        "selection_reason": "최신 action만으로 더 긴 시간 점프를 정당화하기 어려워 기본 pacing을 적용한다.",
        "signals": [
            "기본 pacing 단위를 따른다.",
            "한 step 최소 경과 시간 30분을 보장한다.",
        ],
    }


def _build_time_record(
    *,
    state: SimulationWorkflowState,
    proposal: StepTimeAdvanceProposal,
) -> StepTimeAdvanceRecord:
    plan = RuntimeProgressionPlan.model_validate(state["plan"]["progression_plan"])
    if proposal.elapsed_unit not in plan.allowed_units:
        raise ValueError(f"허용되지 않은 step 시간 단위입니다: {proposal.elapsed_unit}")

    elapsed_minutes = duration_minutes(
        time_unit=proposal.elapsed_unit,
        amount=proposal.elapsed_amount,
    )
    if elapsed_minutes < _MINIMUM_STEP_MINUTES:
        raise ValueError("한 step은 최소 30분 이상 진행되어야 합니다.")

    previous_clock = SimulationClockSnapshot.model_validate(state["simulation_clock"])
    total_elapsed_minutes = previous_clock.total_elapsed_minutes + elapsed_minutes
    return StepTimeAdvanceRecord(
        step_index=int(state["step_index"]),
        elapsed_unit=proposal.elapsed_unit,
        elapsed_amount=proposal.elapsed_amount,
        elapsed_minutes=elapsed_minutes,
        elapsed_label=duration_label(
            time_unit=proposal.elapsed_unit,
            amount=proposal.elapsed_amount,
        ),
        total_elapsed_minutes=total_elapsed_minutes,
        total_elapsed_label=cumulative_elapsed_label(total_elapsed_minutes),
        selection_reason=proposal.selection_reason,
        signals=proposal.signals,
    )
