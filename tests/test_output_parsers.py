"""Purpose:
- Verify the JSON repair parser against current required-only contracts.
"""

from __future__ import annotations

import pytest
from langchain_core.exceptions import OutputParserException

from simula.domain.contracts import ActorActionProposal, FinalReportSections
from simula.infrastructure.llm.output_parsers import JsonRepairOutputParser


def test_json_repair_parser_recovers_broken_actor_proposal_json() -> None:
    parser = JsonRepairOutputParser(target_schema=ActorActionProposal)
    broken = """
    {
      action_type: "speech",
      intent: "우선순위를 다시 정리하게 만든다.",
      intent_target_actor_ids: ["ally-1"],
      action_summary: "운영 총괄이 조율 action을 제안한다.",
      action_detail: "우선순위를 다시 정리해야 한다.",
      utterance: "",
      visibility: "group",
      target_actor_ids: ["ally-1"],
      thread_id: "",
    }
    """

    parsed = parser.parse(broken)

    assert parsed.visibility == "group"
    assert parsed.target_actor_ids == ["ally-1"]
    assert parsed.utterance == ""


def test_json_repair_parser_rejects_schema_mismatch() -> None:
    parser = JsonRepairOutputParser(target_schema=ActorActionProposal)
    bad_json = (
        '{"action_type":"","intent":"","intent_target_actor_ids":[],"action_summary":"",'
        '"action_detail":"","utterance":"","visibility":"private","target_actor_ids":[],"thread_id":""}'
    )

    with pytest.raises(OutputParserException):
        parser.parse(bad_json)


def test_final_report_sections_requires_all_fields() -> None:
    with pytest.raises(ValueError):
        FinalReportSections.model_validate(
            {
                "conclusion_section": "### 최종 상태\n- 유지\n### 핵심 이유\n- 유지",
                "actor_results_rows": "",
                "timeline_section": "- 2027-06-18 03:20 | 시작 단계 | 사건 | 결과",
                "actor_dynamics_section": "### 현재 구도\nA\n### 관계 변화\nB",
                "major_events_section": "- 사건",
            }
        )
