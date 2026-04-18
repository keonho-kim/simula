"""Default payload builders for round directives."""

from __future__ import annotations

from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)


def build_default_round_directive_payload(
    *,
    state: SimulationWorkflowState,
    max_focus_slices: int,
    max_actor_calls: int,
) -> dict[str, object]:
    candidates = list(state["focus_candidates"])
    selected_count = desired_selected_count(
        candidate_count=len(candidates),
        max_actor_calls=max_actor_calls,
    )
    selected_cast_ids = [
        str(item.get("cast_id", ""))
        for item in candidates[:selected_count]
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
                "reason": "후보 점수 상위 actor를 우선 따라가는 기본 focus 계획이다.",
            }
        )
    return {
        "round_index": int(state["round_index"]),
        "focus_summary": "현재 압력이 가장 높은 축을 우선 직접 추적한다.",
        "reason": "후보 점수 상위 actor를 중심으로 기본 focus를 구성했다.",
        "selected_cast_ids": selected_cast_ids,
        "deferred_cast_ids": [
            str(item.get("cast_id", ""))
            for item in candidates
            if str(item.get("cast_id", "")) not in set(selected_cast_ids)
        ],
        "focus_slices": focus_slices,
        "background_updates": [],
    }


def build_default_round_directive_focus_core_payload(
    *,
    default_directive: dict[str, object],
    as_dict_list,
) -> dict[str, object]:
    return {
        "focus_summary": str(default_directive.get("focus_summary", "")),
        "reason": str(default_directive.get("reason", "")),
        "focus_slices": list(as_dict_list(default_directive.get("focus_slices", []))),
    }


def desired_selected_count(*, candidate_count: int, max_actor_calls: int) -> int:
    if candidate_count >= 8:
        return min(max_actor_calls, 4)
    if candidate_count >= 5:
        return min(max_actor_calls, 3)
    return min(max_actor_calls, candidate_count, 2)
