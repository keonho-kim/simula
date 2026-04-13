"""Purpose:
- Verify the JSON repair parser against current required-only contracts.
"""

from __future__ import annotations

import pytest
from langchain_core.exceptions import OutputParserException

from simula.domain.contracts import (
    ActorActionProposal,
    ActorCard,
    FinalReportSections,
    PlanningAnalysis,
)
from simula.infrastructure.llm.output_parsers import JsonRepairOutputParser


def test_json_repair_parser_recovers_broken_actor_proposal_json() -> None:
    parser = JsonRepairOutputParser(target_schema=ActorActionProposal)
    broken = """
    {
      action_type: "speech",
      intent: "우선순위를 다시 정리하게 만든다.",
      intent_target_cast_ids: ["ally-1"],
      action_summary: "운영 총괄이 조율 action을 제안한다.",
      action_detail: "우선순위를 다시 정리해야 한다.",
      utterance: "",
      visibility: "group",
      target_cast_ids: ["ally-1"],
      thread_id: "",
    }
    """

    parsed = parser.parse(broken)

    assert parsed.visibility == "group"
    assert parsed.target_cast_ids == ["ally-1"]
    assert parsed.utterance == ""


def test_json_repair_parser_rejects_schema_mismatch() -> None:
    parser = JsonRepairOutputParser(target_schema=ActorActionProposal)
    bad_json = (
        '{"action_type":"","intent":"","intent_target_cast_ids":[],"action_summary":"",'
        '"action_detail":"","utterance":"","visibility":"private","target_cast_ids":[],"thread_id":""}'
    )

    with pytest.raises(OutputParserException):
        parser.parse(bad_json)


def test_json_repair_parser_normalizes_single_item_string_list_fields() -> None:
    parser = JsonRepairOutputParser(target_schema=ActorCard)
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
    parser = JsonRepairOutputParser(target_schema=PlanningAnalysis)
    payload = """
    {
      "brief_summary": "요약",
      "premise": "전제",
      "time_scope": {
        "start": "처음",
        "end": "끝"
      },
      "public_context": ["공개 압박"],
      "private_context": ["비공개 조율"],
      "key_pressures": ["시간 압박"],
      "progression_plan": {
        "max_rounds": 4,
        "allowed_elapsed_units": ["day"],
        "default_elapsed_unit": "day",
        "pacing_guidance": ["하루 단위로 진행한다."],
        "selection_reason": ["시나리오가 일 단위 일정으로 보인다."]
      }
    }
    """

    parsed = parser.parse(payload)

    assert parsed.progression_plan.selection_reason == "시나리오가 일 단위 일정으로 보인다."


def test_final_report_sections_requires_all_fields() -> None:
    with pytest.raises(ValueError):
        FinalReportSections.model_validate(
            {
                "conclusion_section": "### 최종 상태\n- 유지\n### 핵심 판단 근거\n- 유지",
                "actor_results_rows": "",
                "timeline_section": "- 2027-06-18 03:20 | 시작 단계 | 사건 | 결과",
                "actor_dynamics_section": "### 현재 구도\nA\n### 관계 변화\nB",
                "major_events_section": "- 사건",
            }
        )
