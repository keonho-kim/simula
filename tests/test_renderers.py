"""Purpose:
- Verify CLI renderer blocks keep full values without truncation.
"""

from __future__ import annotations

from simula.domain.contracts import ActorCard, RoundResolution
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


def test_render_structured_response_formats_nested_values_as_indented_blocks() -> None:
    rendered = render_text_response(
        role="planner",
        content="placeholder",
        log_context=None,
    )
    del rendered

    actor = ActorCard(
        cast_id="cast-alpha",
        display_name="Alpha",
        role="선도자",
        group_name="A",
        public_profile="차분하다.",
        private_goal="관계를 확인한다.",
        speaking_style="짧게 말한다.",
        avatar_seed="alpha-seed",
        baseline_attention_tier="lead",
        story_function="주요 축",
        preferred_action_types=["speech", "private_confide"],
        action_bias_notes=["직접 묻는다.", "반응을 본다."],
    )

    rendered = render_structured_response(
        role="generator",
        parsed=actor,
        content="",
        log_context=None,
    )

    assert "preferred_action_types:" in rendered
    assert "    - speech" in rendered
    assert "    - private_confide" in rendered
    assert "action_bias_notes:" in rendered
    assert "    - 직접 묻는다." in rendered


def test_render_structured_response_formats_empty_values_and_stop_reason() -> None:
    rendered = render_structured_response(
        role="coordinator",
        parsed=RoundResolution(
            adopted_cast_ids=[],
            updated_intent_states=[],
            round_time_advance={
                "elapsed_unit": "hour",
                "elapsed_amount": 1,
                "selection_reason": "기본 진행",
                "signals": [],
            },
            observer_report={
                "round_index": 1,
                "summary": "요약",
                "notable_events": [],
                "atmosphere": "긴장",
                "momentum": "medium",
                "world_state_summary": "상태",
            },
            actor_facing_scenario_digest={
                "round_index": 1,
                "relationship_map_summary": "관계",
                "current_pressures": ["압력"],
                "talking_points": ["포인트"],
                "avoid_repetition_notes": ["반복 금지"],
                "recommended_tone": "톤",
                "world_state_summary": "상태",
            },
            world_state_summary="상태",
            stop_reason="",
        ),
        content="",
        log_context=None,
    )

    assert "adopted_cast_ids: empty" in rendered
    assert "updated_intent_states: empty" in rendered
    assert "signals: empty" in rendered
    assert "notable_events: empty" in rendered
    assert "stop_reason: continue" in rendered


def test_render_structured_response_formats_list_of_dicts_without_standalone_dash_line() -> None:
    rendered = render_structured_response(
        role="coordinator",
        parsed=RoundResolution(
            adopted_cast_ids=["a"],
            updated_intent_states=[
                {
                    "cast_id": "a",
                    "current_intent": "상대 반응을 본다.",
                    "thought": "지금 확인해야 한다.",
                    "target_cast_ids": ["b"],
                    "supporting_action_type": "speech",
                    "confidence": 0.8,
                    "changed_from_previous": True,
                }
            ],
            round_time_advance={
                "elapsed_unit": "hour",
                "elapsed_amount": 1,
                "selection_reason": "기본 진행",
                "signals": ["시간 확보"],
            },
            observer_report={
                "round_index": 1,
                "summary": "요약",
                "notable_events": ["사건"],
                "atmosphere": "긴장",
                "momentum": "medium",
                "world_state_summary": "상태",
            },
            actor_facing_scenario_digest={
                "round_index": 1,
                "relationship_map_summary": "관계",
                "current_pressures": ["압력"],
                "talking_points": ["포인트"],
                "avoid_repetition_notes": ["반복 금지"],
                "recommended_tone": "톤",
                "world_state_summary": "상태",
            },
            world_state_summary="상태",
            stop_reason="",
        ),
        content="",
        log_context=None,
    )

    assert "updated_intent_states:" in rendered
    assert "    - cast_id: a" in rendered
    assert "\n    -\n" not in rendered
