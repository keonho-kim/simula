"""Purpose:
- Build the single required round directive.
"""

from __future__ import annotations

import json

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.coordinator.output_schema.bundles import (
    build_round_directive_prompt_bundle,
)
from simula.application.workflow.graphs.coordinator.prompts.round_directive_prompt import (
    PROMPT as BUILD_STEP_DIRECTIVE_PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.application.workflow.utils.streaming import emit_custom_event
from simula.application.workflow.utils.coercion import as_dict_list, as_string_list
from simula.application.workflow.utils.prompt_projections import (
    PREVIOUS_SUMMARY_LIMIT,
    build_deferred_actor_views,
    build_event_memory_prompt_view,
    build_focus_candidates_prompt_view,
    build_focus_plan_coordination_frame_view,
    build_focus_plan_situation_view,
    truncate_text,
)
from simula.domain.contracts import RoundDirective
from simula.domain.log_events import (
    build_round_background_updated_event,
    build_round_focus_selected_event,
)
from simula.domain.reporting import latest_observer_summary


async def build_round_directive(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Build one required round directive including background updates."""

    max_focus_slices = runtime.context.settings.runtime.max_focus_slices_per_step
    max_actor_calls = runtime.context.settings.runtime.max_actor_calls_per_step
    candidate_ids = [
        str(item.get("cast_id", ""))
        for item in list(state.get("focus_candidates", []))
        if str(item.get("cast_id", "")).strip()
    ]
    deferred_cast_ids = candidate_ids[max_actor_calls:]
    deferred_actors = [
        actor
        for actor in list(state["actors"])
        if str(actor.get("cast_id", "")) in set(deferred_cast_ids)
    ]
    prompt = BUILD_STEP_DIRECTIVE_PROMPT.format(
        round_index=state["round_index"],
        focus_candidates_json=json.dumps(
            build_focus_candidates_prompt_view(list(state["focus_candidates"])),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        deferred_actors_json=json.dumps(
            build_deferred_actor_views(deferred_actors),
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
            state["simulation_clock"],
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        event_memory_json=json.dumps(
            build_event_memory_prompt_view(state.get("event_memory", {})),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        previous_observer_summary=truncate_text(
            latest_observer_summary(list(state["observer_reports"])),
            PREVIOUS_SUMMARY_LIMIT,
        ),
        max_focus_slices_per_step=max_focus_slices,
        max_actor_calls_per_step=max_actor_calls,
        **build_round_directive_prompt_bundle(),
    )
    default_payload = _build_default_round_directive_payload(
        state=state,
        max_focus_slices=max_focus_slices,
        max_actor_calls=max_actor_calls,
    )
    directive, meta = await runtime.context.llms.ainvoke_structured_with_meta(
        "coordinator",
        prompt,
        RoundDirective,
        allow_default_on_failure=True,
        default_payload=default_payload,
        log_context={
            "scope": "round-directive",
            "round_index": int(state["round_index"]),
        },
    )
    normalized = _normalize_round_directive(
        directive=directive.model_dump(mode="json"),
        focus_candidates=list(state["focus_candidates"]),
        max_focus_slices=max_focus_slices,
        max_actor_calls=max_actor_calls,
    )
    errors = list(state["errors"])
    if meta.forced_default:
        errors.append(f"round {state['round_index']} directive defaulted")
    emit_custom_event(
        build_round_focus_selected_event(
            run_id=str(state["run_id"]),
            round_index=int(state["round_index"]),
            round_focus_plan=normalized,
        )
    )
    background_updates = as_dict_list(normalized.get("background_updates", []))
    if background_updates:
        emit_custom_event(
            build_round_background_updated_event(
                run_id=str(state["run_id"]),
                round_index=int(state["round_index"]),
                background_updates=background_updates,
            )
        )
    return {
        "round_focus_plan": normalized,
        "round_focus_history": list(state["round_focus_history"]) + [normalized],
        "selected_cast_ids": as_string_list(normalized.get("selected_cast_ids", [])),
        "deferred_cast_ids": as_string_list(normalized.get("deferred_cast_ids", [])),
        "latest_background_updates": background_updates,
        "background_updates": list(state["background_updates"])
        + background_updates,
        "errors": errors,
    }


def _build_default_round_directive_payload(
    *,
    state: SimulationWorkflowState,
    max_focus_slices: int,
    max_actor_calls: int,
) -> dict[str, object]:
    candidates = list(state["focus_candidates"])
    desired_selected_count = _desired_selected_count(
        candidate_count=len(candidates),
        max_actor_calls=max_actor_calls,
    )
    selected_cast_ids = [
        str(item.get("cast_id", ""))
        for item in candidates[:desired_selected_count]
        if str(item.get("cast_id", "")).strip()
    ]
    focus_slices: list[dict[str, object]] = []
    if selected_cast_ids and max_focus_slices > 0:
        focus_slices.append(
            {
                "slice_id": f"round-{state['round_index']}-focus-1",
                "title": "현재 압력이 가장 높은 축을 직접 따라간다.",
                "focus_cast_ids": selected_cast_ids,
                "visibility": "public",
                "stakes": "현재 단계에서 가장 빠른 상태 변화가 날 수 있다.",
                "selection_reason": "후보 점수 상위 actor를 우선 따라가는 기본 focus 계획이다.",
            }
        )
    return {
        "round_index": int(state["round_index"]),
        "focus_summary": "현재 압력이 가장 높은 축을 우선 직접 추적한다.",
        "selection_reason": "후보 점수 상위 actor를 중심으로 기본 focus를 구성했다.",
        "selected_cast_ids": selected_cast_ids,
        "deferred_cast_ids": [
            str(item.get("cast_id", ""))
            for item in candidates
            if str(item.get("cast_id", "")) not in set(selected_cast_ids)
        ],
        "focus_slices": focus_slices,
        "background_updates": [],
    }


def _normalize_round_directive(
    *,
    directive: dict[str, object],
    focus_candidates: list[dict[str, object]],
    max_focus_slices: int,
    max_actor_calls: int,
) -> dict[str, object]:
    desired_selected_count = _desired_selected_count(
        candidate_count=len(focus_candidates),
        max_actor_calls=max_actor_calls,
    )
    candidate_ids = [
        str(item.get("cast_id", ""))
        for item in focus_candidates
        if str(item.get("cast_id", "")).strip()
    ]
    seen_cast_ids: set[str] = set()
    normalized_slices = []
    for raw_slice in as_dict_list(directive.get("focus_slices", []))[:max_focus_slices]:
        slice_cast_ids: list[str] = []
        for cast_id in as_string_list(raw_slice.get("focus_cast_ids", [])):
            if cast_id in seen_cast_ids or cast_id not in candidate_ids:
                continue
            if len(seen_cast_ids) + len(slice_cast_ids) >= max_actor_calls:
                break
            slice_cast_ids.append(cast_id)
        if not slice_cast_ids:
            continue
        seen_cast_ids.update(slice_cast_ids)
        normalized_slices.append({**raw_slice, "focus_cast_ids": slice_cast_ids})

    selected_cast_ids: list[str] = []
    for focus_slice in normalized_slices:
        for cast_id in as_string_list(focus_slice.get("focus_cast_ids", [])):
            if cast_id not in selected_cast_ids:
                selected_cast_ids.append(cast_id)

    backfill_cast_ids = [
        cast_id
        for cast_id in candidate_ids
        if cast_id not in set(selected_cast_ids)
    ][: max(0, desired_selected_count - len(selected_cast_ids))]
    if backfill_cast_ids:
        if len(normalized_slices) < max_focus_slices:
            normalized_slices.append(
                {
                    "slice_id": f"round-{int(str(directive.get('round_index', 0)))}-context-expansion",
                    "title": "주변 반응 확대",
                    "focus_cast_ids": backfill_cast_ids,
                    "visibility": "public",
                    "stakes": "핵심 갈등에 반응하는 주변 인물의 선택도 다음 국면을 바꿀 수 있다.",
                    "selection_reason": "핵심 축과 직접 연결된 주변 반응까지 이번 라운드에서 함께 추적한다.",
                }
            )
        elif normalized_slices:
            expanded = list(as_string_list(normalized_slices[0].get("focus_cast_ids", [])))
            for cast_id in backfill_cast_ids:
                if cast_id not in expanded:
                    expanded.append(cast_id)
            normalized_slices[0] = {
                **normalized_slices[0],
                "focus_cast_ids": expanded[:max_actor_calls],
            }

    selected_cast_ids = []
    for focus_slice in normalized_slices:
        for cast_id in as_string_list(focus_slice.get("focus_cast_ids", [])):
            if cast_id not in selected_cast_ids:
                selected_cast_ids.append(cast_id)

    deferred_cast_ids = [
        cast_id for cast_id in candidate_ids if cast_id not in set(selected_cast_ids)
    ]
    background_updates = []
    for raw_update in as_dict_list(directive.get("background_updates", [])):
        cast_id = str(raw_update.get("cast_id", "")).strip()
        if not cast_id or cast_id not in deferred_cast_ids:
            continue
        background_updates.append(
            {
                "round_index": int(str(directive.get("round_index", 0) or 0)),
                "cast_id": cast_id,
                "summary": str(raw_update.get("summary", "")).strip(),
                "pressure_level": str(raw_update.get("pressure_level", "low")).strip()
                or "low",
                "future_hook": str(raw_update.get("future_hook", "")).strip(),
            }
        )
    return {
        "round_index": int(str(directive.get("round_index", 0))),
        "focus_summary": str(directive.get("focus_summary", "")).strip()
        or "이번 단계에서 직접 따라갈 축을 정리했다.",
        "selection_reason": str(directive.get("selection_reason", "")).strip()
        or "후보 압력과 연속성을 기준으로 focus를 정리했다.",
        "selected_cast_ids": selected_cast_ids,
        "deferred_cast_ids": deferred_cast_ids,
        "focus_slices": normalized_slices,
        "background_updates": background_updates,
    }


def _desired_selected_count(*, candidate_count: int, max_actor_calls: int) -> int:
    if candidate_count >= 8:
        return min(max_actor_calls, 4)
    if candidate_count >= 5:
        return min(max_actor_calls, 3)
    return min(max_actor_calls, candidate_count, 2)
