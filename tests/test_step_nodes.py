"""목적:
- coordinator/runtime 노드의 핵심 상태 전이를 검증한다.

설명:
- 후보 압축, focus 계획, actor fan-out, observer 요약, planning progression 갱신을 단위 테스트한다.

사용한 설계 패턴:
- runtime/coordinator node 단위 테스트 패턴
"""

from __future__ import annotations

import asyncio
import logging
from types import SimpleNamespace

import pytest

from simula.application.workflow.graphs.coordinator.nodes.adjudicate_step_focus import (
    _normalize_step_time_advance_payload,
    adjudicate_step_focus,
)
from simula.application.workflow.graphs.coordinator.nodes.build_step_focus_plan import (
    build_step_focus_plan,
)
from simula.application.workflow.graphs.coordinator.nodes.prepare_focus_candidates import (
    prepare_focus_candidates,
)
from simula.application.workflow.graphs.coordinator.nodes.summarize_background_updates import (
    summarize_background_updates,
)
from simula.application.workflow.graphs.runtime.nodes.actor_turn import (
    dispatch_selected_actor_proposals,
    generate_actor_proposal,
)
from simula.application.workflow.graphs.runtime.nodes.observation import (
    observe_step,
)
from simula.domain.activity_feeds import initialize_activity_feeds
from simula.domain.contracts import (
    ActionCatalog,
    ActorActionProposal,
    BackgroundUpdateBatch,
    ObserverReport,
    RuntimeProgressionPlan,
    ScenarioBrief,
    StepAdjudication,
    StepFocusPlan,
)


class FakeObserverLLM:
    async def ainvoke_structured_with_meta(
        self,
        role,
        prompt,
        schema,
        **kwargs,  # noqa: ANN003
    ):
        del role, prompt, kwargs
        assert schema is ObserverReport
        return (
            ObserverReport(
                step_index=2,
                summary="직접 반영된 action과 배경 압력이 함께 다음 단계를 밀고 있다.",
                notable_events=["비공개 압박 채택", "배경 압력 상승"],
                atmosphere="긴장",
                momentum="medium",
                world_state_summary="직접 충돌은 좁지만 배경 압력은 조금씩 커지고 있다.",
            ),
            SimpleNamespace(parse_failure_count=0),
        )


class FakePlannerLLM:
    async def ainvoke_structured_with_meta(
        self,
        role,
        prompt,
        schema,
        **kwargs,  # noqa: ANN003
    ):
        del role, prompt, kwargs
        if schema is ScenarioBrief:
            return (
                ScenarioBrief(
                    summary="공개 신호와 비공개 계산이 함께 움직이는 다자 위기다. 제한된 시간 안에 누가 먼저 강한 신호를 보내고 누가 그 신호를 따라갈지가 종결 경로를 가른다.",
                    key_entities=["핵심 의사결정자", "직접 압박 상대"],
                    explicit_time_signals=["초기 충돌 직후", "종결 직전"],
                    public_facts=["공개 신호가 중요하다."],
                    private_dynamics=["비공개 계산이 실제 선택을 바꾼다."],
                    terminal_conditions=["최종 결심까지 본다."],
                ),
                SimpleNamespace(duration_seconds=0.4, parse_failure_count=0),
            )
        assert schema is RuntimeProgressionPlan
        return (
            RuntimeProgressionPlan(
                max_steps=4,
                allowed_units=["minute", "hour", "day"],
                default_unit="hour",
                pacing_guidance=["대화는 짧게, 이동은 길게 본다."],
                selection_reason="짧은 반응과 긴 준비 구간이 함께 있어 복수 단위가 필요하다.",
            ),
            SimpleNamespace(duration_seconds=0.4, parse_failure_count=0),
        )


def test_observe_step_updates_world_state_summary() -> None:
    runtime = SimpleNamespace(
        context=SimpleNamespace(
            llms=FakeObserverLLM(),
            logger=logging.getLogger("simula.test.step"),
        )
    )
    state = {
        "step_index": 2,
        "simulation_clock": {
            "total_elapsed_minutes": 90,
            "total_elapsed_label": "1시간 30분",
            "last_elapsed_minutes": 30,
            "last_elapsed_label": "30분",
            "last_advanced_step_index": 2,
        },
        "pending_step_time_advance": {
            "step_index": 2,
            "elapsed_unit": "minute",
            "elapsed_amount": 30,
            "elapsed_minutes": 30,
            "elapsed_label": "30분",
            "total_elapsed_minutes": 90,
            "total_elapsed_label": "1시간 30분",
            "selection_reason": "짧은 공개 반응이 이어졌다.",
            "signals": ["직접 반응"],
        },
        "latest_step_activities": [
            {
                "activity_id": "a1",
                "action_summary": "공개 경고 action",
                "intent": "상대 반응을 끌어낸다.",
            }
        ],
        "latest_background_updates": [
            {
                "step_index": 2,
                "actor_id": "b",
                "summary": "배경 압력이 커진다.",
                "pressure_level": "medium",
                "future_hook": "다음 단계에서 직접 개입할 수 있다.",
            }
        ],
        "activities": [
            {
                "activity_id": "a1",
                "action_summary": "공개 경고 action",
                "intent": "상대 반응을 끌어낸다.",
            }
        ],
        "observer_reports": [{"summary": "직전 요약"}],
        "actor_intent_states": [],
        "intent_history": [],
        "world_state_summary": "이전 상태",
        "stagnation_steps": 0,
    }

    result = asyncio.run(observe_step(state, runtime))

    assert result["observer_reports"][-1]["summary"].startswith("직접 반영된 action")
    assert (
        result["world_state_summary"]
        == "직접 충돌은 좁지만 배경 압력은 조금씩 커지고 있다."
    )
    assert result["stagnation_steps"] == 0


def test_dispatch_selected_actor_proposals_sends_minimal_actor_task_payload() -> None:
    state = {
        "run_id": "run-1",
        "step_index": 2,
        "selected_actor_ids": ["a"],
        "step_focus_plan": {
            "focus_slices": [
                {
                    "slice_id": "focus-1",
                    "focus_actor_ids": ["a"],
                    "visibility": "private",
                    "title": "압박 축",
                    "stakes": "중요",
                    "selection_reason": "핵심 압력",
                }
            ]
        },
        "plan": {
            "situation": {
                "simulation_objective": "긴장 추적",
                "channel_guidance": {"public": "공개 신호", "private": "비공개 조율"},
                "current_constraints": ["시간 압박"],
            },
            "action_catalog": {
                "actions": [
                    {
                        "action_type": "speech",
                        "label": "직접 발화",
                        "description": "직접 말로 의도를 전달한다.",
                        "role_hints": ["A 역할"],
                        "group_hints": [],
                        "supported_visibility": ["public", "private", "group"],
                        "requires_target": False,
                        "supports_utterance": True,
                        "examples_or_usage_notes": [],
                    }
                ],
                "selection_guidance": ["발화는 액션 중 하나다."],
            },
            "progression_plan": {
                "max_steps": 4,
                "allowed_units": ["minute", "hour"],
                "default_unit": "hour",
                "pacing_guidance": ["대화는 30분~1시간으로 본다."],
                "selection_reason": "짧은 반응과 정리가 반복된다.",
            },
        },
        "actors": [
            {
                "actor_id": "a",
                "display_name": "A",
                "role": "A 역할",
                "group_name": None,
                "public_profile": "공개 성향",
                "private_goal": "긴장을 관리한다.",
                "speaking_style": "짧다",
                "avatar_seed": "a-seed",
                "baseline_attention_tier": "driver",
                "story_function": "주요 압박을 직접 밀어붙이는 축이다.",
                "preferred_action_types": ["speech"],
                "action_bias_notes": ["말로 먼저 방향을 튼다."],
            },
            {"actor_id": "b", "display_name": "B"},
        ],
        "activities": [
            {
                "activity_id": "a1",
                "visibility": "public",
                "visibility_scope": ["all"],
            },
            {
                "activity_id": "a2",
                "visibility": "private",
                "visibility_scope": ["a", "b"],
            },
        ],
        "activity_feeds": {
            "a": {"unseen_activity_ids": ["a2"], "seen_activity_ids": ["a1"]},
            "b": {"unseen_activity_ids": [], "seen_activity_ids": ["a1", "a2"]},
        },
        "observer_reports": [
            {
                "summary": "직전 요약",
                "momentum": "medium",
                "atmosphere": "긴장",
            }
        ],
        "actor_intent_states": [
            {
                "actor_id": "a",
                "current_intent": "긴장을 관리한다.",
                "target_actor_ids": ["b"],
                "supporting_action_type": "initial_state",
                "confidence": 0.5,
                "changed_from_previous": False,
            }
        ],
        "world_state_summary": "이전 상태 요약",
        "simulation_clock": {
            "total_elapsed_minutes": 60,
            "total_elapsed_label": "1시간",
            "last_elapsed_minutes": 60,
            "last_elapsed_label": "1시간",
            "last_advanced_step_index": 1,
        },
        "scenario": "이 값은 payload에 들어가면 안 된다.",
    }

    dispatched = dispatch_selected_actor_proposals(state)

    assert isinstance(dispatched, list)
    assert len(dispatched) == 1
    payload = dispatched[0].arg
    assert "scenario" not in payload
    assert "plan" not in payload
    assert "actors" not in payload
    actor_task = payload["actor_proposal_task"]
    assert actor_task["actor"]["actor_id"] == "a"
    assert actor_task["focus_slice"]["slice_id"] == "focus-1"
    assert actor_task["visible_action_context"][0]["activity_id"] == "a2"
    assert actor_task["visible_actors"][0]["actor_id"] == "b"


def test_prepare_focus_candidates_advances_step_and_builds_candidates() -> None:
    runtime = SimpleNamespace(
        context=SimpleNamespace(
            logger=logging.getLogger("simula.test.step"),
        )
    )
    state = {
        "actors": [
            {
                "actor_id": "a",
                "display_name": "A",
                "baseline_attention_tier": "lead",
                "story_function": "주요 압박 축",
            },
            {
                "actor_id": "b",
                "display_name": "B",
                "baseline_attention_tier": "support",
                "story_function": "보조 반응 축",
            },
        ],
        "activity_feeds": {
            "a": {"unseen_activity_ids": [], "seen_activity_ids": []},
            "b": {"unseen_activity_ids": ["act-1"], "seen_activity_ids": []},
        },
        "activities": [],
        "background_updates": [],
        "step_focus_history": [],
        "observer_reports": [],
        "actor_intent_states": [],
        "rng_seed": 7,
        "step_index": 0,
    }

    result = prepare_focus_candidates(state, runtime)

    assert result["step_index"] == 1
    assert result["focus_candidates"]
    assert result["focus_candidates"][0]["actor_id"] in {"a", "b"}


def test_generate_actor_proposal_logs_completion_event(caplog) -> None:
    class FakeRouter:
        async def ainvoke_structured_with_meta(
            self,
            role,
            prompt,
            schema,
            **kwargs,  # noqa: ANN003
        ):
            del role, prompt, schema, kwargs
            return (
                ActorActionProposal(
                    action_type="speech",
                    intent="영호와 먼저 연결 고리를 만든다.",
                    intent_target_actor_ids=["yeongho"],
                    action_summary="영호에게 먼저 말을 건다.",
                    action_detail="자기소개 직후 영호 쪽으로 자연스럽게 다가가 짧게 인사를 건넨다.",
                    utterance="안녕하세요. 먼저 인사드리고 싶었습니다.",
                    visibility="public",
                    target_actor_ids=[],
                    thread_id=None,
                ),
                SimpleNamespace(
                    forced_default=False,
                    duration_seconds=2.5,
                    parse_failure_count=0,
                ),
            )

    runtime = SimpleNamespace(
        context=SimpleNamespace(
            llms=FakeRouter(),
            logger=logging.getLogger("simula.test.step"),
            settings=SimpleNamespace(
                runtime=SimpleNamespace(max_recipients_per_message=2)
            ),
        )
    )
    state = {
        "step_index": 1,
        "actor_proposal_task": {
            "actor": {"actor_id": "yeongho", "display_name": "영호"},
            "focus_slice": {"slice_id": "focus-1"},
            "unread_activity_ids": [],
            "visible_action_context": [],
            "unread_backlog_digest": None,
            "visible_actors": [],
            "runtime_guidance": {
                "available_actions": [
                    {
                        "action_type": "speech",
                        "supported_visibility": ["public", "private", "group"],
                        "requires_target": False,
                        "supports_utterance": True,
                    }
                ],
                "current_intent_snapshot": {
                    "current_intent": "먼저 분위기를 푼다.",
                },
            },
        },
        "progression_plan": {
            "max_steps": 4,
            "allowed_units": ["minute", "hour"],
            "default_unit": "hour",
            "pacing_guidance": ["대화는 짧게 본다."],
            "selection_reason": "짧은 상호작용이 많다.",
        },
        "simulation_clock": {
            "total_elapsed_minutes": 0,
            "total_elapsed_label": "0분",
            "last_elapsed_minutes": 0,
            "last_elapsed_label": "0분",
            "last_advanced_step_index": 0,
        },
    }

    with caplog.at_level(logging.INFO, logger="simula.test.step"):
        result = asyncio.run(generate_actor_proposal(state, runtime))

    assert result["pending_actor_proposals"][0]["actor_id"] == "yeongho"
    assert "영호 action 정리 완료 | step 1 | speech | 공개 action" in caplog.text


def test_generate_actor_proposal_fallback_payload_stays_contract_safe() -> None:
    class FakeRouter:
        async def ainvoke_structured_with_meta(
            self,
            role,
            prompt,
            schema,
            **kwargs,  # noqa: ANN003
        ):
            del role, prompt
            assert schema is ActorActionProposal
            default_payload = kwargs["default_payload"]
            parsed = schema.model_validate(default_payload)
            assert parsed.visibility == "private"
            assert parsed.target_actor_ids == ["b"]
            return (
                parsed,
                SimpleNamespace(
                    forced_default=True,
                    duration_seconds=0.2,
                    parse_failure_count=1,
                ),
            )

    runtime = SimpleNamespace(
        context=SimpleNamespace(
            llms=FakeRouter(),
            logger=logging.getLogger("simula.test.step"),
            settings=SimpleNamespace(
                runtime=SimpleNamespace(max_recipients_per_message=2)
            ),
        )
    )
    state = {
        "step_index": 1,
        "actor_proposal_task": {
            "actor": {"actor_id": "a", "display_name": "A"},
            "focus_slice": {"slice_id": "focus-1", "focus_actor_ids": ["a", "b"]},
            "unread_activity_ids": [],
            "visible_action_context": [],
            "unread_backlog_digest": None,
            "visible_actors": [{"actor_id": "b", "display_name": "B"}],
            "runtime_guidance": {
                "available_actions": [
                    {
                        "action_type": "conduct_air_defense",
                        "supported_visibility": ["private", "group"],
                        "requires_target": False,
                        "supports_utterance": False,
                    }
                ],
                "current_intent_snapshot": {
                    "current_intent": "즉시 방공 태세를 상향한다.",
                    "target_actor_ids": [],
                },
            },
        },
        "progression_plan": {
            "max_steps": 4,
            "allowed_units": ["minute", "hour"],
            "default_unit": "hour",
            "pacing_guidance": ["대화는 짧게 본다."],
            "selection_reason": "짧은 상호작용이 많다.",
        },
        "simulation_clock": {
            "total_elapsed_minutes": 0,
            "total_elapsed_label": "0분",
            "last_elapsed_minutes": 0,
            "last_elapsed_label": "0분",
            "last_advanced_step_index": 0,
        },
    }

    result = asyncio.run(generate_actor_proposal(state, runtime))

    assert result["pending_actor_proposals"][0]["forced_idle"] is True
    assert result["pending_actor_proposals"][0]["proposal"] == {}


def test_build_step_focus_plan_sets_selected_actor_ids() -> None:
    class FakeCoordinatorRouter:
        async def ainvoke_structured_with_meta(
            self,
            role,
            prompt,
            schema,
            **kwargs,  # noqa: ANN003
        ):
            del role, prompt, kwargs
            assert schema is StepFocusPlan
            return (
                StepFocusPlan(
                    step_index=2,
                    focus_summary="직접 압박이 몰린 축을 우선 추적한다.",
                    selection_reason="직접 target 압력이 가장 높다.",
                    selected_actor_ids=["a", "b"],
                    deferred_actor_ids=["c"],
                    focus_slices=[
                        {
                            "slice_id": "focus-1",
                            "title": "압박 축",
                            "focus_actor_ids": ["a", "b"],
                            "visibility": "private",
                            "stakes": "즉시 반응이 필요하다.",
                            "selection_reason": "핵심 압박이 몰린 축이다.",
                        }
                    ],
                ),
                SimpleNamespace(duration_seconds=0.2, parse_failure_count=0),
            )

    runtime = SimpleNamespace(
        context=SimpleNamespace(
            llms=FakeCoordinatorRouter(),
            logger=logging.getLogger("simula.test.step"),
            settings=SimpleNamespace(
                runtime=SimpleNamespace(
                    max_focus_slices_per_step=3,
                    max_actor_calls_per_step=6,
                )
            ),
        )
    )
    state = {
        "step_index": 2,
        "focus_candidates": [
            {"actor_id": "a"},
            {"actor_id": "b"},
            {"actor_id": "c"},
        ],
        "plan": {
            "coordination_frame": {"focus_selection_rules": ["규칙"]},
            "situation": {"simulation_objective": "긴장 추적"},
            "action_catalog": {"actions": [], "selection_guidance": []},
        },
        "simulation_clock": {"total_elapsed_label": "1시간"},
        "observer_reports": [{"summary": "직전"}],
        "step_focus_history": [],
    }

    result = asyncio.run(build_step_focus_plan(state, runtime))

    assert result["selected_actor_ids"] == ["a", "b"]
    assert result["deferred_actor_ids"] == ["c"]
    assert result["step_focus_plan"]["focus_slices"][0]["slice_id"] == "focus-1"


def test_summarize_background_updates_collects_updates() -> None:
    class FakeCoordinatorRouter:
        async def ainvoke_structured_with_meta(
            self,
            role,
            prompt,
            schema,
            **kwargs,  # noqa: ANN003
        ):
            del role, prompt, kwargs
            assert schema is BackgroundUpdateBatch
            return (
                BackgroundUpdateBatch(
                    background_updates=[
                        {
                            "step_index": 2,
                            "actor_id": "c",
                            "summary": "배경에서 압력이 조금씩 커지고 있다.",
                            "pressure_level": "medium",
                            "future_hook": "다음 단계에서 직접 개입할 수 있다.",
                        }
                    ]
                ),
                SimpleNamespace(duration_seconds=0.1, parse_failure_count=0),
            )

    runtime = SimpleNamespace(
        context=SimpleNamespace(
            llms=FakeCoordinatorRouter(),
            logger=logging.getLogger("simula.test.step"),
        )
    )
    state = {
        "step_index": 2,
        "actors": [{"actor_id": "c", "display_name": "C"}],
        "deferred_actor_ids": ["c"],
        "selected_actor_ids": ["a", "b"],
        "activities": [],
        "actor_intent_states": [],
        "world_state_summary": "기존 상태",
        "plan": {"coordination_frame": {"background_motion_rules": ["규칙"]}},
        "background_updates": [],
    }

    result = asyncio.run(summarize_background_updates(state, runtime))

    assert result["latest_background_updates"][0]["actor_id"] == "c"
    assert result["background_updates"][0]["pressure_level"] == "medium"


def test_summarize_background_updates_overrides_step_index_with_current_step() -> None:
    class FakeCoordinatorRouter:
        async def ainvoke_structured_with_meta(
            self,
            role,
            prompt,
            schema,
            **kwargs,  # noqa: ANN003
        ):
            del role, prompt, kwargs
            assert schema is BackgroundUpdateBatch
            return (
                BackgroundUpdateBatch(
                    background_updates=[
                        {
                            "step_index": 1,
                            "actor_id": "c",
                            "summary": "배경 준비가 이어진다.",
                            "pressure_level": "low",
                            "future_hook": "다음 단계 선택을 늦출 수 있다.",
                        }
                    ]
                ),
                SimpleNamespace(duration_seconds=0.1, parse_failure_count=0),
            )

    runtime = SimpleNamespace(
        context=SimpleNamespace(
            llms=FakeCoordinatorRouter(),
            logger=logging.getLogger("simula.test.step"),
        )
    )
    state = {
        "step_index": 3,
        "actors": [{"actor_id": "c", "display_name": "C"}],
        "deferred_actor_ids": ["c"],
        "selected_actor_ids": [],
        "activities": [],
        "actor_intent_states": [],
        "world_state_summary": "기존 상태",
        "plan": {"coordination_frame": {"background_motion_rules": ["규칙"]}},
        "background_updates": [],
    }

    result = asyncio.run(summarize_background_updates(state, runtime))

    assert result["latest_background_updates"][0]["step_index"] == 3


def test_adjudicate_step_focus_adopts_selected_actions_and_updates_clock() -> None:
    class FakeCoordinatorRouter:
        async def ainvoke_structured_with_meta(
            self,
            role,
            prompt,
            schema,
            **kwargs,  # noqa: ANN003
        ):
            del role, prompt, kwargs
            assert schema is StepAdjudication
            return (
                StepAdjudication(
                    adopted_actor_ids=["a"],
                    rejected_action_notes=[
                        "b의 proposal은 이번 단계 focus와 거리가 있다."
                    ],
                    updated_intent_states=[
                        {
                            "actor_id": "a",
                            "current_intent": "b를 압박해 즉시 반응을 끌어낸다.",
                            "target_actor_ids": ["b"],
                            "supporting_action_type": "speech",
                            "confidence": 0.8,
                            "changed_from_previous": True,
                        },
                        {
                            "actor_id": "b",
                            "current_intent": "상황을 더 본다.",
                            "target_actor_ids": [],
                            "supporting_action_type": "initial_state",
                            "confidence": 0.5,
                            "changed_from_previous": False,
                        },
                    ],
                    step_time_advance={
                        "elapsed_unit": "minute",
                        "elapsed_amount": 30,
                        "selection_reason": "짧은 압박과 즉시 반응이 중심이다.",
                        "signals": ["직접 압박"],
                    },
                    background_updates=[],
                    event_action=None,
                    world_state_summary_hint="직접 압박 축은 좁게 유지되지만 반응 압력은 커졌다.",
                ),
                SimpleNamespace(duration_seconds=0.2, parse_failure_count=0),
            )

    runtime = SimpleNamespace(
        context=SimpleNamespace(
            llms=FakeCoordinatorRouter(),
            logger=logging.getLogger("simula.test.step"),
            settings=SimpleNamespace(
                runtime=SimpleNamespace(max_recipients_per_message=2)
            ),
        )
    )
    state = {
        "run_id": "run-1",
        "step_index": 2,
        "actors": [
            {"actor_id": "a", "private_goal": "압박한다."},
            {"actor_id": "b", "private_goal": "관망한다."},
        ],
        "activity_feeds": initialize_activity_feeds(
            [{"actor_id": "a"}, {"actor_id": "b"}]
        ),
        "activities": [],
        "pending_actor_proposals": [
            {
                "actor_id": "a",
                "unread_activity_ids": [],
                "proposal": {
                    "action_type": "speech",
                    "intent": "b를 압박해 즉시 반응을 끌어낸다.",
                    "intent_target_actor_ids": ["b"],
                    "action_summary": "a가 압박 action을 보낸다.",
                    "action_detail": "즉시 반응을 요구한다.",
                    "utterance": "지금 답해야 한다.",
                    "visibility": "private",
                    "target_actor_ids": ["b"],
                    "thread_id": "warning",
                },
                "forced_idle": False,
                "parse_failure_count": 0,
                "latency_seconds": 0.01,
            },
            {
                "actor_id": "b",
                "unread_activity_ids": [],
                "proposal": {
                    "action_type": "speech",
                    "intent": "일단 시간을 번다.",
                    "intent_target_actor_ids": ["a"],
                    "action_summary": "b가 유보 action을 보낸다.",
                    "action_detail": "답을 미룬다.",
                    "utterance": "조금 더 보자.",
                    "visibility": "private",
                    "target_actor_ids": ["a"],
                    "thread_id": "warning",
                },
                "forced_idle": False,
                "parse_failure_count": 0,
                "latency_seconds": 0.01,
            },
        ],
        "actor_intent_states": [
            {
                "actor_id": "a",
                "current_intent": "압박한다.",
                "target_actor_ids": [],
                "supporting_action_type": "initial_state",
                "confidence": 0.5,
                "changed_from_previous": False,
            },
            {
                "actor_id": "b",
                "current_intent": "관망한다.",
                "target_actor_ids": [],
                "supporting_action_type": "initial_state",
                "confidence": 0.5,
                "changed_from_previous": False,
            },
        ],
        "latest_background_updates": [],
        "step_focus_plan": {"selected_actor_ids": ["a", "b"]},
        "simulation_clock": {
            "total_elapsed_minutes": 60,
            "total_elapsed_label": "1시간",
            "last_elapsed_minutes": 60,
            "last_elapsed_label": "1시간",
            "last_advanced_step_index": 1,
        },
        "step_time_history": [],
        "intent_history": [],
        "world_state_summary": "기존 상태",
        "plan": {
            "progression_plan": {
                "max_steps": 4,
                "allowed_units": ["minute", "hour"],
                "default_unit": "hour",
                "pacing_guidance": ["대화는 짧게 본다."],
                "selection_reason": "짧은 상호작용이 많다.",
            },
            "action_catalog": {
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
        },
        "current_step_started_at": 0.0,
        "parse_failures": 0,
        "forced_idles": 0,
    }

    result = asyncio.run(adjudicate_step_focus(state, runtime))

    assert len(result["latest_step_activities"]) == 1
    assert result["latest_step_activities"][0]["source_actor_id"] == "a"
    assert result["simulation_clock"]["total_elapsed_minutes"] == 90


def test_decide_runtime_progression_updates_state(caplog) -> None:
    from simula.application.workflow.graphs.planning.nodes.planner import (
        decide_runtime_progression,
    )

    runtime = SimpleNamespace(
        context=SimpleNamespace(
            llms=FakePlannerLLM(),
            logger=logging.getLogger("simula.test.step"),
        )
    )
    state = {
        "scenario": "테스트 시나리오",
        "pending_scenario_brief": {
            "summary": "공개 신호와 비공개 계산이 함께 움직이는 다자 위기다.",
            "key_entities": ["핵심 의사결정자"],
            "explicit_time_signals": ["초기 충돌 직후"],
            "public_facts": ["공개 신호가 중요하다."],
            "private_dynamics": ["비공개 계산이 실제 선택을 바꾼다."],
            "terminal_conditions": ["최종 결심까지 본다."],
        },
        "pending_interpretation_core": "공개 신호와 비공개 계산이 엇갈린다.",
        "max_steps": 4,
        "planning_latency_seconds": 0.0,
    }

    with caplog.at_level(logging.INFO, logger="simula.test.step"):
        result = asyncio.run(decide_runtime_progression(state, runtime))

    assert result["progression_plan"]["default_unit"] == "hour"
    assert result["progression_plan"]["allowed_units"] == ["minute", "hour", "day"]
    assert result["progression_plan"]["max_steps"] == 4
    assert "시간 진행 계획 결정 완료" in caplog.text


def test_action_catalog_rejects_more_than_five_actions() -> None:
    with pytest.raises(ValueError, match="최대 5개 action만 허용"):
        ActionCatalog(
            actions=[
                {
                    "action_type": f"action-{index}",
                    "label": f"액션 {index}",
                    "description": "설명",
                    "role_hints": [],
                    "group_hints": [],
                    "supported_visibility": ["public"],
                    "requires_target": False,
                    "supports_utterance": False,
                    "examples_or_usage_notes": [],
                }
                for index in range(6)
            ],
            selection_guidance=[],
        )


def test_normalize_step_time_advance_accepts_unit_and_amount_aliases() -> None:
    normalized = _normalize_step_time_advance_payload(
        {
            "unit": "hour",
            "amount": 1,
            "selection_reason": "짧은 대응 이후 바로 한 시간 안에서 정리된다.",
            "signals": [],
        }
    )

    assert normalized["elapsed_unit"] == "hour"
    assert normalized["elapsed_amount"] == 1
