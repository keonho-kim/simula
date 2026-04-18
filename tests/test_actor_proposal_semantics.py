"""Purpose:
- Verify local actor proposal normalization and semantic inference.
"""

from __future__ import annotations

from simula.application.workflow.graphs.runtime.proposal_contract import (
    actor_proposal_target_rule_lines,
    build_actor_action_narrative_repair_context,
    build_actor_action_shell_repair_context,
    build_actor_proposal_repair_context,
    validate_actor_action_narrative_semantics,
    validate_actor_action_proposal_semantics,
)
from simula.application.workflow.graphs.runtime.nodes.actor_turn_runtime import (
    build_actor_action_shell_semantic_coercer,
)
from simula.application.workflow.graphs.runtime.proposal_semantics import (
    infer_thread_id,
    normalize_actor_action_proposal,
)
import pytest

from simula.domain.contracts import (
    ActorActionNarrative,
    ActorActionProposal,
    ActorActionShell,
)


def test_normalize_actor_action_proposal_infers_target_from_named_public_question() -> None:
    proposal = ActorActionProposal(
        action_type="public_conversation",
        goal="영호의 생각을 파악한다.",
        summary="영호에게 공개적으로 질문한다.",
        detail="공개 자리에서 영호에게 장기 목표를 묻는다.",
        utterance="영호 씨, 장기 목표가 무엇인지 말씀해 주시겠어요?",
        visibility="public",
        target_cast_ids=[],
    )

    normalized = normalize_actor_action_proposal(
        proposal=proposal,
        source_cast_id="youngsuk",
        visible_actors=[
            {"cast_id": "youngho", "display_name": "영호"},
            {"cast_id": "oksun", "display_name": "옥순"},
        ],
        goal_snapshot={},
    )

    assert normalized.target_cast_ids == ["youngho"]


def test_normalize_actor_action_proposal_reuses_existing_thread_for_same_pair() -> None:
    proposal = ActorActionProposal(
        action_type="public_dialogue",
        goal="영호의 감정을 더 확인한다.",
        summary="영호에게 다시 공개 질문을 던진다.",
        detail="공개 자리에서 영호에게 감정 변화를 묻는다.",
        utterance="영호 씨, 지금 감정이 어떻게 달라졌는지 말씀해 주시겠어요?",
        visibility="public",
        target_cast_ids=[],
    )

    normalized = normalize_actor_action_proposal(
        proposal=proposal,
        source_cast_id="youngsuk",
        visible_actors=[
            {"cast_id": "youngho", "display_name": "영호"},
        ],
        goal_snapshot={},
    )

    assert normalized.target_cast_ids == ["youngho"]
    assert (
        infer_thread_id(
            proposal=normalized,
            source_cast_id="youngsuk",
            target_cast_ids=normalized.target_cast_ids,
            visible_action_context=[
                {
                    "thread_id": "pair:youngho+youngsuk:public_conversation",
                    "source_cast_id": "youngho",
                    "target_cast_ids": ["youngsuk"],
                    "action_type": "public_conversation",
                }
            ],
        )
        == "pair:youngho+youngsuk:public_conversation"
    )


def test_validate_actor_action_proposal_semantics_accepts_inferable_public_target() -> None:
    proposal = ActorActionProposal(
        action_type="public_conversation",
        goal="영호의 장기 목표를 파악한다.",
        summary="영호에게 장기 목표를 묻는다.",
        detail="공개 자리에서 영호에게 관계 목표를 묻는다.",
        utterance="영호 씨, 장기적인 목표가 무엇인가요?",
        visibility="public",
        target_cast_ids=[],
    )

    issues = validate_actor_action_proposal_semantics(
        proposal=proposal,
        cast_id="youngsuk",
        available_actions=[
            {
                "action_type": "public_conversation",
                "supported_visibility": ["public"],
                "requires_target": False,
            }
        ],
        valid_target_cast_ids=["youngho", "oksun"],
        visible_actors=[
            {"cast_id": "youngho", "display_name": "영호"},
            {"cast_id": "oksun", "display_name": "옥순"},
        ],
        goal_snapshot={},
        max_target_count=2,
    )

    assert issues == []


def test_validate_actor_action_proposal_semantics_accepts_solo_private_action() -> None:
    proposal = ActorActionProposal(
        action_type="product_inspection",
        goal="성분표를 혼자 다시 확인한다.",
        summary="성분표를 혼자 살핀다.",
        detail="광고 문구와 실제 당류 수치를 혼자 대조한다.",
        utterance="",
        visibility="private",
        target_cast_ids=[],
    )

    issues = validate_actor_action_proposal_semantics(
        proposal=proposal,
        cast_id="seo_yeon",
        available_actions=[
            {
                "action_type": "product_inspection",
                "supported_visibility": ["public", "private"],
                "requires_target": False,
            }
        ],
        valid_target_cast_ids=[],
        visible_actors=[],
        goal_snapshot={},
        max_target_count=1,
    )

    assert issues == []


def test_actor_proposal_repair_context_includes_no_target_fallback_guidance() -> None:
    context = build_actor_proposal_repair_context(
        cast_id="seo_yeon",
        actor_display_name="서연",
        available_actions=[
            {
                "action_type": "initial_reaction",
                "supported_visibility": ["public", "private"],
                "requires_target": False,
            },
            {
                "action_type": "private_confide",
                "supported_visibility": ["private"],
                "requires_target": True,
            },
        ],
        valid_target_cast_ids=[],
        visible_actors=[],
        goal_target_cast_ids=[],
        recent_visible_actions=[],
        max_target_count=1,
    )

    assert context["valid_target_cast_ids"] == []
    assert context["goal_target_cast_ids"] == []
    assert context["repair_guidance"][:5] == list(actor_proposal_target_rule_lines())
    assert "No visible other actor can be targeted in this turn." in context[
        "repair_guidance"
    ]
    assert (
        "These action types may stay solo with `private` visibility and empty target arrays: initial_reaction."
        in context["repair_guidance"]
    )
    assert (
        "If the repaired action is solo or self-directed, prefer `private` visibility and leave both target arrays empty."
        in context["repair_guidance"]
    )


def test_validate_actor_action_shell_semantics_rejects_group_without_targets() -> None:
    with pytest.raises(ValueError, match="group proposals require target_cast_ids"):
        ActorActionShell(
            action_type="sampling_trial",
            visibility="group",
            target_cast_ids=[],
        )


def test_validate_actor_action_narrative_semantics_accepts_compact_narrative() -> None:
    shell = ActorActionShell(
        action_type="review_sharing",
        visibility="private",
        target_cast_ids=[],
    )
    narrative = ActorActionNarrative(
        goal="제품의 첫인상을 정리한다.",
        summary="첫인상을 말한다.",
        detail="패키지와 저당 포지션에 대한 생각을 정리한다.",
        utterance="패키지는 깔끔하네요.",
    )

    issues = validate_actor_action_narrative_semantics(
        narrative=narrative,
        shell=shell,
        cast_id="seo_yeon",
        available_actions=[
            {
                "action_type": "review_sharing",
                "supported_visibility": ["public", "private"],
                "requires_target": False,
            }
        ],
        valid_target_cast_ids=[],
        visible_actors=[],
        goal_snapshot={},
        max_target_count=1,
    )

    assert issues == []


def test_actor_action_narrative_repair_context_prefers_empty_utterance_over_action_swap() -> None:
    context = build_actor_action_narrative_repair_context(
        cast_id="seo_yeon",
        actor_display_name="서연",
        selected_action_shell=ActorActionShell(
            action_type="review_sharing",
            visibility="private",
            target_cast_ids=[],
        ),
        selected_action_spec={
            "action_type": "review_sharing",
            "supported_visibility": ["public", "private"],
            "requires_target": False,
        },
        valid_target_cast_ids=[],
    )

    assert context["selected_action_shell"]["action_type"] == "review_sharing"
    assert (
        "Do not swap to a different action_type just to make the JSON pass validation."
        in context["repair_guidance"]
    )
    assert "Otherwise keep `utterance` empty." in " ".join(
        context["repair_guidance"]
    )


def test_actor_action_shell_repair_context_marks_shell_only_response() -> None:
    context = build_actor_action_shell_repair_context(
        cast_id="seo_yeon",
        actor_display_name="서연",
        available_actions=[
            {
                "action_type": "review_sharing",
                "supported_visibility": ["public", "private"],
                "requires_target": False,
            }
        ],
        valid_target_cast_ids=[],
        visible_actors=[],
        goal_target_cast_ids=[],
        recent_visible_actions=[],
        max_target_count=1,
    )

    assert (
        "In this shell step, return only action_type, visibility, and target_cast_ids."
        in context["repair_guidance"]
    )


def test_actor_action_shell_semantic_coercer_clamps_targets_and_recomputes_thread() -> None:
    coercer = build_actor_action_shell_semantic_coercer(
        actor={"cast_id": "ceo"},
        visible_actors=[
            {"cast_id": "investor", "display_name": "투자자"},
            {"cast_id": "cfo", "display_name": "CFO"},
            {"cast_id": "director", "display_name": "사외이사"},
        ],
        visible_action_context=[],
        runtime_guidance={
            "available_actions": [
                {
                    "action_type": "ceo_board_meeting",
                    "supported_visibility": ["group"],
                    "requires_target": True,
                }
            ],
            "goal_snapshot": {},
        },
        max_recipients_per_message=2,
    )

    coerced, reasons = coercer(
        ActorActionShell(
            action_type="ceo_board_meeting",
            visibility="group",
            target_cast_ids=["ceo", "investor", "investor", "cfo", "director", "outsider"],
        )
    )

    assert coerced.target_cast_ids == ["investor", "cfo"]
    assert "self_target_removed" in reasons
    assert "duplicate_targets_removed" in reasons
    assert "invalid_targets_removed" in reasons
    assert "target_count_clamped" in reasons


def test_actor_action_shell_semantic_coercer_does_not_hide_missing_required_target() -> None:
    coercer = build_actor_action_shell_semantic_coercer(
        actor={"cast_id": "ceo"},
        visible_actors=[],
        visible_action_context=[],
        runtime_guidance={
            "available_actions": [
                {
                    "action_type": "private_confide",
                    "supported_visibility": ["private"],
                    "requires_target": True,
                }
            ],
            "goal_snapshot": {},
        },
        max_recipients_per_message=2,
    )

    shell = ActorActionShell(
        action_type="private_confide",
        visibility="private",
        target_cast_ids=["outsider"],
    )
    coerced, reasons = coercer(shell)

    assert coerced.target_cast_ids == []
    assert reasons == ["invalid_targets_removed"]
