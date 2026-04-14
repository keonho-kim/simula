"""Purpose:
- Verify local actor proposal normalization and semantic inference.
"""

from __future__ import annotations

from simula.application.workflow.graphs.runtime.proposal_contract import (
    validate_actor_action_proposal_semantics,
)
from simula.application.workflow.graphs.runtime.proposal_semantics import (
    normalize_actor_action_proposal,
)
from simula.domain.contracts import ActorActionProposal


def test_normalize_actor_action_proposal_infers_target_from_named_public_question() -> None:
    proposal = ActorActionProposal(
        action_type="public_conversation",
        intent="영호의 생각을 파악한다.",
        intent_target_cast_ids=[],
        action_summary="영호에게 공개적으로 질문한다.",
        action_detail="공개 자리에서 영호에게 장기 목표를 묻는다.",
        utterance="영호 씨, 장기 목표가 무엇인지 말씀해 주시겠어요?",
        visibility="public",
        target_cast_ids=[],
        thread_id="",
    )

    normalized = normalize_actor_action_proposal(
        proposal=proposal,
        source_cast_id="youngsuk",
        visible_actors=[
            {"cast_id": "youngho", "display_name": "영호"},
            {"cast_id": "oksun", "display_name": "옥순"},
        ],
        visible_action_context=[],
        current_intent_snapshot={},
    )

    assert normalized.target_cast_ids == ["youngho"]
    assert normalized.intent_target_cast_ids == ["youngho"]
    assert normalized.thread_id == "pair:youngho+youngsuk:public_conversation"


def test_normalize_actor_action_proposal_reuses_existing_thread_for_same_pair() -> None:
    proposal = ActorActionProposal(
        action_type="public_dialogue",
        intent="영호의 감정을 더 확인한다.",
        intent_target_cast_ids=[],
        action_summary="영호에게 다시 공개 질문을 던진다.",
        action_detail="공개 자리에서 영호에게 감정 변화를 묻는다.",
        utterance="영호 씨, 지금 감정이 어떻게 달라졌는지 말씀해 주시겠어요?",
        visibility="public",
        target_cast_ids=[],
        thread_id="",
    )

    normalized = normalize_actor_action_proposal(
        proposal=proposal,
        source_cast_id="youngsuk",
        visible_actors=[
            {"cast_id": "youngho", "display_name": "영호"},
        ],
        visible_action_context=[
            {
                "thread_id": "pair:youngho+youngsuk:public_conversation",
                "source_cast_id": "youngho",
                "target_cast_ids": ["youngsuk"],
                "action_type": "public_conversation",
            }
        ],
        current_intent_snapshot={},
    )

    assert normalized.target_cast_ids == ["youngho"]
    assert normalized.thread_id == "pair:youngho+youngsuk:public_conversation"


def test_validate_actor_action_proposal_semantics_accepts_inferable_public_target() -> None:
    proposal = ActorActionProposal(
        action_type="public_conversation",
        intent="영호의 장기 목표를 파악한다.",
        intent_target_cast_ids=[],
        action_summary="영호에게 장기 목표를 묻는다.",
        action_detail="공개 자리에서 영호에게 관계 목표를 묻는다.",
        utterance="영호 씨, 장기적인 목표가 무엇인가요?",
        visibility="public",
        target_cast_ids=[],
        thread_id="",
    )

    issues = validate_actor_action_proposal_semantics(
        proposal=proposal,
        cast_id="youngsuk",
        available_actions=[
            {
                "action_type": "public_conversation",
                "supported_visibility": ["public"],
                "requires_target": False,
                "supports_utterance": True,
            }
        ],
        valid_target_cast_ids=["youngho", "oksun"],
        visible_actors=[
            {"cast_id": "youngho", "display_name": "영호"},
            {"cast_id": "oksun", "display_name": "옥순"},
        ],
        current_intent_snapshot={},
        max_target_count=2,
    )

    assert issues == []
