"""Smoke-test real prompt rendering for every active structured LLM call."""

from __future__ import annotations

import asyncio
import logging
from types import SimpleNamespace

from simula.application.workflow.graphs.coordinator.nodes.assess_round_continuation import (
    assess_round_continuation,
)
from simula.application.workflow.graphs.coordinator.nodes.build_round_directive import (
    build_round_directive,
)
from simula.application.workflow.graphs.coordinator.nodes.resolve_round import (
    resolve_round,
)
from simula.application.workflow.graphs.finalization.nodes.resolve_timeline_anchor import (
    resolve_timeline_anchor,
)
from simula.application.workflow.graphs.generation.nodes.slot_generation import (
    generate_actor_slot,
)
from simula.application.workflow.graphs.planning.nodes.planner import (
    build_execution_plan,
    build_planning_analysis,
)
from simula.application.workflow.graphs.runtime.nodes.actor_turn import (
    generate_actor_proposal,
)
from simula.domain.activity_feeds import initialize_activity_feeds
from simula.domain.contracts import (
    ActorActionProposal,
    ExecutionPlanBundle,
    GeneratedActorCardDraft,
    PlanningAnalysis,
    RoundContinuationDecision,
    RoundDirective,
    RoundResolution,
    TimelineAnchorDecision,
)
from simula.domain.event_memory import build_event_memory


class _FakeMeta:
    duration_seconds = 0.01
    parse_failure_count = 0
    forced_default = False


def _runtime(*, llms: object, max_actor_calls: int = 2) -> SimpleNamespace:
    return SimpleNamespace(
        context=SimpleNamespace(
            llms=llms,
            logger=logging.getLogger("simula.test.prompt-render"),
            run_jsonl_appender=None,
            settings=SimpleNamespace(
                runtime=SimpleNamespace(
                    max_focus_slices_per_step=3,
                    max_actor_calls_per_step=max_actor_calls,
                    max_recipients_per_message=2,
                )
            ),
            store=SimpleNamespace(
                save_round_artifacts=lambda *args, **kwargs: None,
            ),
        )
    )


def test_build_planning_analysis_renders_real_prompt() -> None:
    class FakeLLM:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del kwargs
            assert role == "planner"
            assert schema is PlanningAnalysis
            assert "시나리오 본문 테스트" in prompt
            assert "Round cap" in prompt
            return (
                PlanningAnalysis(
                    brief_summary="공개 압박과 비공개 조율이 겹친다.",
                    premise="표면적 입장보다 실제 정렬 방향이 중요하다.",
                    time_scope={"start": "초기", "end": "종결 직전"},
                    public_context=["공개 압박"],
                    private_context=["비공개 조율"],
                    key_pressures=["시간 압박"],
                    progression_plan={
                        "max_rounds": 4,
                        "allowed_elapsed_units": ["hour"],
                        "default_elapsed_unit": "hour",
                        "pacing_guidance": ["짧게 본다."],
                        "selection_reason": "짧은 조율이 중심이다.",
                    },
                ),
                _FakeMeta(),
            )

    result = asyncio.run(
        build_planning_analysis(
            {
                "scenario": "시나리오 본문 테스트",
                "max_rounds": 4,
                "planning_latency_seconds": 0.0,
            },
            _runtime(llms=FakeLLM()),
        )
    )

    assert result["planned_max_rounds"] == 4


def test_build_execution_plan_renders_real_prompt() -> None:
    class FakeLLM:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del kwargs
            assert role == "planner"
            assert schema is ExecutionPlanBundle
            assert "실행 계획 시나리오" in prompt
            assert '"brief_summary":"요약"' in prompt
            assert "Requested cast count" in prompt
            return (
                ExecutionPlanBundle(
                    situation={
                        "simulation_objective": "긴장 추적",
                        "world_summary": "현재 구도 요약",
                        "initial_tensions": ["즉시 반응 압력"],
                        "channel_guidance": {
                            "public": "공개 대화",
                            "private": "비공개 대화",
                            "group": "그룹 대화",
                        },
                        "current_constraints": ["같은 선언 반복 금지"],
                    },
                    action_catalog={
                        "actions": [
                            {
                                "action_type": "speech",
                                "label": "발화",
                                "description": "말한다.",
                                "supported_visibility": ["public", "private", "group"],
                                "requires_target": False,
                                "supports_utterance": True,
                            }
                        ],
                        "selection_guidance": ["상황에 맞게 고른다."],
                    },
                    coordination_frame={
                        "focus_selection_rules": ["핵심 갈등을 본다."],
                        "background_motion_rules": ["배경은 요약한다."],
                        "focus_archetypes": ["직접 충돌"],
                        "attention_shift_rules": ["조용한 actor도 끌어올린다."],
                        "budget_guidance": ["소수만 직접 본다."],
                    },
                    cast_roster={
                        "items": [
                            {
                                "cast_id": "alpha",
                                "display_name": "알파",
                                "role_hint": "선도자",
                                "group_name": "A",
                                "core_tension": "먼저 움직이고 싶다.",
                            }
                        ]
                    },
                    major_events=[],
                ),
                _FakeMeta(),
            )

    result = asyncio.run(
        build_execution_plan(
            {
                "scenario": "실행 계획 시나리오",
                "scenario_controls": {
                    "num_cast": 1,
                    "allow_additional_cast": False,
                },
                "max_rounds": 4,
                "planning_latency_seconds": 0.0,
                "planning_analysis": {
                    "brief_summary": "요약",
                    "premise": "전제",
                    "time_scope": {"start": "초기", "end": "종결"},
                    "public_context": ["공개"],
                    "private_context": ["비공개"],
                    "key_pressures": ["압박"],
                    "progression_plan": {
                        "max_rounds": 4,
                        "allowed_elapsed_units": ["hour"],
                        "default_elapsed_unit": "hour",
                        "pacing_guidance": ["짧게 본다."],
                        "selection_reason": "짧은 조율이 중심이다.",
                    },
                },
            },
            _runtime(llms=FakeLLM()),
        )
    )

    assert result["plan"]["situation"]["simulation_objective"] == "긴장 추적"


def test_generate_actor_slot_renders_real_prompt() -> None:
    class FakeLLM:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del kwargs
            assert role == "generator"
            assert schema is GeneratedActorCardDraft
            assert "짧은 직접 조율이 핵심이다." in prompt
            assert "직접 충돌" in prompt
            assert '"cast_id":"alpha"' in prompt
            return (
                GeneratedActorCardDraft(
                    role="선도자",
                    public_profile="공개적으로는 강경하다.",
                    private_goal="먼저 압박한다.",
                    speaking_style="짧고 단호하다.",
                    avatar_seed="alpha-seed",
                    baseline_attention_tier="lead",
                    story_function="직접 압박 축",
                    preferred_action_types=["speech"],
                    action_bias_notes=["먼저 말한다."],
                ),
                _FakeMeta(),
            )

    result = asyncio.run(
        generate_actor_slot(
            {
                "scenario_controls": {
                    "num_cast": 1,
                    "allow_additional_cast": False,
                },
                "plan": {
                    "interpretation": {
                        "premise": "표면적 입장보다 실제 정렬 방향이 중요하다.",
                        "time_scope": {"start": "초기", "end": "종결"},
                        "key_pressures": ["시간 압박"],
                        "public_context": ["공개 압박"],
                        "private_context": ["비공개 조율"],
                    },
                    "situation": {
                        "simulation_objective": "긴장 추적",
                        "world_summary": "짧은 직접 조율이 핵심이다.",
                        "initial_tensions": ["즉시 반응 압력"],
                    },
                    "action_catalog": {
                        "actions": [
                            {
                                "action_type": "speech",
                                "label": "발화",
                                "description": "말한다.",
                                "supported_visibility": ["public", "private"],
                                "requires_target": False,
                                "supports_utterance": True,
                            }
                        ],
                        "selection_guidance": ["상황에 맞게 고른다."],
                    },
                    "coordination_frame": {
                        "focus_archetypes": ["직접 충돌"],
                        "attention_shift_rules": ["조용한 actor도 끌어올린다."],
                        "budget_guidance": ["소수만 직접 본다."],
                    },
                    "cast_roster": [{"cast_id": "alpha"}],
                },
                "cast_slot": {
                    "slot_index": 1,
                    "cast_id": "alpha",
                    "display_name": "알파",
                    "group_name": "A",
                    "cast_item": {
                        "cast_id": "alpha",
                        "display_name": "알파",
                        "role_hint": "선도자",
                        "group_name": "A",
                        "core_tension": "먼저 움직이고 싶다.",
                    },
                },
            },
            _runtime(llms=FakeLLM()),
        )
    )

    assert result["generated_actor_results"][0]["cast_id"] == "alpha"


def test_assess_round_continuation_renders_real_prompt() -> None:
    class FakeLLM:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del kwargs
            assert role == "coordinator"
            assert schema is RoundContinuationDecision
            assert "큰 변화 없이 압력만 유지됐다." in prompt
            assert "최종 선택" in prompt
            assert "\n3\n" in prompt
            return (RoundContinuationDecision(stop_reason=""), _FakeMeta())

    event_memory = build_event_memory(
        [
            {
                "event_id": "final_choice",
                "title": "최종 선택",
                "summary": "마지막 선택을 정리해야 한다.",
                "participant_cast_ids": ["a", "b"],
                "earliest_round": 2,
                "latest_round": 4,
                "completion_action_types": ["speech"],
                "completion_signals": ["최종 선택"],
                "required_before_end": True,
            }
        ]
    )
    result = asyncio.run(
        assess_round_continuation(
            {
                "round_index": 3,
                "max_rounds": 6,
                "planned_max_rounds": 5,
                "stagnation_rounds": 3,
                "simulation_clock": {"total_elapsed_label": "3시간"},
                "world_state_summary": "현재 상태",
                "observer_reports": [
                    {
                        "round_index": 3,
                        "summary": "큰 변화 없이 압력만 유지됐다.",
                        "notable_events": [],
                        "atmosphere": "정체",
                        "momentum": "low",
                        "world_state_summary": "현재 상태",
                    }
                ],
                "latest_round_activities": [],
                "round_focus_history": [
                    {
                        "round_index": 3,
                        "focus_summary": "동일한 갈등 축을 반복 추적했다.",
                        "selection_reason": "압력이 유지됐다.",
                        "selected_cast_ids": ["a"],
                        "deferred_cast_ids": ["b"],
                    }
                ],
                "event_memory": event_memory,
                "errors": [],
            },
            _runtime(llms=FakeLLM()),
        )
    )

    assert result["stop_requested"] is False


def test_build_round_directive_renders_real_prompt() -> None:
    class FakeLLM:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del kwargs
            assert role == "coordinator"
            assert schema is RoundDirective
            assert "같은 선언 반복 금지" in prompt
            assert "공개 대화" in prompt
            assert "최종 선택" in prompt
            return (
                RoundDirective(
                    round_index=2,
                    focus_summary="핵심 축을 직접 따라간다.",
                    selection_reason="현재 직접 반응 압력이 가장 높다.",
                    selected_cast_ids=["a", "b"],
                    deferred_cast_ids=["c"],
                    focus_slices=[
                        {
                            "slice_id": "focus-1",
                            "title": "핵심 축",
                            "focus_cast_ids": ["a", "b"],
                            "visibility": "public",
                            "stakes": "즉시 반응이 필요하다.",
                            "selection_reason": "가장 빠른 상태 변화가 난다.",
                        }
                    ],
                    background_updates=[
                        {
                            "round_index": 2,
                            "cast_id": "c",
                            "summary": "배경 압력이 유지된다.",
                            "pressure_level": "medium",
                            "future_hook": "다음 round에 직접 개입할 수 있다.",
                        }
                    ],
                ),
                _FakeMeta(),
            )

    result = asyncio.run(
        build_round_directive(
            {
                "run_id": "run-1",
                "round_index": 2,
                "focus_candidates": [
                    {"cast_id": "a", "display_name": "A"},
                    {"cast_id": "b", "display_name": "B"},
                    {"cast_id": "c", "display_name": "C"},
                ],
                "actors": [
                    {"cast_id": "a", "display_name": "A"},
                    {"cast_id": "b", "display_name": "B"},
                    {"cast_id": "c", "display_name": "C"},
                ],
                "plan": {
                    "coordination_frame": {
                        "focus_selection_rules": ["핵심 갈등을 본다."],
                        "attention_shift_rules": ["조용한 actor도 끌어올린다."],
                        "budget_guidance": ["소수만 직접 본다."],
                    },
                    "situation": {
                        "simulation_objective": "긴장 추적",
                        "world_summary": "현재 구도 요약",
                        "initial_tensions": ["즉시 반응 압력"],
                        "channel_guidance": {
                            "public": "공개 대화",
                            "private": "비공개 대화",
                            "group": "그룹 대화",
                        },
                        "current_constraints": ["같은 선언 반복 금지"],
                    },
                },
                "simulation_clock": {"total_elapsed_label": "2시간"},
                "event_memory": build_event_memory(
                    [
                        {
                            "event_id": "final_choice",
                            "title": "최종 선택",
                            "summary": "마지막 선택을 정리해야 한다.",
                            "participant_cast_ids": ["a", "b"],
                            "earliest_round": 2,
                            "latest_round": 3,
                            "completion_action_types": ["speech"],
                            "completion_signals": ["최종 선택"],
                            "required_before_end": True,
                        }
                    ]
                ),
                "observer_reports": [{"summary": "직전 요약"}],
                "round_focus_history": [],
                "background_updates": [],
                "errors": [],
                "stagnation_rounds": 0,
            },
            _runtime(llms=FakeLLM(), max_actor_calls=3),
        )
    )

    assert result["selected_cast_ids"] == ["a", "b"]


def test_generate_actor_proposal_renders_real_prompt() -> None:
    class FakeLLM:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del kwargs
            assert role == "actor"
            assert schema is ActorActionProposal
            assert "공개 대화" in prompt
            assert "같은 선언 반복 금지" in prompt
            assert "질문을 더 분명하게 던진다." in prompt
            return (
                ActorActionProposal(
                    action_type="speech",
                    intent="Beta의 반응을 확인한다.",
                    intent_target_cast_ids=["beta"],
                    action_summary="Alpha가 Beta에게 반응을 묻는다.",
                    action_detail="이번에는 말을 돌리지 말고 답해 달라고 한다.",
                    utterance="이번에는 답을 분명히 말해줘.",
                    visibility="private",
                    target_cast_ids=["beta"],
                    thread_id="pair:alpha+beta:public_conversation",
                ),
                _FakeMeta(),
            )

    result = asyncio.run(
        generate_actor_proposal(
            {
                "round_index": 2,
                "plan": {
                    "progression_plan": {
                        "max_rounds": 4,
                        "allowed_elapsed_units": ["minute", "hour"],
                        "default_elapsed_unit": "minute",
                        "pacing_guidance": ["짧게 본다."],
                        "selection_reason": "짧은 직접 반응이 중심이다.",
                    }
                },
                "simulation_clock": {"total_elapsed_label": "2시간"},
                "actor_proposal_task": {
                    "actor": {"cast_id": "alpha", "display_name": "Alpha"},
                    "unread_activity_ids": [],
                    "visible_action_context": [],
                    "unread_backlog_digest": {},
                    "visible_actors": [{"cast_id": "beta", "display_name": "Beta"}],
                    "focus_slice": {
                        "slice_id": "focus-1",
                        "title": "핵심 축",
                        "focus_cast_ids": ["alpha", "beta"],
                    },
                    "runtime_guidance": {
                        "simulation_objective": "긴장 추적",
                        "actor_facing_scenario_digest": {
                            "round_index": 2,
                            "relationship_map_summary": "Alpha와 Beta가 맞붙는다.",
                            "current_pressures": ["직접 반응 압력"],
                            "talking_points": ["질문을 더 분명하게 던진다."],
                            "avoid_repetition_notes": ["같은 선언 반복 금지"],
                            "recommended_tone": "짧고 단호한 톤",
                            "world_state_summary": "직접 압박이 유지된다.",
                        },
                        "channel_guidance": {
                            "public": "공개 대화",
                            "private": "비공개 대화",
                            "group": "그룹 대화",
                        },
                        "current_constraints": ["같은 선언 반복 금지"],
                        "current_intent_snapshot": {
                            "cast_id": "alpha",
                            "current_intent": "Beta의 반응을 확인한다.",
                            "thought": "이번에는 답을 받아야 한다고 본다.",
                            "target_cast_ids": ["beta"],
                            "supporting_action_type": "speech",
                            "confidence": 0.8,
                            "changed_from_previous": True,
                        },
                        "available_actions": [
                            {
                                "action_type": "speech",
                                "supported_visibility": ["public", "private"],
                                "requires_target": False,
                                "supports_utterance": True,
                            }
                        ],
                        "action_selection_guidance": ["짧게 직접 묻는다."],
                    },
                },
            },
            _runtime(llms=FakeLLM()),
        )
    )

    assert result["pending_actor_proposals"][0]["cast_id"] == "alpha"


def test_resolve_round_renders_real_prompt() -> None:
    class FakeLLM:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del kwargs
            assert role == "coordinator"
            assert schema is RoundResolution
            assert "같은 선언 반복 금지" in prompt
            assert "공개 대화" in prompt
            assert '"pressure_level":"high"' in prompt
            return (
                RoundResolution(
                    adopted_cast_ids=[],
                    updated_intent_states=[
                        {
                            "cast_id": "alpha",
                            "current_intent": "다음 반응을 기다린다.",
                            "thought": "한 번 더 상황을 보고 밀어야 한다고 본다.",
                            "target_cast_ids": ["beta"],
                            "supporting_action_type": "speech",
                            "confidence": 0.7,
                            "changed_from_previous": False,
                        }
                    ],
                    event_updates=[],
                    round_time_advance={
                        "elapsed_unit": "minute",
                        "elapsed_amount": 15,
                        "selection_reason": "짧은 반응 정리 단계다.",
                        "signals": ["직접 압박 여진"],
                    },
                    observer_report={
                        "round_index": 2,
                        "summary": "직접 압박 이후 다음 반응 대기가 이어진다.",
                        "notable_events": ["배경 압력이 누적됐다."],
                        "atmosphere": "긴장",
                        "momentum": "medium",
                        "world_state_summary": "직접 압박과 배경 압력이 함께 유지된다.",
                    },
                    actor_facing_scenario_digest={
                        "round_index": 2,
                        "relationship_map_summary": "Alpha가 압박을 유지하고 Beta는 반응을 늦춘다.",
                        "current_pressures": ["지금은 다음 답변이 중요하다."],
                        "talking_points": ["답을 흐리지 못하게 질문을 더 명확히 한다."],
                        "avoid_repetition_notes": ["같은 선언 반복 금지"],
                        "recommended_tone": "짧고 분명한 톤",
                        "world_state_summary": "직접 압박과 배경 압력이 함께 유지된다.",
                    },
                    world_state_summary="직접 압박과 배경 압력이 함께 유지된다.",
                    stop_reason="",
                ),
                _FakeMeta(),
            )

    result = asyncio.run(
        resolve_round(
            {
                "run_id": "run-1",
                "round_index": 2,
                "max_rounds": 5,
                "planned_max_rounds": 4,
                "actors": [
                    {"cast_id": "alpha", "display_name": "Alpha", "private_goal": "압박한다."},
                    {"cast_id": "beta", "display_name": "Beta", "private_goal": "버틴다."},
                ],
                "activity_feeds": initialize_activity_feeds(
                    [{"cast_id": "alpha"}, {"cast_id": "beta"}]
                ),
                "activities": [],
                "latest_round_activities": [],
                "round_focus_plan": {"selected_cast_ids": ["alpha"]},
                "latest_background_updates": [
                    {
                        "round_index": 2,
                        "cast_id": "beta",
                        "summary": "Beta 쪽 압력이 커진다.",
                        "pressure_level": "high",
                        "future_hook": "다음 round에 직접 응답할 수 있다.",
                    }
                ],
                "selected_cast_ids": ["alpha"],
                "actor_intent_states": [
                    {
                        "cast_id": "alpha",
                        "current_intent": "Beta의 반응을 확인한다.",
                        "thought": "이번에는 답을 받아야 한다고 본다.",
                        "target_cast_ids": ["beta"],
                        "supporting_action_type": "speech",
                        "confidence": 0.8,
                        "changed_from_previous": True,
                    }
                ],
                "actor_facing_scenario_digest": {
                    "round_index": 1,
                    "relationship_map_summary": "직전 압박이 유지된다.",
                    "current_pressures": ["직접 반응 압력"],
                    "talking_points": ["답을 더 분명히 요구한다."],
                    "avoid_repetition_notes": ["같은 선언 반복 금지"],
                    "recommended_tone": "짧고 단호한 톤",
                    "world_state_summary": "직접 압박이 유지된다.",
                },
                "world_state_summary": "직접 압박이 유지된다.",
                "event_memory": build_event_memory(
                    [
                        {
                            "event_id": "final_choice",
                            "title": "최종 선택",
                            "summary": "마지막 선택을 정리해야 한다.",
                            "participant_cast_ids": ["alpha", "beta"],
                            "earliest_round": 2,
                            "latest_round": 3,
                            "completion_action_types": ["speech"],
                            "completion_signals": ["최종 선택"],
                            "required_before_end": True,
                        }
                    ]
                ),
                "plan": {
                    "progression_plan": {
                        "max_rounds": 4,
                        "allowed_elapsed_units": ["minute", "hour"],
                        "default_elapsed_unit": "minute",
                        "pacing_guidance": ["짧게 본다."],
                        "selection_reason": "짧은 직접 반응이 중심이다.",
                    },
                    "situation": {
                        "simulation_objective": "긴장 추적",
                        "world_summary": "현재 구도 요약",
                        "initial_tensions": ["즉시 반응 압력"],
                        "channel_guidance": {
                            "public": "공개 대화",
                            "private": "비공개 대화",
                            "group": "그룹 대화",
                        },
                        "current_constraints": ["같은 선언 반복 금지"],
                    },
                    "coordination_frame": {
                        "focus_selection_rules": ["핵심 갈등을 본다."],
                        "background_motion_rules": ["배경은 요약한다."],
                        "focus_archetypes": ["직접 충돌"],
                        "attention_shift_rules": ["조용한 actor도 끌어올린다."],
                        "budget_guidance": ["소수만 직접 본다."],
                    },
                    "action_catalog": {
                        "actions": [
                            {
                                "action_type": "speech",
                                "label": "발화",
                                "description": "말한다.",
                                "supported_visibility": ["public", "private", "group"],
                                "requires_target": False,
                                "supports_utterance": True,
                            }
                        ],
                        "selection_guidance": ["상황에 맞게 고른다."],
                    },
                },
                "pending_actor_proposals": [],
                "simulation_clock": {
                    "total_elapsed_minutes": 60,
                    "total_elapsed_label": "1시간",
                    "last_elapsed_minutes": 30,
                    "last_elapsed_label": "30분",
                    "last_advanced_round_index": 1,
                },
                "observer_reports": [],
                "round_time_history": [],
                "intent_history": [],
                "forced_idles": 0,
                "parse_failures": 0,
                "stagnation_rounds": 2,
                "stop_requested": False,
                "stop_reason": "",
                "current_round_started_at": 0.0,
                "errors": [],
            },
            _runtime(llms=FakeLLM()),
        )
    )

    assert result["observer_reports"][0]["round_index"] == 2


def test_resolve_timeline_anchor_renders_real_prompt() -> None:
    class FakeLLM:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del kwargs
            assert role == "observer"
            assert schema is TimelineAnchorDecision
            assert "시작 시점은 첫날 밤" in prompt
            assert "없음" in prompt
            assert "2시간" in prompt
            return (
                TimelineAnchorDecision(
                    anchor_iso="2027-06-18T21:00:00",
                    selection_reason="첫날 밤이라는 맥락을 시작 anchor로 삼았다.",
                ),
                _FakeMeta(),
            )

    result = asyncio.run(
        resolve_timeline_anchor(
            {
                "scenario": "시작 시점은 첫날 밤이다.\n참가자들은 서로를 탐색한다.",
                "simulation_clock": {"total_elapsed_label": "2시간"},
                "max_rounds": 4,
            },
            _runtime(llms=FakeLLM()),
        )
    )

    assert result["report_timeline_anchor_json"]["anchor_iso"] == "2027-06-18T21:00:00"
