"""목적:
- generation 그래프 전용 출력 schema 예시 묶음을 제공한다.

설명:
- actor card 생성 단계에서 필요한 예시만 로컬에 둔다.

사용한 설계 패턴:
- graph-local prompt asset 패턴
"""

from __future__ import annotations

from typing import Any

from simula.shared.prompts.output_schema_utils import (
    ExampleMode,
    build_object_prompt_bundle,
)


def build_actor_card_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_object_prompt_bundle(
        example=_ACTOR_CARD_EXAMPLE,
        example_mode=example_mode,
    )


_ACTOR_CARD_EXAMPLE: dict[str, Any] = {
    "role": "<1 Korean sentence describing this actor's role>",
    "public_profile": "<1 Korean sentence describing the public-facing profile>",
    "private_goal": "<1 Korean sentence describing the private goal>",
    "speaking_style": "<1 Korean sentence describing how this actor speaks>",
    "avatar_seed": "<1 short stable seed string for the avatar>",
    "baseline_attention_tier": "<choose exactly one of lead, driver, support, background>",
    "story_function": "<1 Korean sentence describing this actor's story function>",
    "preferred_action_types": ["<action_type string from the action catalog>"],
    "action_bias_notes": [
        "<1 Korean sentence about action preference or bias>",
    ],
}
