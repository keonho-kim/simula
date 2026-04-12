"""목적:
- generation 그래프 전용 출력 schema 예시 묶음을 제공한다.

설명:
- actor card 생성 단계에서 필요한 예시만 로컬에 둔다.

사용한 설계 패턴:
- graph-local prompt asset 패턴
"""

from __future__ import annotations

from typing import Any

from simula.prompts.shared.output_schema_utils import (
    ExampleMode,
    build_json_prompt_bundle,
)


def build_actor_card_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_ACTOR_CARD_EXAMPLE,
        example_mode=example_mode,
    )


_ACTOR_CARD_EXAMPLE: dict[str, Any] = {
    "cast_id": "cast-operations",
    "actor_id": "operations-lead",
    "display_name": "운영 총괄",
    "role": "실행 일정과 운영 리스크를 조정하는 책임자",
    "group_name": "운영팀",
    "public_profile": "공개적으로는 안정적 일정과 책임 있는 실행을 강조한다.",
    "private_goal": "과도한 약속을 막고 팀의 부담을 줄이는 방향으로 상황을 유도한다.",
    "speaking_style": "구체적인 근거를 짧게 제시하고 과장하지 않는다.",
    "avatar_seed": "operations-lead-seed",
    "baseline_attention_tier": "driver",
    "story_function": "실행 제약을 앞세워 흐름을 재조정하는 축이다.",
    "preferred_action_types": ["speech", "reposition"],
    "action_bias_notes": [
        "말보다 일정 재정렬 같은 실행 조정을 선호한다.",
        "직접 발화가 필요하면 짧고 단호하게 말한다.",
    ],
}
