"""Purpose:
- Verify the JSON repair parser against current required-only contracts.
"""

from __future__ import annotations

from typing import Literal

import pytest
from langchain_core.exceptions import OutputParserException

from simula.domain.contracts import (
    ActorActionProposal,
    ActorCard,
    BackgroundUpdate,
    PlanningAnalysis,
)
from simula.infrastructure.llm.output_parsers import (
    build_object_output_parser,
    parse_simple_output,
)


def test_json_repair_parser_recovers_broken_actor_proposal_json() -> None:
    parser = build_object_output_parser(ActorActionProposal)
    broken = """
    {
      action_type: "speech",
      goal: "우선순위를 다시 정리하게 만든다.",
      summary: "운영 총괄이 조율 action을 제안한다.",
      detail: "우선순위를 다시 정리해야 한다.",
      utterance: "",
      visibility: "group",
      target_cast_ids: ["ally-1"],
    }
    """

    parsed = parser.parse(broken)

    assert parsed.visibility == "group"
    assert parsed.target_cast_ids == ["ally-1"]
    assert parsed.utterance == ""


def test_json_repair_parser_rejects_schema_mismatch() -> None:
    parser = build_object_output_parser(ActorActionProposal)
    bad_json = (
        '{"action_type":"","goal":"","summary":"",'
        '"detail":"","utterance":"","visibility":"group","target_cast_ids":[]}'
    )

    with pytest.raises(OutputParserException):
        parser.parse(bad_json)


def test_json_repair_parser_normalizes_single_item_string_list_fields() -> None:
    parser = build_object_output_parser(ActorCard)
    payload = """
    {
      "cast_id": "jeongsuk_female",
      "display_name": "정숙",
      "role": "여성 참가자다.",
      "group_name": "여성",
      "public_profile": "친절하고 사교적이다.",
      "private_goal": "경수와 더 가까워지고 싶다.",
      "speaking_style": "부드럽고 조심스럽다.",
      "avatar_seed": "seed-1",
      "baseline_attention_tier": "support",
      "story_function": "관계 긴장을 높인다.",
      "preferred_action_types": ["private_confide"],
      "action_bias_notes": "비공개 고백을 선호한다."
    }
    """

    parsed = parser.parse(payload)

    assert parsed.action_bias_notes == ["비공개 고백을 선호한다."]


def test_json_repair_parser_normalizes_single_item_list_into_string_field() -> None:
    parser = build_object_output_parser(PlanningAnalysis)
    payload = """
    {
      "brief_summary": "요약",
      "premise": "전제",
      "time_scope": {
        "start": "처음",
        "end": "끝"
      },
      "key_pressures": ["시간 압박"],
      "progression_plan": {
        "max_rounds": 4,
        "allowed_elapsed_units": ["day"],
        "default_elapsed_unit": "day",
        "reason": ["시나리오가 일 단위 일정으로 보인다."]
      }
    }
    """

    parsed = parser.parse(payload)

    assert parsed.progression_plan.reason == "시나리오가 일 단위 일정으로 보인다."


def test_simple_parser_reads_top_level_array_of_models() -> None:
    parsed = parse_simple_output(
        """
        [
          {
            "round_index": 2,
            "cast_id": "beta",
            "summary": "배경 압력이 유지된다.",
            "pressure_level": "medium"
          }
        ]
        """,
        list[BackgroundUpdate],
    )

    assert parsed[0].cast_id == "beta"


def test_simple_parser_reads_top_level_scalar_literal() -> None:
    parsed = parse_simple_output('"no_progress"', Literal["", "no_progress"])

    assert parsed == "no_progress"
