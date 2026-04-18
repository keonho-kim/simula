"""State assembly and normalization helpers for round directives."""

from __future__ import annotations

from typing import cast

from simula.application.workflow.graphs.coordinator.nodes.build_round_directive_defaults import (
    desired_selected_count,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import RoundDirectiveFocusCore


def assemble_round_directive_from_stages(
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
        "reason": focus_core.reason,
        "selected_cast_ids": selected_cast_ids,
        "deferred_cast_ids": deferred_cast_ids,
        "focus_slices": [item.model_dump(mode="json") for item in focus_core.focus_slices],
        "background_updates": background_updates,
    }


def normalize_round_directive(
    *,
    directive: dict[str, object],
    focus_candidates: list[dict[str, object]],
    max_focus_slices: int,
    max_actor_calls: int,
    as_dict_list,
    as_string_list,
) -> dict[str, object]:
    desired_count = desired_selected_count(
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
    ][: max(0, desired_count - len(selected_cast_ids))]
    if backfill_cast_ids:
        if len(normalized_slices) < max_focus_slices:
            normalized_slices.append(
                {
                    "slice_id": f"round-{int(str(directive.get('round_index', 0)))}-context-expansion",
                    "title": "주변 반응 확대",
                    "focus_cast_ids": backfill_cast_ids,
                    "visibility": "public",
                    "stakes": "핵심 갈등에 반응하는 주변 인물의 선택도 다음 국면을 바꿀 수 있다.",
                    "reason": "핵심 축과 직접 연결된 주변 반응까지 이번 라운드에서 함께 추적한다.",
                }
            )
        elif normalized_slices:
            expanded = list(
                as_string_list(normalized_slices[0].get("focus_cast_ids", []))
            )
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
            }
        )
    return {
        "round_index": int(str(directive.get("round_index", 0))),
        "focus_summary": str(directive.get("focus_summary", "")).strip()
        or "이번 단계에서 직접 따라갈 축을 정리했다.",
        "reason": str(directive.get("reason", "")).strip()
        or "후보 압력과 연속성을 기준으로 focus를 정리했다.",
        "selected_cast_ids": selected_cast_ids,
        "deferred_cast_ids": deferred_cast_ids,
        "focus_slices": normalized_slices,
        "background_updates": background_updates,
    }


def inject_stagnation_background_hook(
    *,
    state: SimulationWorkflowState,
    directive: dict[str, object],
    as_dict_list,
    as_string_list,
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
        if bool(event.get("must_resolve", False))
        and str(event.get("status", "")) not in {"completed", "missed"}
        and int(str(event.get("latest_round", 0) or 0)) <= int(state["round_index"])
        and str(event.get("title", "")).strip()
    ]

    chosen_cast_id = max(
        deferred_cast_ids,
        key=lambda cast_id: float(
            str(focus_candidates.get(cast_id, {}).get("candidate_score", 0.0))
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
    }
    return {
        **directive,
        "background_updates": background_updates + [synthetic_update],
    }
