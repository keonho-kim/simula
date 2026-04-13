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
    "cast_id": "<preserve the provided cast_id exactly>",
    "actor_id": "<short slug identifier for this actor>",
    "display_name": "<preserve the provided display_name exactly>",
    "role": "<one Korean sentence describing this actor's role>",
    "group_name": "<copy or refine the cast item's group name>",
    "public_profile": "<one Korean sentence describing the public-facing profile>",
    "private_goal": "<one Korean sentence describing the private goal>",
    "speaking_style": "<one Korean sentence describing how this actor speaks>",
    "avatar_seed": "<short stable seed string for the avatar>",
    "baseline_attention_tier": "<choose exactly one of lead, driver, support, background>",
    "story_function": "<one Korean sentence describing this actor's story function>",
    "preferred_action_types": ["<action_type string from the action catalog>"],
    "action_bias_notes": [
        "<one Korean note about action preference or bias>",
    ],
}
