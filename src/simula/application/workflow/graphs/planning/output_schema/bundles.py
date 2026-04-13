"""Purpose:
- Provide compact planning prompt examples.
"""

from __future__ import annotations

from typing import Any

from simula.prompts.shared.output_schema_utils import ExampleMode, build_json_prompt_bundle


def build_planning_analysis_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_PLANNING_ANALYSIS_EXAMPLE,
        example_mode=example_mode,
    )


def build_execution_plan_prompt_bundle(
    *,
    create_all_participants: bool,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    bundle = build_json_prompt_bundle(
        example=_EXECUTION_PLAN_EXAMPLE,
        example_mode=example_mode,
    )
    bundle["cast_roster_policy"] = _build_cast_roster_policy_text(
        create_all_participants=create_all_participants
    )
    return bundle


_PLANNING_ANALYSIS_EXAMPLE: dict[str, Any] = {
    "brief_summary": "공개 신호와 비공개 계산이 한정된 시간 안에서 겹친다.",
    "premise": "표면적 입장과 실제 계산이 다를 수 있어 말보다 정렬 방향을 봐야 한다.",
    "time_scope": {
        "start": "초기 대면 직후",
        "end": "핵심 선택 직전",
    },
    "public_context": ["공개 발언이 판세를 흔들 수 있다."],
    "private_context": ["비공개 조율이 실제 선택을 움직인다."],
    "key_pressures": ["시간 압박", "정보 비대칭"],
    "progression_plan": {
        "max_steps": 8,
        "allowed_units": ["minute", "hour", "day"],
        "default_unit": "hour",
        "pacing_guidance": ["직접 반응은 짧게 보고, 재배치와 종결 접근은 길게 본다."],
        "selection_reason": "짧은 반응과 긴 준비 구간이 함께 나온다.",
    },
}

_EXECUTION_PLAN_EXAMPLE: dict[str, Any] = {
    "situation": {
        "simulation_objective": "누가 어떤 정렬을 통해 종결 국면을 만드는지 추적한다.",
        "world_summary": "여러 actor가 공개 행동과 비공개 조율을 병행한다.",
        "initial_tensions": ["공개 체면과 실제 선택이 어긋난다.", "남은 시간이 짧다."],
        "channel_guidance": {
            "public": "공개 신호와 입장 표명에 쓴다.",
            "private": "비공개 압박과 조건 조율에 쓴다.",
            "group": "여러 actor의 즉시 반응을 묶어 확인할 때 쓴다.",
        },
        "current_constraints": ["모든 actor가 같은 정보를 갖고 있지 않다.", "핵심 결론 전까지 시간이 짧다."],
    },
    "action_catalog": {
        "actions": [
            {
                "action_type": "public_signal",
                "label": "공개 신호",
                "description": "밖으로 보이는 입장과 압박을 만든다.",
                "supported_visibility": ["public", "group"],
                "requires_target": False,
                "supports_utterance": True,
            },
            {
                "action_type": "private_coordination",
                "label": "비공개 조율",
                "description": "조용한 접촉으로 조건과 방향을 맞춘다.",
                "supported_visibility": ["private", "group"],
                "requires_target": True,
                "supports_utterance": True,
            },
        ],
        "selection_guidance": ["한 step에는 broad action 몇 개만 유지한다."],
    },
    "coordination_frame": {
        "focus_selection_rules": ["직접 반응 압력이 몰린 actor를 우선 본다."],
        "background_motion_rules": ["직접 추적하지 않은 actor는 배경 update로만 정리한다."],
        "focus_archetypes": ["직접 충돌", "조용한 정렬"],
        "attention_shift_rules": ["조용했던 actor도 압력이 높아지면 끌어올린다."],
        "budget_guidance": ["한 step에는 소수 actor만 직접 호출한다."],
    },
    "cast_roster": {
        "items": [
            {
                "cast_id": "cast-ops",
                "display_name": "운영 총괄",
                "role_hint": "실행 조정자",
                "group_name": "운영팀",
                "core_tension": "속도를 높이고 싶다.",
            }
        ]
    },
}


def _build_cast_roster_policy_text(*, create_all_participants: bool) -> str:
    if create_all_participants:
        return (
            "- `create_all_participants` is true.\n"
            "- Treat this as a closed-participant scenario.\n"
            "- Include every participant implied by the scenario in `cast_roster`.\n"
            "- Do not drop, merge, or summarize away participants."
        )
    return (
        "- `create_all_participants` is false.\n"
        "- Generate a large-enough `cast_roster` for the simulation to move autonomously.\n"
        "- Always include the scenario's core actors.\n"
        "- If the scenario structure suggests more participants, prefer adding enough participants over keeping the roster too small."
    )
