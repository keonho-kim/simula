"""목적:
- coordinator 그래프 전용 출력 schema 예시 묶음을 제공한다.

설명:
- focus 계획, background update, adjudication 단계에서 필요한 예시만 로컬에 둔다.

사용한 설계 패턴:
- graph-local prompt asset 패턴
"""

from __future__ import annotations

from typing import Any

from simula.prompts.shared.output_schema_utils import (
    ExampleMode,
    build_json_prompt_bundle,
)


def build_step_focus_plan_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_STEP_FOCUS_PLAN_EXAMPLE,
        example_mode=example_mode,
    )


def build_background_update_batch_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_BACKGROUND_UPDATE_BATCH_EXAMPLE,
        example_mode=example_mode,
    )


def build_step_adjudication_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_STEP_ADJUDICATION_EXAMPLE,
        example_mode=example_mode,
    )


_STEP_FOCUS_PLAN_EXAMPLE: dict[str, Any] = {
    "step_index": 2,
    "focus_summary": "이번 단계 핵심 압박 축을 직접 따라간다.",
    "selection_reason": "직접 target 압력이 가장 높다.",
    "selected_actor_ids": ["operations-lead", "finance-director"],
    "deferred_actor_ids": ["field-lead"],
    "focus_slices": [
        {
            "slice_id": "step-2-focus-1",
            "title": "비공개 압박",
            "focus_actor_ids": ["operations-lead", "finance-director"],
            "visibility": "private",
            "stakes": "즉시 반응이 필요하다.",
            "selection_reason": "action 압력이 가장 강하다.",
        }
    ],
}

_BACKGROUND_UPDATE_BATCH_EXAMPLE: dict[str, Any] = {
    "background_updates": [
        {
            "step_index": 2,
            "actor_id": "field-lead",
            "summary": "직접 호출되지는 않았지만 다음 단계에 영향을 줄 준비 움직임이 이어졌다.",
            "pressure_level": "medium",
            "future_hook": "다음 단계에서 직접 충돌 축으로 올라올 수 있다.",
        }
    ]
}

_STEP_ADJUDICATION_EXAMPLE: dict[str, Any] = {
    "adopted_actor_ids": ["operations-lead", "finance-director"],
    "rejected_action_notes": [],
    "updated_intent_states": [
        {
            "actor_id": "operations-lead",
            "current_intent": "상대가 재검토를 피하지 못하게 만든다.",
            "target_actor_ids": ["finance-director"],
            "supporting_action_type": "private_coordination",
            "confidence": 0.82,
            "changed_from_previous": True,
        }
    ],
    "step_time_advance": {
        "elapsed_unit": "hour",
        "elapsed_amount": 1,
        "selection_reason": "이번 단계는 공개 메시지와 비공개 조율이 같은 날 안에서 이어졌다.",
        "signals": ["짧은 반응", "즉시 조율"],
    },
    "background_updates": [
        {
            "step_index": 2,
            "actor_id": "field-lead",
            "summary": "직접 호출되지는 않았지만 다음 단계에 영향을 줄 준비 움직임이 이어졌다.",
            "pressure_level": "medium",
            "future_hook": "다음 단계에서 직접 충돌 축으로 올라올 수 있다.",
        }
    ],
    "event_action": None,
    "world_state_summary_hint": "직접 조정과 배경 준비가 함께 누적되며 다음 단계 선택 폭이 좁아졌다.",
}
