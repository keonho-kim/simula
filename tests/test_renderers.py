"""Purpose:
- Verify CLI renderer blocks keep full values without truncation.
"""

from __future__ import annotations

from simula.domain.contracts import ActorCard
from simula.infrastructure.llm.renderers import (
    render_structured_response,
    render_text_response,
)


def test_render_structured_response_wraps_actor_card_in_full_block() -> None:
    long_profile = "긴문장-" * 40
    rendered = render_structured_response(
        role="generator",
        parsed=ActorCard(
            cast_id="cast-alpha",
            display_name="Alpha",
            role="선도자",
            group_name="A",
            public_profile=long_profile,
            private_goal="먼저 압박한다.",
            speaking_style="짧고 단호하다.",
            avatar_seed="alpha-seed",
            baseline_attention_tier="lead",
            story_function="직접 압박 축",
            preferred_action_types=["speech"],
            action_bias_notes=["먼저 발화한다."],
        ),
        content="",
        log_context=None,
    )

    assert "=" * 56 in rendered
    assert "Alpha | 인물 카드" in rendered
    assert f"public_profile: {long_profile}" in rendered
    assert "..." not in rendered


def test_render_text_response_keeps_full_content_without_truncation() -> None:
    content = "출력-" * 60
    rendered = render_text_response(
        role="fixer",
        content=content,
        log_context={"scope": "json-fix"},
    )

    assert "fixer | JSON 복구 결과" in rendered
    assert content in rendered
    assert "..." not in rendered
