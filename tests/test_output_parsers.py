"""목적:
- JSON repair 출력 파서를 직접 검증한다.

설명:
- 실제 LLM 없이 문자열 응답만으로 JSON 파서의 복원력과 검증 경로를 확인한다.

사용한 설계 패턴:
- 출력 파서 단위 테스트 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.llm.output_parsers
"""

from __future__ import annotations

import pytest
from langchain_core.exceptions import OutputParserException

from simula.domain.contracts import ActorActionProposal, ObserverEventProposal
from simula.infrastructure.llm.output_parsers import JsonRepairOutputParser


def test_json_repair_parser_recovers_broken_json() -> None:
    parser = JsonRepairOutputParser(target_schema=ActorActionProposal)
    broken = """
    {
      action_type: "speech",
      intent: "우선순위를 다시 정리하게 만든다.",
      intent_target_actor_ids: ["ally-1"],
      action_summary: "운영 총괄이 조율 action을 제안한다.",
      action_detail: "우선순위를 다시 정리해야 한다.",
      utterance: "우선순위를 다시 정리해야 합니다.",
      visibility: "group",
      target_actor_ids: ["ally-1"],
      thread_id: null,
    }
    """

    parsed = parser.parse(broken)

    assert parsed.visibility == "group"
    assert parsed.target_actor_ids == ["ally-1"]


def test_json_repair_parser_rejects_schema_mismatch() -> None:
    parser = JsonRepairOutputParser(target_schema=ActorActionProposal)
    bad_json = '{"action_type":"","intent":"","intent_target_actor_ids":[],"action_summary":"","action_detail":"","utterance":null,"visibility":"private","target_actor_ids":[],"thread_id":null}'

    with pytest.raises(OutputParserException):
        parser.parse(bad_json)


def test_actor_action_proposal_normalizes_blank_utterance_to_none() -> None:
    parsed = ActorActionProposal.model_validate(
        {
            "action_type": "reposition",
            "intent": "우선순위를 다시 정리한다.",
            "intent_target_actor_ids": [],
            "action_summary": "운영 총괄이 내부 우선순위를 다시 정리한다.",
            "action_detail": "즉시 공개 발화를 하지 않고 내부 기준만 다시 맞춘다.",
            "utterance": "   ",
            "visibility": "public",
            "target_actor_ids": [],
            "thread_id": None,
        }
    )

    assert parsed.utterance is None


def test_observer_event_proposal_normalizes_blank_utterance_to_none() -> None:
    parsed = ObserverEventProposal.model_validate(
        {
            "action_type": "public_event",
            "intent": "흐름을 다시 흔든다.",
            "action_summary": "예정에 없던 공용 일정 변화가 공개된다.",
            "action_detail": "전체 흐름을 다시 보게 만드는 공용 상황 변화가 생긴다.",
            "utterance": "",
            "thread_id": "observer-event",
        }
    )

    assert parsed.utterance is None
