"""목적:
- planning 그래프 전용 출력 schema 예시 묶음을 제공한다.

설명:
- planner 단계에서 쓰는 예시 payload만 로컬에 둬 작은 모델에서도 관련 신호만 보이게 한다.

사용한 설계 패턴:
- graph-local prompt asset 패턴
"""

from __future__ import annotations

from typing import Any

from simula.prompts.shared.output_schema_utils import (
    ExampleMode,
    build_json_prompt_bundle,
    build_ndjson_prompt_bundle,
)


def build_runtime_progression_plan_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_RUNTIME_PROGRESSION_PLAN_EXAMPLE,
        example_mode=example_mode,
    )


def build_scenario_brief_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_SCENARIO_BRIEF_EXAMPLE,
        example_mode=example_mode,
    )


def build_scenario_time_scope_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_SCENARIO_TIME_SCOPE_EXAMPLE,
        example_mode=example_mode,
    )


def build_visibility_context_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_VISIBILITY_CONTEXT_EXAMPLE,
        example_mode=example_mode,
    )


def build_pressure_point_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_PRESSURE_POINT_EXAMPLE,
        example_mode=example_mode,
    )


def build_situation_bundle_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_SITUATION_BUNDLE_EXAMPLE,
        example_mode=example_mode,
    )


def build_action_catalog_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_ACTION_CATALOG_EXAMPLE,
        example_mode=example_mode,
    )


def build_coordination_frame_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_COORDINATION_FRAME_EXAMPLE,
        example_mode=example_mode,
    )


def build_cast_roster_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_CAST_ROSTER_EXAMPLE,
        example_mode=example_mode,
    )


def build_cast_roster_item_ndjson_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_ndjson_prompt_bundle(
        example=_CAST_ROSTER_ITEM_EXAMPLE,
        example_mode=example_mode,
    )


_RUNTIME_PROGRESSION_PLAN_EXAMPLE: dict[str, Any] = {
    "max_steps": 16,
    "allowed_units": ["minute", "hour", "day"],
    "default_unit": "hour",
    "pacing_guidance": [
        "짧은 감정 반응이나 직접 대화는 30분 또는 1시간으로 본다.",
        "입장 재정렬이나 공개 파장은 몇 시간 단위로 본다.",
        "물리 이동이나 작전 재배치는 하루 이상 점프를 허용한다.",
    ],
    "selection_reason": "짧은 반응과 긴 준비 구간이 번갈아 나와 복수 단위가 적절하다.",
}

_SCENARIO_BRIEF_EXAMPLE: dict[str, Any] = {
    "summary": "이 시나리오는 공개 행동과 비공개 계산이 동시에 움직이는 다자 상황이다. 표면적으로는 모두 신중한 태도를 보이지만, 실제로는 제한된 시간 안에 누구와 손을 잡고 누구를 밀어낼지가 계속 바뀐다. 공개 발언과 조용한 조율이 서로 다른 방향으로 움직일 수 있어 말만 보면 실제 판세를 놓치기 쉽다. 핵심 참여자 몇 명의 선택이 전체 흐름을 좌우하지만, 조용한 참여자도 특정 순간에는 갑자기 전면으로 올라올 수 있다. 최종적으로는 공개 신호, 비공개 거래, 시간 압박이 한 지점에서 만나며 종결 국면을 만든다.",
    "key_entities": [
        "핵심 의사결정자",
        "직접 압박을 거는 상대",
        "조용하지만 방향을 바꿀 수 있는 주변 actor",
    ],
    "explicit_time_signals": [
        "초기 충돌 직후",
        "짧은 반응과 긴 준비 구간이 번갈아 나온다.",
        "최종 선택 또는 종결 판단 직전까지 본다.",
    ],
    "public_facts": [
        "공개 자리에서는 신중한 태도와 체면 관리가 중요하다.",
        "짧은 공개 행동 하나가 전체 분위기를 바꿀 수 있다.",
    ],
    "private_dynamics": [
        "비공개 대화와 내부 계산이 실제 선택을 더 크게 움직인다.",
        "공개 입장과 실제 원픽 또는 실제 대응 의지가 다를 수 있다.",
    ],
    "terminal_conditions": [
        "최종 선택, 휴전, 지도부 결심, 재난 안정화 같은 종결 지점이 필요하다.",
        "첫 정적 구간이 아니라 핵심 갈등이 실제로 정리되는 시점까지 본다.",
    ],
}

_SCENARIO_TIME_SCOPE_EXAMPLE: dict[str, Any] = {
    "start": "초기 대면 직후",
    "end": "핵심 선택 직전",
}

_VISIBILITY_CONTEXT_EXAMPLE: dict[str, Any] = {
    "public_context": [
        "겉으로는 신중한 태도가 보인다.",
        "공개 신호 하나가 분위기를 바꿀 수 있다.",
    ],
    "private_context": [
        "핵심 참여자들은 속생각을 바로 드러내지 않는다.",
        "비공개 대화가 먼저 방향을 바꿀 수 있다.",
    ],
}

_PRESSURE_POINT_EXAMPLE: dict[str, Any] = {
    "key_pressures": [
        "시간이 부족하다.",
        "겉으로 보이는 말과 실제 판단이 다를 수 있다.",
    ],
    "observation_points": [
        "누가 먼저 공개 신호를 보이는가",
        "누가 마지막에 한 사람으로 좁히는가",
    ],
}

_SITUATION_BUNDLE_EXAMPLE: dict[str, Any] = {
    "simulation_objective": "누가 어떤 선택을 하는지 끝까지 추적한다.",
    "world_summary": "여러 actor가 같은 시간 안에서 공개 행동과 숨은 판단을 함께 이어간다.",
    "initial_tensions": [
        "서로 원하는 것이 다르다.",
        "겉으로 하는 말과 실제 판단이 다를 수 있다.",
    ],
    "channel_guidance": {
        "public": "공개 채널은 분위기와 신호를 바꾸는 데 사용한다.",
        "private": "비공개 채널은 숨은 계산과 조건 조율에 사용한다.",
        "group": "그룹 채널은 여러 사람의 반응과 집단 분위기를 확인하는 데 사용한다.",
    },
    "current_constraints": [
        "시간이 제한적이다.",
        "모든 actor가 동일한 정보를 갖고 있지 않다.",
    ],
}

_ACTION_CATALOG_EXAMPLE: dict[str, Any] = {
    "actions": [
        {
            "action_type": "public_signal",
            "label": "공개 신호와 입장 표명",
            "description": "공개 발언, 성명, 경고, 공식 메시지처럼 바깥으로 보이는 신호를 낸다.",
            "role_hints": ["대표", "대변인"],
            "group_hints": ["백악관", "외교라인"],
            "supported_visibility": ["public", "private", "group"],
            "requires_target": False,
            "supports_utterance": True,
            "examples_or_usage_notes": ["공개 브리핑"],
        },
        {
            "action_type": "private_coordination",
            "label": "비공개 접촉과 조율",
            "description": "핫라인, 비밀 메시지, 내부 조율처럼 조용한 접촉으로 방향을 맞춘다.",
            "role_hints": ["조정자", "연락 채널"],
            "group_hints": ["안보라인", "외교라인"],
            "supported_visibility": ["public", "private", "group"],
            "requires_target": True,
            "supports_utterance": True,
            "examples_or_usage_notes": ["핫라인 접촉"],
        },
        {
            "action_type": "multilateral_coordination",
            "label": "집단 협의와 다자 조정",
            "description": "여러 actor나 여러 집단이 함께 모여 공통 입장과 조건을 맞춘다.",
            "role_hints": ["중재자", "협의체"],
            "group_hints": ["유엔", "걸프 국가들"],
            "supported_visibility": ["public", "private", "group"],
            "requires_target": False,
            "supports_utterance": True,
            "examples_or_usage_notes": ["비공개 협의"],
        },
        {
            "action_type": "posture_adjustment",
            "label": "태세·배치·준비 조정",
            "description": "군사적·운영적·정책적 준비 태세와 배치를 바꿔 다음 국면에 대비한다.",
            "role_hints": ["현장 지휘관", "실행 책임자"],
            "group_hints": ["군 지휘부", "작전실"],
            "supported_visibility": ["public", "private", "group"],
            "requires_target": False,
            "supports_utterance": False,
            "examples_or_usage_notes": ["방어 태세 상향"],
        },
        {
            "action_type": "pressure_probe",
            "label": "압박·지연·관망·탐색",
            "description": "직접 결론을 내지 않고 상대 반응을 보거나 압박 수위를 조절하며 탐색한다.",
            "role_hints": ["탐색자", "억지 운영자"],
            "group_hints": ["중재라인", "현장 대응팀"],
            "supported_visibility": ["public", "private", "group"],
            "requires_target": False,
            "supports_utterance": True,
            "examples_or_usage_notes": ["시험적 경고"],
        },
    ],
    "selection_guidance": [
        "세부 차이는 action_summary와 action_detail에서 표현한다.",
        "action_type은 넓은 capability bucket으로 유지한다.",
    ],
}

_COORDINATION_FRAME_EXAMPLE: dict[str, Any] = {
    "focus_selection_rules": [
        "직접 target이 몰린 actor와 공개 파장을 만들 수 있는 actor를 우선 본다.",
        "같은 축만 반복되지 않도록 quiet actor 유입도 고려한다.",
    ],
    "background_motion_rules": [
        "직접 충돌이 없는 준비·대기·정렬은 background update로 요약한다."
    ],
    "focus_archetypes": [
        "직접 압박 장면",
        "비공개 정렬 장면",
        "공개 입장 재조정 장면",
    ],
    "attention_shift_rules": [
        "직전 intent 변화가 큰 actor는 한 단계 앞으로 당길 수 있다.",
        "최근 focus가 과도했던 actor는 잠시 뒤로 물릴 수 있다.",
    ],
    "budget_guidance": [
        "직접 시뮬레이션 actor 수는 적게 유지하고 핵심 상태 변화만 전면으로 올린다."
    ],
}

_CAST_ROSTER_ITEM_EXAMPLE: dict[str, Any] = {
    "cast_id": "cast-operations",
    "display_name": "운영 총괄",
    "role_hint": "실행 일정과 운영 리스크를 조정하는 책임자",
    "group_name": "운영팀",
    "core_tension": "현실적 제약을 말해야 하지만 공개적으로는 안정감을 보여야 한다.",
}

_CAST_ROSTER_EXAMPLE: dict[str, Any] = {
    "items": [_CAST_ROSTER_ITEM_EXAMPLE],
}
