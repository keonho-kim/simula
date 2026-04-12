"""목적:
- step focus 계획 노드를 제공한다.

설명:
- 후보 actor pool을 읽어 이번 step의 focus slice와 선택 actor를 확정한다.

사용한 설계 패턴:
- single node module 패턴
"""

from __future__ import annotations

import json

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.utils.coercion import (
    as_dict_list,
    as_string_list,
)
from simula.application.workflow.utils.prompt_projections import (
    PREVIOUS_SUMMARY_LIMIT,
    build_focus_candidates_prompt_view,
    build_focus_plan_coordination_frame_view,
    build_focus_plan_situation_view,
    truncate_text,
)
from simula.application.workflow.graphs.coordinator.prompts.build_step_focus_plan_prompt import (
    PROMPT as BUILD_STEP_FOCUS_PLAN_PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import StepFocusPlan
from simula.domain.reporting import latest_observer_summary
from simula.prompts.shared.output_examples import build_output_prompt_bundle


async def build_step_focus_plan(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """이번 step의 focus slice 계획을 만든다."""

    max_focus_slices = runtime.context.settings.runtime.max_focus_slices_per_step
    max_actor_calls = runtime.context.settings.runtime.max_actor_calls_per_step
    prompt = BUILD_STEP_FOCUS_PLAN_PROMPT.format(
        step_index=state["step_index"],
        focus_candidates_json=json.dumps(
            build_focus_candidates_prompt_view(list(state.get("focus_candidates", []))),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        coordination_frame_json=json.dumps(
            build_focus_plan_coordination_frame_view(
                state["plan"]["coordination_frame"]
            ),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        situation_json=json.dumps(
            build_focus_plan_situation_view(state["plan"]["situation"]),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        simulation_clock_json=json.dumps(
            state.get("simulation_clock", {}),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        previous_observer_summary=truncate_text(
            latest_observer_summary(list(state.get("observer_reports", []))),
            PREVIOUS_SUMMARY_LIMIT,
        ),
        max_focus_slices_per_step=max_focus_slices,
        max_actor_calls_per_step=max_actor_calls,
        **build_output_prompt_bundle(StepFocusPlan),
    )
    default_payload = _build_default_step_focus_plan_payload(
        state=state,
        max_focus_slices=max_focus_slices,
        max_actor_calls=max_actor_calls,
    )
    focus_plan, _ = await runtime.context.llms.ainvoke_structured_with_meta(
        "coordinator",
        prompt,
        StepFocusPlan,
        allow_default_on_failure=True,
        default_payload=default_payload,
        log_context={"scope": "step-focus", "step_index": int(state["step_index"])},
    )
    normalized = _normalize_step_focus_plan(
        step_focus_plan=focus_plan.model_dump(mode="json"),
        focus_candidates=list(state.get("focus_candidates", [])),
        max_focus_slices=max_focus_slices,
        max_actor_calls=max_actor_calls,
    )
    runtime.context.logger.info(
        "step %s focus 계획 완료 | slice %s개 | 선택 actor %s명",
        state["step_index"],
        len(as_dict_list(normalized.get("focus_slices", []))),
        len(as_string_list(normalized.get("selected_actor_ids", []))),
    )
    return {
        "step_focus_plan": normalized,
        "step_focus_history": list(state.get("step_focus_history", [])) + [normalized],
        "selected_actor_ids": as_string_list(normalized.get("selected_actor_ids", [])),
        "deferred_actor_ids": as_string_list(normalized.get("deferred_actor_ids", [])),
    }


def _build_default_step_focus_plan_payload(
    *,
    state: SimulationWorkflowState,
    max_focus_slices: int,
    max_actor_calls: int,
) -> dict[str, object]:
    candidates = list(state.get("focus_candidates", []))
    selected_actor_ids = [
        str(item.get("actor_id", ""))
        for item in candidates[: min(max_actor_calls, len(candidates), 2)]
        if str(item.get("actor_id", "")).strip()
    ]
    focus_slices = []
    if selected_actor_ids and max_focus_slices > 0:
        focus_slices.append(
            {
                "slice_id": f"step-{state['step_index']}-focus-1",
                "title": "현재 압력이 가장 높은 축을 직접 따라간다.",
                "focus_actor_ids": selected_actor_ids,
                "visibility": "public",
                "stakes": "현재 단계에서 가장 빠른 상태 변화가 날 수 있다.",
                "selection_reason": "후보 점수 상위 actor를 우선 따라가는 기본 focus 계획이다.",
            }
        )
    return {
        "step_index": int(state["step_index"]),
        "focus_summary": "현재 압력이 가장 높은 축을 우선 직접 추적한다.",
        "selection_reason": "후보 점수 상위 actor를 중심으로 기본 focus를 구성했다.",
        "selected_actor_ids": selected_actor_ids,
        "deferred_actor_ids": [
            str(item.get("actor_id", ""))
            for item in candidates
            if str(item.get("actor_id", "")) not in set(selected_actor_ids)
        ],
        "focus_slices": focus_slices,
    }


def _normalize_step_focus_plan(
    *,
    step_focus_plan: dict[str, object],
    focus_candidates: list[dict[str, object]],
    max_focus_slices: int,
    max_actor_calls: int,
) -> dict[str, object]:
    candidate_ids = [
        str(item.get("actor_id", ""))
        for item in focus_candidates
        if str(item.get("actor_id", "")).strip()
    ]
    seen_actor_ids: set[str] = set()
    normalized_slices = []
    for raw_slice in as_dict_list(step_focus_plan.get("focus_slices", []))[
        :max_focus_slices
    ]:
        slice_actor_ids: list[str] = []
        for actor_id in as_string_list(raw_slice.get("focus_actor_ids", [])):
            if actor_id in seen_actor_ids:
                continue
            if actor_id not in candidate_ids:
                continue
            if len(seen_actor_ids) + len(slice_actor_ids) >= max_actor_calls:
                break
            slice_actor_ids.append(actor_id)
        if not slice_actor_ids:
            continue
        seen_actor_ids.update(slice_actor_ids)
        normalized_slices.append(
            {
                **raw_slice,
                "focus_actor_ids": slice_actor_ids,
            }
        )

    selected_actor_ids = []
    for focus_slice in normalized_slices:
        for actor_id in as_string_list(focus_slice.get("focus_actor_ids", [])):
            if actor_id not in selected_actor_ids:
                selected_actor_ids.append(actor_id)

    deferred_actor_ids = [
        actor_id
        for actor_id in candidate_ids
        if actor_id not in set(selected_actor_ids)
    ]
    return {
        "step_index": int(str(step_focus_plan.get("step_index", 0))),
        "focus_summary": str(step_focus_plan.get("focus_summary", "")).strip()
        or "이번 단계에서 직접 따라갈 축을 우선 정리했다.",
        "selection_reason": str(step_focus_plan.get("selection_reason", "")).strip()
        or "후보 압력과 연속성을 기준으로 focus를 정리했다.",
        "selected_actor_ids": selected_actor_ids,
        "deferred_actor_ids": deferred_actor_ids,
        "focus_slices": normalized_slices,
    }
