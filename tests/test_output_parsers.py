"""Purpose:
- Verify the JSON repair parser against current required-only contracts.
"""

from __future__ import annotations

from typing import Literal

import pytest
from langchain_core.exceptions import OutputParserException

from simula.domain.contracts import (
    ActorCard,
    FinalReportDraft,
    MajorEventPlanItem,
    MajorEventUpdate,
    PlanningAnalysis,
    SceneDelta,
)
from simula.infrastructure.llm.output_parsers import (
    build_object_output_parser,
    parse_simple_output,
)


def test_json_repair_parser_recovers_broken_scene_delta_json() -> None:
    parser = build_object_output_parser(SceneDelta)
    broken = """
    {
      selected_event_id: "evt-1",
      scene_beats: [{
        beat_id: "B1",
        candidate_id: "C1",
        source_cast_id: "alpha",
        target_cast_ids: ["beta"],
        intent: "압박을 분명히 한다.",
        action_type: "speech",
        summary: "Alpha가 Beta에게 결정을 요구한다.",
        detail: "Alpha는 지연이 더 큰 손실을 만든다고 설명한다.",
        utterance: "지금 결정해야 합니다.",
        reaction: "Beta는 부담을 느낀다.",
        emotional_tone: "tense",
        event_effect: "결정 압박이 높아졌다."
      }],
      intent_updates: [],
      event_updates: [{
        event_id: "evt-1",
        status: "in_progress",
        progress_summary: "결정 압박이 높아졌다.",
        matched_activity_ids: []
      }],
      world_state_summary: "논의가 더 직접적인 압박으로 바뀌었다.",
      time_advance: {
        elapsed_unit: "minute",
        elapsed_amount: 15,
        reason: "직접 발언이 오갔다."
      },
      stop_reason: "",
      debug_rationale: "C1이 현재 event 압박을 가장 잘 진행한다.",
    }
    """

    parsed = parser.parse(broken)

    assert parsed.scene_beats[0].candidate_id == "C1"
    assert parsed.event_updates[0].matched_activity_ids == []


def test_json_repair_parser_rejects_schema_mismatch() -> None:
    parser = build_object_output_parser(SceneDelta)
    bad_json = '{"selected_event_id":"","scene_beats":[]}'

    with pytest.raises(OutputParserException):
        parser.parse(bad_json)


def test_json_repair_parser_normalizes_single_item_string_list_fields() -> None:
    parser = build_object_output_parser(ActorCard)
    payload = """
    {
      "cast_id": "jeongsuk_female",
      "display_name": "정숙",
      "role": "여성 참가자다.",
      "narrative_profile": "관계 긴장을 높인다.",
      "private_goal": "경수와 더 가까워지고 싶다.",
      "voice": "부드럽고 조심스럽다.",
      "preferred_action_types": "private_confide"
    }
    """

    parsed = parser.parse(payload)

    assert parsed.preferred_action_types == ["private_confide"]


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


def test_final_report_draft_normalizes_markdown_section_arrays() -> None:
    parsed = FinalReportDraft.model_validate(
        {
            "conclusion_section": "### 최종 상태\n- 유지\n### 핵심 판단 근거\n- 근거",
            "actor_dynamics_section": "### 현재 구도\n- A\n### 관계 변화\n- B",
            "major_events_section": ["- A", "- B"],
        }
    )

    assert parsed.major_events_section == "- A\n- B"


def test_final_report_draft_no_longer_requires_timeline_section() -> None:
    parsed = FinalReportDraft.model_validate(
        {
            "conclusion_section": "### 최종 상태\n- 유지\n### 핵심 판단 근거\n- 근거",
            "actor_dynamics_section": "### 현재 구도\n- A\n### 관계 변화\n- B",
            "major_events_section": "- 사건",
        }
    )

    assert parsed.major_events_section == "- 사건"


def test_simple_parser_reads_top_level_array_of_models() -> None:
    parsed = parse_simple_output(
        """
        [
          {
            "event_id": "evt-1",
            "status": "in_progress",
            "progress_summary": "결정 압박이 유지된다.",
            "matched_activity_ids": []
          }
        ]
        """,
        list[MajorEventUpdate],
    )

    assert parsed[0].event_id == "evt-1"


def test_simple_parser_normalizes_major_event_single_string_list_fields() -> None:
    parsed = parse_simple_output(
        """
        [
          {
            "event_id": "evt-1",
            "title": "언론 대응",
            "summary": "공식적인 언론 대응이 필요해진다.",
            "participant_cast_ids": "ceo",
            "earliest_round": 1,
            "latest_round": 2,
            "completion_action_types": "speech",
            "completion_signals": "공식적인 언론 대응 문구가 발표된다.",
            "must_resolve": true
          }
        ]
        """,
        list[MajorEventPlanItem],
    )

    assert parsed[0].participant_cast_ids == ["ceo"]
    assert parsed[0].completion_action_types == ["speech"]
    assert parsed[0].completion_signals == [
        "공식적인 언론 대응 문구가 발표된다."
    ]


def test_simple_parser_reads_top_level_scalar_literal() -> None:
    parsed = parse_simple_output('"no_progress"', Literal["", "no_progress"])

    assert parsed == "no_progress"
