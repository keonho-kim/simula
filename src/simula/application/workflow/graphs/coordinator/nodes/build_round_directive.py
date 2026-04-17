"""Purpose:
- Build the single required round directive.
"""

from __future__ import annotations

import json
from typing import cast

from langgraph.runtime import Runtime

from simula.application.llm_logging import build_llm_log_context
from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.coordinator.output_schema.bundles import (
    build_background_update_batch_prompt_bundle,
    build_round_directive_focus_core_prompt_bundle,
)
from simula.application.workflow.graphs.coordinator.prompts.background_update_batch_prompt import (
    PROMPT as BUILD_BACKGROUND_UPDATE_BATCH_PROMPT,
)
from simula.application.workflow.graphs.coordinator.prompts.round_directive_focus_core_prompt import (
    PROMPT as BUILD_ROUND_DIRECTIVE_FOCUS_CORE_PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.application.workflow.utils.streaming import record_simulation_log_event
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
from simula.domain.contracts import (
    BackgroundUpdateBatch,
    RoundDirective,
    RoundDirectiveFocusCore,
)
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
    focus_candidates_json = json.dumps(
        build_focus_candidates_prompt_view(list(state["focus_candidates"])),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    deferred_actors_json = json.dumps(
        build_deferred_actor_views(deferred_actors),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    coordination_frame_json = json.dumps(
        build_focus_plan_coordination_frame_view(state["plan"]["coordination_frame"]),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    situation_json = json.dumps(
        build_focus_plan_situation_view(state["plan"]["situation"]),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    simulation_clock_json = json.dumps(
        state["simulation_clock"],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    event_memory_json = json.dumps(
        build_event_memory_prompt_view(state.get("event_memory", {})),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    previous_observer_summary = truncate_text(
        latest_observer_summary(list(state["observer_reports"])),
        PREVIOUS_SUMMARY_LIMIT,
    )
    default_payload = _build_default_round_directive_payload(
        state=state,
        max_focus_slices=max_focus_slices,
        max_actor_calls=max_actor_calls,
    )
    total_parse_failures = 0
    total_duration_seconds = 0.0

    focus_core_prompt = BUILD_ROUND_DIRECTIVE_FOCUS_CORE_PROMPT.format(
        round_index=state["round_index"],
        focus_candidates_json=focus_candidates_json,
        coordination_frame_json=coordination_frame_json,
        situation_json=situation_json,
        simulation_clock_json=simulation_clock_json,
        event_memory_json=event_memory_json,
        previous_observer_summary=previous_observer_summary,
        max_focus_slices_per_step=max_focus_slices,
        max_actor_calls_per_step=max_actor_calls,
        **build_round_directive_focus_core_prompt_bundle(),
    )
    focus_core, focus_meta = await runtime.context.llms.ainvoke_structured_with_meta(
        "coordinator",
        focus_core_prompt,
        RoundDirectiveFocusCore,
        allow_default_on_failure=True,
        default_payload=_build_default_round_directive_focus_core_payload(
            default_directive=default_payload
        ),
        semantic_validator=lambda parsed: validate_round_directive_focus_core_semantics(
            focus_core=parsed,
            focus_candidates=list(state.get("focus_candidates", [])),
            max_actor_calls=max_actor_calls,
        ),
        repair_context=build_round_directive_focus_core_repair_context(
            focus_candidates=list(state.get("focus_candidates", [])),
            max_focus_slices=max_focus_slices,
            max_actor_calls=max_actor_calls,
        ),
        log_context=build_llm_log_context(
            scope="round-directive",
            phase="runtime",
            task_key="round_directive_focus_core",
            task_label="라운드 지시안 작성",
            artifact_key="round_focus_plan",
            artifact_label="round_focus_plan",
            schema=RoundDirectiveFocusCore,
            round_index=int(state["round_index"]),
        ),
    )
    total_parse_failures += int(focus_meta.parse_failure_count)
    total_duration_seconds += float(focus_meta.duration_seconds)
    forced_default = bool(focus_meta.forced_default)
    if forced_default:
        normalized = _normalize_round_directive(
            directive=default_payload,
            focus_candidates=list(state["focus_candidates"]),
            max_focus_slices=max_focus_slices,
            max_actor_calls=max_actor_calls,
        )
    else:
        provisional_directive = _assemble_round_directive_from_stages(
            state=state,
            focus_core=focus_core,
            background_updates=[],
            focus_candidates=list(state["focus_candidates"]),
        )
        provisional_normalized = _normalize_round_directive(
            directive=provisional_directive,
            focus_candidates=list(state["focus_candidates"]),
            max_focus_slices=max_focus_slices,
            max_actor_calls=max_actor_calls,
        )
        background_prompt = BUILD_BACKGROUND_UPDATE_BATCH_PROMPT.format(
            round_index=state["round_index"],
            deferred_actors_json=deferred_actors_json,
            focus_core_json=json.dumps(
                focus_core.model_dump(mode="json"),
                ensure_ascii=False,
                separators=(",", ":"),
            ),
            coordination_frame_json=coordination_frame_json,
            situation_json=situation_json,
            event_memory_json=event_memory_json,
            previous_observer_summary=previous_observer_summary,
            **build_background_update_batch_prompt_bundle(),
        )
        background_batch, background_meta = await runtime.context.llms.ainvoke_structured_with_meta(
            "coordinator",
            background_prompt,
            BackgroundUpdateBatch,
            allow_default_on_failure=True,
            default_payload={"background_updates": []},
            semantic_validator=lambda parsed: validate_background_update_batch_semantics(
                background_update_batch=parsed,
                deferred_cast_ids=as_string_list(
                    provisional_normalized.get("deferred_cast_ids", [])
                ),
                round_index=int(state["round_index"]),
            ),
            repair_context=build_background_update_batch_repair_context(
                deferred_cast_ids=as_string_list(
                    provisional_normalized.get("deferred_cast_ids", [])
                ),
                round_index=int(state["round_index"]),
            ),
            log_context=build_llm_log_context(
                scope="round-directive",
                phase="runtime",
                task_key="round_directive_background_updates",
                task_label="라운드 지시안 작성",
                artifact_key="round_focus_plan",
                artifact_label="round_focus_plan",
                schema=BackgroundUpdateBatch,
                round_index=int(state["round_index"]),
            ),
        )
        total_parse_failures += int(background_meta.parse_failure_count)
        total_duration_seconds += float(background_meta.duration_seconds)
        forced_default = bool(background_meta.forced_default)
        if forced_default:
            normalized = _normalize_round_directive(
                directive=default_payload,
                focus_candidates=list(state["focus_candidates"]),
                max_focus_slices=max_focus_slices,
                max_actor_calls=max_actor_calls,
            )
        else:
            assembled = _assemble_round_directive_from_stages(
                state=state,
                focus_core=focus_core,
                background_updates=[
                    item.model_dump(mode="json")
                    for item in background_batch.background_updates
                ],
                focus_candidates=list(state["focus_candidates"]),
            )
            directive = RoundDirective.model_validate(assembled)
            normalized = _normalize_round_directive(
                directive=directive.model_dump(mode="json"),
                focus_candidates=list(state["focus_candidates"]),
                max_focus_slices=max_focus_slices,
                max_actor_calls=max_actor_calls,
            )
    normalized = _inject_stagnation_background_hook(
        state=state,
        directive=normalized,
    )
    errors = list(state["errors"])
    if forced_default:
        errors.append(f"round {state['round_index']} directive defaulted")
    record_simulation_log_event(
        runtime.context,
        build_round_focus_selected_event(
            run_id=str(state["run_id"]),
            round_index=int(state["round_index"]),
            round_focus_plan=normalized,
        )
    )
    background_updates = as_dict_list(normalized.get("background_updates", []))
    if background_updates:
        record_simulation_log_event(
            runtime.context,
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
        "parse_failures": int(state.get("parse_failures", 0)) + total_parse_failures,
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


def _build_default_round_directive_focus_core_payload(
    *,
    default_directive: dict[str, object],
) -> dict[str, object]:
    return {
        "focus_summary": str(default_directive.get("focus_summary", "")),
        "selection_reason": str(default_directive.get("selection_reason", "")),
        "focus_slices": list(as_dict_list(default_directive.get("focus_slices", []))),
    }


def _assemble_round_directive_from_stages(
    *,
    state: SimulationWorkflowState,
    focus_core: RoundDirectiveFocusCore,
    background_updates: list[dict[str, object]],
    focus_candidates: list[dict[str, object]],
) -> dict[str, object]:
    selected_cast_ids: list[str] = []
    for focus_slice in focus_core.focus_slices:
        for cast_id in focus_slice.focus_cast_ids:
            if cast_id not in selected_cast_ids:
                selected_cast_ids.append(cast_id)
    candidate_ids = [
        str(item.get("cast_id", ""))
        for item in focus_candidates
        if str(item.get("cast_id", "")).strip()
    ]
    deferred_cast_ids = [
        cast_id for cast_id in candidate_ids if cast_id not in set(selected_cast_ids)
    ]
    return {
        "round_index": int(state["round_index"]),
        "focus_summary": focus_core.focus_summary,
        "selection_reason": focus_core.selection_reason,
        "selected_cast_ids": selected_cast_ids,
        "deferred_cast_ids": deferred_cast_ids,
        "focus_slices": [item.model_dump(mode="json") for item in focus_core.focus_slices],
        "background_updates": background_updates,
    }


def validate_round_directive_focus_core_semantics(
    *,
    focus_core: RoundDirectiveFocusCore,
    focus_candidates: list[dict[str, object]],
    max_actor_calls: int,
) -> list[str]:
    """Return semantic issues for the focus-only directive stage."""

    issues: list[str] = []
    candidate_ids = {
        str(item.get("cast_id", "")).strip()
        for item in focus_candidates
        if str(item.get("cast_id", "")).strip()
    }
    selected_cast_ids: list[str] = []
    for focus_slice in focus_core.focus_slices:
        invalid_cast_ids = [
            cast_id for cast_id in focus_slice.focus_cast_ids if cast_id not in candidate_ids
        ]
        if invalid_cast_ids:
            issues.append(
                "focus_slices에 후보 pool 밖 cast_id가 있습니다: "
                + ", ".join(invalid_cast_ids)
            )
        for cast_id in focus_slice.focus_cast_ids:
            if cast_id not in selected_cast_ids:
                selected_cast_ids.append(cast_id)
    if len(selected_cast_ids) > max_actor_calls:
        issues.append(
            f"selected cast 수는 최대 {max_actor_calls}명이어야 합니다. 현재 {len(selected_cast_ids)}명입니다."
        )
    return issues


def build_round_directive_focus_core_repair_context(
    *,
    focus_candidates: list[dict[str, object]],
    max_focus_slices: int,
    max_actor_calls: int,
) -> dict[str, object]:
    """Build repair context for the focus-only directive stage."""

    return {
        "valid_focus_candidate_ids": [
            str(item.get("cast_id", ""))
            for item in focus_candidates
            if str(item.get("cast_id", "")).strip()
        ],
        "max_focus_slices": max_focus_slices,
        "max_actor_calls": max_actor_calls,
        "repair_guidance": [
            "Use only focus candidate cast ids in `focus_slices.focus_cast_ids`.",
            "Keep the selected cast union within the actor-call budget.",
            "Do not generate background updates in this stage.",
        ],
    }


def validate_background_update_batch_semantics(
    *,
    background_update_batch: BackgroundUpdateBatch,
    deferred_cast_ids: list[str],
    round_index: int,
) -> list[str]:
    """Return semantic issues for the background-update stage."""

    issues: list[str] = []
    valid_cast_id_set = set(deferred_cast_ids)
    for update in background_update_batch.background_updates:
        if update.cast_id not in valid_cast_id_set:
            issues.append(
                f"background update `{update.cast_id}` 는 deferred actor가 아닙니다."
            )
        if update.round_index != round_index:
            issues.append(
                f"background update `{update.cast_id}` 의 round_index 는 {round_index} 이어야 합니다."
            )
    return issues


def build_background_update_batch_repair_context(
    *,
    deferred_cast_ids: list[str],
    round_index: int,
) -> dict[str, object]:
    """Build repair context for the background-update stage."""

    return {
        "valid_deferred_cast_ids": deferred_cast_ids,
        "round_index": round_index,
        "repair_guidance": [
            "Use only deferred actor cast ids in `background_updates`.",
            "Keep `pressure_level` as one of low, medium, high.",
            "Set each `round_index` to the provided round index.",
        ],
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


def _inject_stagnation_background_hook(
    *,
    state: SimulationWorkflowState,
    directive: dict[str, object],
) -> dict[str, object]:
    """Add one high-pressure deferred hook when the scene has clearly stalled."""

    if int(state.get("stagnation_rounds", 0)) < 2:
        return directive

    background_updates = as_dict_list(directive.get("background_updates", []))
    deferred_cast_ids = as_string_list(directive.get("deferred_cast_ids", []))
    if not deferred_cast_ids:
        return directive
    deferred_cast_id_set = set(deferred_cast_ids)
    if any(
        str(item.get("cast_id", "")) in deferred_cast_id_set
        for item in background_updates
    ):
        return directive

    focus_candidates = {
        str(item.get("cast_id", "")): cast(dict[str, object], item)
        for item in list(state.get("focus_candidates", []))
        if isinstance(item, dict)
    }
    actors_by_id = {
        str(actor.get("cast_id", "")): cast(dict[str, object], actor)
        for actor in list(state.get("actors", []))
        if isinstance(actor, dict)
    }
    unresolved_required_titles = [
        str(event.get("title", "")).strip()
        for event in as_dict_list(
            cast(dict[str, object], state.get("event_memory", {})).get("events", [])
        )
        if bool(event.get("required_before_end", False))
        and str(event.get("status", "")) not in {"completed", "missed"}
        and int(str(event.get("latest_round", 0) or 0)) <= int(state["round_index"])
        and str(event.get("title", "")).strip()
    ]

    chosen_cast_id = max(
        deferred_cast_ids,
        key=lambda cast_id: float(
            str(focus_candidates.get(cast_id, {}).get(
                "candidate_score",
                0.0,
            ))
        ),
    )
    actor = actors_by_id.get(chosen_cast_id, {})
    actor_name = str(actor.get("display_name", chosen_cast_id)).strip() or chosen_cast_id
    pressure_topic = unresolved_required_titles[0] if unresolved_required_titles else (
        str(actor.get("story_function", "")).strip() or "정체된 관계 구도"
    )
    synthetic_update = {
        "round_index": int(str(directive.get("round_index", 0) or 0)),
        "cast_id": chosen_cast_id,
        "summary": f"{actor_name} 쪽에서 {pressure_topic} 흐름을 더 이상 미루지 않으려는 압박이 커진다.",
        "pressure_level": "high",
        "future_hook": (
            f"다음 round에서는 {actor_name}가 같은 말 반복 대신 확인 질문이나 선택 요구를 먼저 꺼낼 수 있다."
        ),
    }
    return {
        **directive,
        "background_updates": background_updates + [synthetic_update],
    }
