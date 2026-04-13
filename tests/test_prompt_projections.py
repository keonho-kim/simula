"""목적:
- prompt projection 유틸의 축약 규칙을 검증한다.

설명:
- hot path prompt에 들어가는 actor/action/intent view가 cap과 slim field 규칙을
  지키는지 확인한다.

사용한 설계 패턴:
- projection 유틸 단위 테스트 패턴
"""

from __future__ import annotations

from simula.application.workflow.utils.prompt_projections import (
    build_actor_available_actions_view,
    build_actor_visible_actors_view,
    build_compact_pending_actor_proposals,
    build_relevant_intent_states,
    build_visible_action_context,
)


def test_build_visible_action_context_dedupes_and_creates_backlog_digest() -> None:
    unread = [
        {
            "activity_id": "a1",
            "round_index": 1,
            "source_actor_id": "b",
            "target_actor_ids": ["a"],
            "visibility": "private",
            "action_type": "speech",
            "action_summary": "첫 번째 요약",
            "action_detail": "긴 상세 설명",
            "utterance": "짧은 발화",
            "thread_id": "t-1",
        }
        for _ in range(7)
    ]
    recent = [
        {
            "activity_id": "a1",
            "round_index": 1,
            "source_actor_id": "b",
            "target_actor_ids": ["a"],
            "visibility": "private",
            "action_type": "speech",
            "action_summary": "중복 요약",
            "utterance": "중복 발화",
            "thread_id": "t-1",
        },
        {
            "activity_id": "a2",
            "round_index": 1,
            "source_actor_id": "c",
            "target_actor_ids": ["a"],
            "visibility": "public",
            "action_type": "signal",
            "action_summary": "두 번째 요약",
            "utterance": "",
            "thread_id": "",
        },
    ]

    context, digest = build_visible_action_context(
        unread_visible_activities=unread,
        recent_visible_activities=recent,
    )

    assert len(context) == 2
    assert [item["activity_id"] for item in context] == ["a1", "a2"]
    assert digest == {}

    overflow_unread = unread + [
        {
            "activity_id": f"a-extra-{index}",
            "round_index": 1,
            "source_actor_id": "d",
            "target_actor_ids": ["a"],
            "visibility": "private",
            "action_type": "signal",
            "action_summary": "추가 요약",
            "utterance": "",
            "thread_id": f"t-{index}",
        }
        for index in range(6)
    ]
    context, digest = build_visible_action_context(
        unread_visible_activities=overflow_unread,
        recent_visible_activities=[],
    )

    assert len(context) == 6
    assert digest != {}
    assert digest["unread_count"] == 7
    assert digest["omitted_count"] == 1


def test_build_actor_visible_actors_view_caps_and_prefers_related_actors() -> None:
    actors = [
        {
            "actor_id": actor_id,
            "display_name": actor_id.upper(),
            "role": f"{actor_id} role",
            "group_name": "g",
            "baseline_attention_tier": "support",
            "story_function": f"{actor_id} function",
        }
        for actor_id in [
            "self",
            "peer-1",
            "peer-2",
            "t-1",
            "src-1",
            "sel-1",
            "sel-2",
            "sel-3",
        ]
    ]

    visible = build_actor_visible_actors_view(
        actors=actors,
        actor_id="self",
        focus_slice={"focus_actor_ids": ["self", "peer-1", "peer-2"]},
        current_intent_snapshot={"target_actor_ids": ["t-1"]},
        visible_action_context=[
            {
                "source_actor_id": "src-1",
                "target_actor_ids": ["self"],
            }
        ],
        selected_actor_ids=["self", "peer-1", "peer-2", "sel-1", "sel-2", "sel-3"],
    )

    assert len(visible) == 6
    assert [item["actor_id"] for item in visible[:4]] == [
        "peer-1",
        "peer-2",
        "t-1",
        "src-1",
    ]


def test_build_actor_available_actions_view_caps_and_uses_usage_hint() -> None:
    matched = []
    fallback = [
        {
            "action_type": f"action-{index}",
            "label": f"라벨 {index}",
            "description": "설명",
            "supported_visibility": ["public"],
            "requires_target": False,
            "supports_utterance": False,
        }
        for index in range(8)
    ]

    compact = build_actor_available_actions_view(
        matched_actions=matched,
        fallback_actions=fallback,
    )

    assert len(compact) == 5
    assert set(compact[0]) == {
        "action_type",
        "supported_visibility",
        "requires_target",
        "supports_utterance",
        "usage_hint",
    }


def test_build_compact_pending_actor_proposals_strips_metadata() -> None:
    compact = build_compact_pending_actor_proposals(
        [
            {
                "actor_id": "a",
                "unread_activity_ids": ["x"],
                "forced_idle": False,
                "parse_failure_count": 1,
                "latency_seconds": 0.2,
                "proposal": {
                    "action_type": "speech",
                    "intent": "짧은 intent",
                    "intent_target_actor_ids": ["b"],
                    "action_summary": "짧은 요약",
                    "action_detail": "긴 설명",
                    "utterance": "발화",
                    "visibility": "private",
                    "target_actor_ids": ["b"],
                    "thread_id": "t-1",
                },
            }
        ]
    )

    assert list(compact[0]) == ["actor_id", "forced_idle", "proposal"]
    assert "latency_seconds" not in compact[0]
    assert "parse_failure_count" not in compact[0]
    assert "unread_activity_ids" not in compact[0]


def test_build_relevant_intent_states_filters_subset() -> None:
    states = [
        {
            "actor_id": actor_id,
            "current_intent": f"{actor_id} intent",
            "thought": f"{actor_id} thought",
            "target_actor_ids": [],
            "supporting_action_type": "speech",
            "confidence": 0.5,
            "changed_from_previous": False,
        }
        for actor_id in ["a", "b", "c"]
    ]

    selected = build_relevant_intent_states(
        states,
        relevant_actor_ids=["b", "c"],
    )

    assert [item["actor_id"] for item in selected] == ["b", "c"]
    assert selected[0]["thought"] == "b thought"
