"""목적:
- activity feed 처리와 종료 판단 같은 순수 로직을 검증한다.

설명:
- LLM 호출 없이 상태 전이의 핵심 계약만 테스트한다.

사용한 설계 패턴:
- 순수 함수 단위 테스트 패턴

연관된 다른 모듈/구조:
- simula.domain.activity_feeds
- simula.domain.activities
- simula.domain.reporting
- simula.domain.runtime_actions
"""

from __future__ import annotations

from simula.domain.activities import create_canonical_action, recent_actions
from simula.domain.activity_feeds import (
    build_visibility_scope,
    initialize_activity_feeds,
    list_recent_visible_activities,
    list_unseen_activities,
    route_activity,
    sanitize_targets,
)
from simula.domain.reporting import (
    build_final_report,
    latest_observer_summary,
    latest_world_state_summary,
)
from simula.domain.event_memory import hard_stop_round
from simula.domain.runtime_policy import derive_rng_seed
from simula.domain.runtime_actions import apply_actor_proposals


def test_public_activity_targets_no_specific_actor() -> None:
    actors = [
        {"cast_id": "a"},
        {"cast_id": "b"},
        {"cast_id": "c"},
    ]

    targets = sanitize_targets(
        [],
        source_cast_id="a",
        actors=actors,
        visibility="public",
        max_targets=2,
    )

    assert targets == []
    assert build_visibility_scope("a", targets, "public") == ["all"]


def test_route_activity_updates_visible_feeds() -> None:
    actors = [
        {"cast_id": "a"},
        {"cast_id": "b"},
        {"cast_id": "c"},
    ]
    feeds = initialize_activity_feeds(actors)
    activity = create_canonical_action(
        run_id="run-1",
        round_index=1,
        source_cast_id="a",
        visibility="private",
        target_cast_ids=["b"],
        action_type="coordination",
        intent="b와 비공개 정렬을 맞춘다.",
        intent_target_cast_ids=["b"],
        action_summary="비공개 정렬 action",
        action_detail="비공개로 우선순위를 맞춘다.",
        visibility_scope=["a", "b"],
    ).model_dump(mode="json")

    updated = route_activity(feeds, activity)

    assert updated["b"]["unseen_activity_ids"] == [activity["activity_id"]]
    assert updated["c"]["unseen_activity_ids"] == []


def test_route_activity_keeps_solo_private_action_on_source_only() -> None:
    actors = [
        {"cast_id": "a"},
        {"cast_id": "b"},
        {"cast_id": "c"},
    ]
    feeds = initialize_activity_feeds(actors)
    activity = create_canonical_action(
        run_id="run-1",
        round_index=1,
        source_cast_id="a",
        visibility="private",
        target_cast_ids=[],
        action_type="product_inspection",
        intent="혼자 성분표를 다시 확인한다.",
        intent_target_cast_ids=[],
        action_summary="혼자 성분표를 본다.",
        action_detail="광고 문구와 실제 수치를 혼자 대조한다.",
        utterance="",
        visibility_scope=build_visibility_scope("a", [], "private"),
    ).model_dump(mode="json")

    updated = route_activity(feeds, activity)

    assert updated["a"]["seen_activity_ids"] == [activity["activity_id"]]
    assert updated["b"]["unseen_activity_ids"] == []
    assert updated["c"]["unseen_activity_ids"] == []


def test_list_unseen_activities_does_not_consume_feed() -> None:
    actors = [
        {"cast_id": "a"},
        {"cast_id": "b"},
    ]
    feeds = initialize_activity_feeds(actors)
    activity = create_canonical_action(
        run_id="run-1",
        round_index=1,
        source_cast_id="b",
        visibility="private",
        target_cast_ids=["a"],
        action_type="speech",
        intent="a의 입장을 바로 확인한다.",
        intent_target_cast_ids=["a"],
        action_summary="확인 요청 action",
        action_detail="지금 의견을 바로 확인해야 한다.",
        utterance="지금 의견이 필요합니다.",
        visibility_scope=["a", "b"],
    ).model_dump(mode="json")
    updated = route_activity(feeds, activity)

    unseen = list_unseen_activities(updated, "a", [activity])

    assert [item["activity_id"] for item in unseen] == [activity["activity_id"]]
    assert updated["a"]["unseen_activity_ids"] == [activity["activity_id"]]


def test_apply_actor_proposals_consumes_unseen_once_and_routes_activity() -> None:
    actors = [
        {"cast_id": "a", "display_name": "A"},
        {"cast_id": "b", "display_name": "B"},
    ]
    feeds = initialize_activity_feeds(actors)
    inbound_activity = create_canonical_action(
        run_id="run-1",
        round_index=1,
        source_cast_id="b",
        visibility="private",
        target_cast_ids=["a"],
        action_type="speech",
        intent="a의 답을 바로 듣는다.",
        intent_target_cast_ids=["a"],
        action_summary="질문 action",
        action_detail="답변이 바로 필요하다.",
        utterance="답변이 필요합니다.",
        visibility_scope=["a", "b"],
    ).model_dump(mode="json")
    routed_feeds = route_activity(feeds, inbound_activity)

    routed = apply_actor_proposals(
        run_id="run-1",
        round_index=2,
        actors=actors,
        activity_feeds=routed_feeds,
        activities=[inbound_activity],
        action_catalog={
            "actions": [
                {
                    "action_type": "speech",
                    "label": "직접 발화",
                    "description": "직접 말로 의도를 전달한다.",
                    "role_hints": [],
                    "group_hints": [],
                    "supported_visibility": ["public", "private", "group"],
                    "requires_target": True,
                    "supports_utterance": True,
                    "examples_or_usage_notes": [],
                }
            ],
            "selection_guidance": [],
        },
        pending_actor_proposals=[
            {
                "cast_id": "a",
                "unread_activity_ids": [inbound_activity["activity_id"]],
                "proposal": {
                    "action_type": "speech",
                    "intent": "b에게 답을 돌려준다.",
                    "intent_target_cast_ids": ["b"],
                    "action_summary": "A가 응답 action을 한다.",
                    "action_detail": "질문에 바로 반응해 답을 준다.",
                    "utterance": "확인했습니다.",
                    "visibility": "private",
                    "target_cast_ids": ["b"],
                    "thread_id": "",
                },
                "forced_idle": False,
                "parse_failure_count": 0,
                "latency_seconds": 0.01,
            }
        ],
        max_targets_per_activity=2,
    )

    assert routed["activity_feeds"]["a"]["unseen_activity_ids"] == []
    assert (
        inbound_activity["activity_id"]
        in routed["activity_feeds"]["a"]["seen_activity_ids"]
    )
    assert len(routed["latest_round_activities"]) == 1
    assert routed["activity_feeds"]["b"]["unseen_activity_ids"] == [
        routed["latest_round_activities"][0]["activity_id"]
    ]
    assert routed["activities"][0]["activity_id"] == inbound_activity["activity_id"]


def test_hard_stop_round_applies_default_grace_buffer() -> None:
    assert hard_stop_round(configured_max_rounds=10, planned_max_rounds=6) == 8


def test_hard_stop_round_never_exceeds_configured_ceiling() -> None:
    assert hard_stop_round(configured_max_rounds=7, planned_max_rounds=6) == 7


def test_derive_rng_seed_prefers_configured_seed() -> None:
    assert derive_rng_seed(run_id="run-1", configured_seed=1234) == 1234


def test_build_final_report_counts_visibility() -> None:
    state = {
        "run_id": "run-1",
        "scenario": "테스트 시나리오",
        "plan": {
            "situation": {
                "simulation_objective": "갈등 추적",
                "world_summary": "공청회 직전",
            }
        },
        "actors": [
            {"cast_id": "a"},
            {"cast_id": "b"},
        ],
        "activities": [
            {
                "activity_id": "a1",
                "visibility": "public",
            },
            {
                "activity_id": "a2",
                "visibility": "private",
            },
        ],
        "observer_reports": [
            {
                "round_index": 1,
                "summary": "긴장 상승",
                "notable_events": ["공개 행동", "비공개 정렬"],
                "atmosphere": "불안",
                "momentum": "medium",
                "world_state_summary": "실무 정렬이 시작됐다.",
            }
        ],
        "simulation_clock": {
            "total_elapsed_minutes": 30,
            "total_elapsed_label": "30분",
            "last_elapsed_minutes": 30,
            "last_elapsed_label": "30분",
            "last_advanced_round_index": 1,
        },
        "round_index": 1,
        "errors": [],
    }

    report = build_final_report(
        state,
        llm_usage_summary={
            "total_calls": 0,
            "calls_by_role": {},
            "structured_calls": 0,
            "text_calls": 0,
            "parse_failures": 0,
            "forced_defaults": 0,
            "input_tokens": None,
            "output_tokens": None,
            "total_tokens": None,
        },
    )

    assert report["actor_count"] == 2
    assert report["total_activities"] == 2
    assert report["visibility_activity_counts"] == {"public": 1, "private": 1}
    assert report["last_observer_summary"] == "긴장 상승"
    assert report["world_state_summary"] == "실무 정렬이 시작됐다."
    assert report["elapsed_simulation_minutes"] == 30

def test_recent_actions_and_latest_summaries_use_latest_values() -> None:
    activities = [
        {"activity_id": "a1"},
        {"activity_id": "a2"},
        {"activity_id": "a3"},
        {"activity_id": "a4"},
        {"activity_id": "a5"},
        {"activity_id": "a6"},
    ]
    feeds = {
        "a": {
            "seen_activity_ids": ["a1", "a2"],
            "unseen_activity_ids": ["a5", "a6"],
        }
    }
    observer_reports = [
        {"summary": "첫 요약", "world_state_summary": "초기"},
        {"summary": "최신 요약", "world_state_summary": "최신 상태"},
    ]

    recent = recent_actions(activities)
    visible = list_recent_visible_activities(feeds, "a", activities)

    assert [activity["activity_id"] for activity in recent] == [
        "a2",
        "a3",
        "a4",
        "a5",
        "a6",
    ]
    assert [activity["activity_id"] for activity in visible] == [
        "a1",
        "a2",
        "a5",
        "a6",
    ]
    assert latest_observer_summary(observer_reports) == "최신 요약"
    assert latest_world_state_summary(observer_reports) == "최신 상태"
