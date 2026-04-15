"""Purpose:
- Verify the compact round coordination nodes.
"""

from __future__ import annotations

import asyncio
import logging
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from simula.application.workflow.graphs.coordinator.nodes.assess_round_continuation import (
    assess_round_continuation,
)
from simula.application.workflow.graphs.coordinator.nodes.build_round_directive import (
    build_round_directive,
)
from simula.application.workflow.graphs.coordinator.nodes.prepare_focus_candidates import (
    prepare_focus_candidates,
)
from simula.application.workflow.graphs.coordinator.nodes.resolve_round import (
    resolve_round,
)
from simula.application.workflow.graphs.runtime.nodes.lifecycle import (
    initialize_runtime_state,
)
from simula.application.workflow.graphs.runtime.states.state import (
    empty_actor_proposal_task,
)
from simula.domain.activity_feeds import initialize_activity_feeds
from simula.domain.contracts import (
    RoundContinuationDecision,
    RoundDirective,
    RoundResolution,
)
from simula.domain.event_memory import build_event_memory, evaluate_round_event_updates


def _test_context(**kwargs: object) -> SimpleNamespace:
    return SimpleNamespace(run_jsonl_appender=None, **kwargs)


def test_prepare_focus_candidates_advances_round_and_builds_candidates() -> None:
    runtime = SimpleNamespace(
        context=_test_context(logger=logging.getLogger("simula.test.round"))
    )
    state = {
        "actors": [
            {
                "cast_id": "a",
                "display_name": "A",
                "baseline_attention_tier": "lead",
                "story_function": "주요 압박 축",
            },
            {
                "cast_id": "b",
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
        "round_focus_history": [],
        "observer_reports": [],
        "actor_intent_states": [],
        "rng_seed": 7,
        "round_index": 0,
    }

    result = prepare_focus_candidates(state, runtime)

    assert result["round_index"] == 1
    assert result["focus_candidates"]
    assert result["actor_proposal_task"] == empty_actor_proposal_task()


def test_prepare_focus_candidates_prioritizes_due_required_event_participants() -> None:
    runtime = SimpleNamespace(
        context=_test_context(logger=logging.getLogger("simula.test.round"))
    )
    state = {
        "actors": [
            {
                "cast_id": "a",
                "display_name": "A",
                "baseline_attention_tier": "support",
                "story_function": "관망 축",
            },
            {
                "cast_id": "b",
                "display_name": "B",
                "baseline_attention_tier": "support",
                "story_function": "이벤트 축",
            },
        ],
        "activity_feeds": {
            "a": {"unseen_activity_ids": [], "seen_activity_ids": []},
            "b": {"unseen_activity_ids": [], "seen_activity_ids": []},
        },
        "activities": [],
        "background_updates": [],
        "event_memory": build_event_memory(
            [
                {
                    "event_id": "mid_choice",
                    "title": "중간 선택",
                    "summary": "B가 이번 단계의 선택 압력을 직접 받는다.",
                    "participant_cast_ids": ["b"],
                    "earliest_round": 1,
                    "latest_round": 2,
                    "completion_action_types": ["speech"],
                    "completion_signals": ["선택"],
                    "required_before_end": True,
                }
            ]
        ),
        "round_focus_history": [],
        "observer_reports": [],
        "actor_intent_states": [],
        "rng_seed": 7,
        "round_index": 0,
    }

    result = prepare_focus_candidates(state, runtime)

    assert result["focus_candidates"][0]["cast_id"] == "b"
    assert any(
        "required due event" in reason
        for reason in result["focus_candidates"][0]["selection_reasons"]
    )


def test_round_continuation_decision_rejects_simulation_done() -> None:
    with pytest.raises(ValidationError):
        RoundContinuationDecision(stop_reason="simulation_done")


def test_round_resolution_rejects_no_progress() -> None:
    with pytest.raises(ValidationError):
        RoundResolution(
            adopted_cast_ids=[],
            updated_intent_states=[],
            event_updates=[],
            round_time_advance={
                "elapsed_unit": "hour",
                "elapsed_amount": 1,
                "selection_reason": "기본 진행",
                "signals": [],
            },
            observer_report={
                "round_index": 1,
                "summary": "요약",
                "notable_events": [],
                "atmosphere": "긴장",
                "momentum": "medium",
                "world_state_summary": "상태",
            },
            actor_facing_scenario_digest={
                "round_index": 1,
                "relationship_map_summary": "관계",
                "current_pressures": ["압력"],
                "talking_points": ["포인트"],
                "avoid_repetition_notes": ["반복 금지"],
                "recommended_tone": "톤",
                "world_state_summary": "상태",
            },
            world_state_summary="상태",
            stop_reason="no_progress",
        )


def test_assess_round_continuation_skips_llm_on_first_entry() -> None:
    class FailRouter:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            raise AssertionError("LLM should not be called on the first runtime entry")

    runtime = SimpleNamespace(
        context=_test_context(
            llms=FailRouter(),
            logger=logging.getLogger("simula.test.round"),
        )
    )
    state = {
        "round_index": 0,
        "max_rounds": 4,
        "stagnation_rounds": 0,
        "simulation_clock": {"total_elapsed_label": "0분"},
        "world_state_summary": "",
        "observer_reports": [],
        "latest_round_activities": [],
        "round_focus_history": [],
        "errors": [],
    }

    result = asyncio.run(assess_round_continuation(state, runtime))

    assert result["stop_requested"] is False
    assert result["stop_reason"] == ""


def test_initialize_runtime_state_preserves_run_level_error_counters() -> None:
    state = {
        "actors": [
            {
                "cast_id": "a",
                "display_name": "A",
            },
            {
                "cast_id": "b",
                "display_name": "B",
            },
        ],
        "plan": {
            "major_events": [],
            "coordination_frame": {},
            "situation": {},
        },
        "errors": ["generation warning"],
        "parse_failures": 2,
        "forced_idles": 1,
    }

    result = initialize_runtime_state(state)

    assert result["errors"] == ["generation warning"]
    assert result["parse_failures"] == 2
    assert result["forced_idles"] == 1
    assert result["actor_proposal_task"] == empty_actor_proposal_task()


def test_assess_round_continuation_stops_on_max_rounds_without_llm() -> None:
    class FailRouter:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            raise AssertionError("LLM should not be called when max_rounds is reached")

    runtime = SimpleNamespace(
        context=_test_context(
            llms=FailRouter(),
            logger=logging.getLogger("simula.test.round"),
        )
    )
    state = {
        "round_index": 4,
        "max_rounds": 4,
        "stagnation_rounds": 2,
        "simulation_clock": {"total_elapsed_label": "2시간"},
        "world_state_summary": "현재 상태",
        "observer_reports": [],
        "latest_round_activities": [],
        "round_focus_history": [],
        "errors": [],
    }

    result = asyncio.run(assess_round_continuation(state, runtime))

    assert result["stop_requested"] is True
    assert result["stop_reason"] == "simulation_done"
    assert result["event_memory_history"][0]["source"] == "continuation_hard_stop"


def test_assess_round_continuation_keeps_running_when_required_event_remains() -> None:
    class FailRouter:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            raise AssertionError("LLM should not be called when required events force continuation")

    runtime = SimpleNamespace(
        context=_test_context(
            llms=FailRouter(),
            logger=logging.getLogger("simula.test.round"),
        )
    )
    state = {
        "round_index": 2,
        "max_rounds": 5,
        "planned_max_rounds": 2,
        "stagnation_rounds": 1,
        "simulation_clock": {"total_elapsed_label": "2시간"},
        "world_state_summary": "현재 상태",
        "observer_reports": [],
        "latest_round_activities": [],
        "round_focus_history": [],
        "event_memory": build_event_memory(
            [
                {
                    "event_id": "final_choice",
                    "title": "최종 선택",
                    "summary": "아직 최종 선택이 발생하지 않았다.",
                    "participant_cast_ids": ["a", "b"],
                    "earliest_round": 2,
                    "latest_round": 2,
                    "completion_action_types": ["speech"],
                    "completion_signals": ["최종 선택"],
                    "required_before_end": True,
                }
            ]
        ),
        "errors": [],
    }

    result = asyncio.run(assess_round_continuation(state, runtime))

    assert result["stop_requested"] is False
    assert result["stop_reason"] == ""


def test_assess_round_continuation_returns_no_progress_from_coordinator() -> None:
    class FakeRouter:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del role, prompt, kwargs
            return (
                schema.model_validate(
                    RoundContinuationDecision(stop_reason="no_progress")
                ),
                SimpleNamespace(
                    duration_seconds=0.2,
                    parse_failure_count=0,
                    forced_default=False,
                ),
            )

    runtime = SimpleNamespace(
        context=_test_context(
            llms=FakeRouter(),
            logger=logging.getLogger("simula.test.round"),
        )
    )
    state = {
        "round_index": 2,
        "max_rounds": 5,
        "stagnation_rounds": 3,
        "simulation_clock": {"total_elapsed_label": "2시간"},
        "world_state_summary": "현재 상태",
        "observer_reports": [
            {
                "round_index": 2,
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
                "round_index": 2,
                "focus_summary": "동일한 갈등 축을 반복 추적했다.",
                "selection_reason": "압력이 유지됐다.",
                "selected_cast_ids": ["a"],
                "deferred_cast_ids": ["b"],
            }
        ],
        "errors": [],
    }

    result = asyncio.run(assess_round_continuation(state, runtime))

    assert result["stop_requested"] is True
    assert result["stop_reason"] == "no_progress"


def test_assess_round_continuation_stops_for_stale_required_event_after_planned_max() -> None:
    class FailRouter:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            raise AssertionError("LLM should not be called when stale required events stop the run")

    runtime = SimpleNamespace(
        context=_test_context(
            llms=FailRouter(),
            logger=logging.getLogger("simula.test.round"),
        )
    )
    state = {
        "run_id": "run-1",
        "round_index": 3,
        "max_rounds": 5,
        "planned_max_rounds": 3,
        "stagnation_rounds": 2,
        "simulation_clock": {"total_elapsed_label": "3시간"},
        "world_state_summary": "현재 상태",
        "observer_reports": [],
        "latest_round_activities": [],
        "round_focus_history": [],
        "event_memory": build_event_memory(
            [
                {
                    "event_id": "final_choice",
                    "title": "최종 선택",
                    "summary": "마지막 선택을 정리해야 한다.",
                    "participant_cast_ids": ["a", "b"],
                    "earliest_round": 2,
                    "latest_round": 2,
                    "completion_action_types": ["speech"],
                    "completion_signals": ["최종 선택"],
                    "required_before_end": True,
                }
            ]
        ),
        "errors": [],
        "event_memory_history": [],
    }

    result = asyncio.run(assess_round_continuation(state, runtime))

    assert result["stop_requested"] is True
    assert result["stop_reason"] == "no_progress"
    assert result["event_memory"]["events"][0]["status"] == "missed"
    assert result["event_memory_history"][0]["source"] == "continuation_stale_required_stop"


def test_build_round_directive_sets_selected_cast_ids() -> None:
    class FakeRouter:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del role, prompt, kwargs
            return (
                schema.model_validate(
                    RoundDirective(
                        round_index=2,
                        focus_summary="직접 압박 축을 우선 추적한다.",
                        selection_reason="직접 반응 압력이 가장 높다.",
                        selected_cast_ids=["a", "b"],
                        deferred_cast_ids=["c"],
                        focus_slices=[
                            {
                                "slice_id": "focus-1",
                                "title": "압박 축",
                                "focus_cast_ids": ["a", "b"],
                                "visibility": "private",
                                "stakes": "즉시 반응이 필요하다.",
                                "selection_reason": "핵심 압박이 몰렸다.",
                            }
                        ],
                        background_updates=[
                            {
                                "round_index": 2,
                                "cast_id": "c",
                                "summary": "배경 압력이 유지된다.",
                                "pressure_level": "medium",
                                "future_hook": "다음 round에서 직접 개입할 수 있다.",
                            }
                        ],
                    )
                ),
                SimpleNamespace(duration_seconds=0.2, parse_failure_count=0, forced_default=False),
            )

    runtime = SimpleNamespace(
        context=_test_context(
            llms=FakeRouter(),
            logger=logging.getLogger("simula.test.round"),
            settings=SimpleNamespace(
                runtime=SimpleNamespace(
                    max_focus_slices_per_step=3,
                    max_actor_calls_per_step=6,
                )
            ),
        )
    )
    state = {
        "run_id": "run-1",
        "round_index": 2,
        "actors": [{"cast_id": "c", "display_name": "C"}],
        "focus_candidates": [{"cast_id": "a"}, {"cast_id": "b"}, {"cast_id": "c"}],
        "plan": {
            "coordination_frame": {"focus_selection_rules": ["규칙"]},
            "situation": {"simulation_objective": "긴장 추적"},
        },
        "simulation_clock": {"total_elapsed_label": "1시간"},
        "observer_reports": [{"summary": "직전"}],
        "round_focus_history": [],
        "background_updates": [],
        "errors": [],
    }

    result = asyncio.run(build_round_directive(state, runtime))

    assert result["selected_cast_ids"] == ["a", "b"]
    assert result["latest_background_updates"][0]["cast_id"] == "c"


def test_build_round_directive_injects_stagnation_background_hook() -> None:
    class FakeRouter:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del role, prompt, kwargs
            return (
                schema.model_validate(
                    RoundDirective(
                        round_index=3,
                        focus_summary="핵심 축을 직접 추적한다.",
                        selection_reason="직접 반응 압력이 높다.",
                        selected_cast_ids=["a", "b"],
                        deferred_cast_ids=["c"],
                        focus_slices=[
                            {
                                "slice_id": "focus-1",
                                "title": "핵심 축",
                                "focus_cast_ids": ["a", "b"],
                                "visibility": "public",
                                "stakes": "즉시 반응이 필요하다.",
                                "selection_reason": "핵심 압력이 몰렸다.",
                            }
                        ],
                        background_updates=[],
                    )
                ),
                SimpleNamespace(duration_seconds=0.2, parse_failure_count=0, forced_default=False),
            )

    runtime = SimpleNamespace(
        context=_test_context(
            llms=FakeRouter(),
            logger=logging.getLogger("simula.test.round"),
            settings=SimpleNamespace(
                runtime=SimpleNamespace(
                    max_focus_slices_per_step=3,
                    max_actor_calls_per_step=2,
                )
            ),
        )
    )
    state = {
        "run_id": "run-1",
        "round_index": 3,
        "stagnation_rounds": 2,
        "actors": [
            {"cast_id": "a", "display_name": "A"},
            {"cast_id": "b", "display_name": "B"},
            {"cast_id": "c", "display_name": "C", "story_function": "후반 흔들 변수"},
        ],
        "focus_candidates": [
            {"cast_id": "a", "candidate_score": 6.0},
            {"cast_id": "b", "candidate_score": 5.0},
            {"cast_id": "c", "candidate_score": 4.0},
        ],
        "plan": {
            "coordination_frame": {"focus_selection_rules": ["규칙"]},
            "situation": {
                "simulation_objective": "긴장 추적",
                "initial_tensions": ["압력"],
                "current_constraints": ["같은 선언 반복 금지"],
                "channel_guidance": {"public": "공개 대화"},
            },
        },
        "simulation_clock": {"total_elapsed_label": "3시간"},
        "event_memory": build_event_memory(
            [
                {
                    "event_id": "final_choice",
                    "title": "최종 선택",
                    "summary": "마지막 선택 압력이 남아 있다.",
                    "participant_cast_ids": ["a", "b", "c"],
                    "earliest_round": 2,
                    "latest_round": 3,
                    "completion_action_types": ["speech"],
                    "completion_signals": ["최종 선택"],
                    "required_before_end": True,
                }
            ]
        ),
        "observer_reports": [{"summary": "반복이 이어졌다."}],
        "round_focus_history": [],
        "background_updates": [],
        "errors": [],
    }

    result = asyncio.run(build_round_directive(state, runtime))

    assert result["latest_background_updates"]
    assert result["latest_background_updates"][0]["cast_id"] == "c"
    assert result["latest_background_updates"][0]["pressure_level"] == "high"


def test_build_round_directive_backfills_more_related_casts_when_pool_is_rich() -> None:
    class FakeRouter:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del role, prompt, kwargs
            return (
                schema.model_validate(
                    RoundDirective(
                        round_index=3,
                        focus_summary="핵심 갈등 축을 우선 추적한다.",
                        selection_reason="직접 반응 압력이 가장 높다.",
                        selected_cast_ids=["a", "b"],
                        deferred_cast_ids=["c", "d", "e"],
                        focus_slices=[
                            {
                                "slice_id": "focus-1",
                                "title": "핵심 갈등",
                                "focus_cast_ids": ["a", "b"],
                                "visibility": "public",
                                "stakes": "즉시 반응이 필요하다.",
                                "selection_reason": "핵심 압박이 몰렸다.",
                            }
                        ],
                        background_updates=[],
                    )
                ),
                SimpleNamespace(duration_seconds=0.2, parse_failure_count=0, forced_default=False),
            )

    runtime = SimpleNamespace(
        context=_test_context(
            llms=FakeRouter(),
            logger=logging.getLogger("simula.test.round"),
            settings=SimpleNamespace(
                runtime=SimpleNamespace(
                    max_focus_slices_per_step=3,
                    max_actor_calls_per_step=6,
                )
            ),
        )
    )
    state = {
        "run_id": "run-1",
        "round_index": 3,
        "actors": [{"cast_id": cast_id, "display_name": cast_id.upper()} for cast_id in ["a", "b", "c", "d", "e"]],
        "focus_candidates": [{"cast_id": cast_id} for cast_id in ["a", "b", "c", "d", "e"]],
        "plan": {
            "coordination_frame": {"focus_selection_rules": ["규칙"]},
            "situation": {"simulation_objective": "긴장 추적"},
        },
        "simulation_clock": {"total_elapsed_label": "2시간"},
        "observer_reports": [{"summary": "직전"}],
        "round_focus_history": [],
        "background_updates": [],
        "errors": [],
    }

    result = asyncio.run(build_round_directive(state, runtime))

    assert result["selected_cast_ids"] == ["a", "b", "c"]
    assert any(
        item.get("title") == "주변 반응 확대"
        for item in result["round_focus_plan"]["focus_slices"]
    )


def test_resolve_round_persists_round_artifacts() -> None:
    class FakeRouter:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del role, prompt, kwargs
            return (
                RoundResolution(
                    adopted_cast_ids=["a"],
                    updated_intent_states=[
                        {
                            "cast_id": "a",
                            "current_intent": "b를 압박한다.",
                            "thought": "지금 압박해야 다음 선택 주도권을 잡을 수 있다고 본다.",
                            "target_cast_ids": ["b"],
                            "supporting_action_type": "speech",
                            "confidence": 0.8,
                            "changed_from_previous": True,
                        },
                        {
                            "cast_id": "b",
                            "current_intent": "상황을 더 본다.",
                            "thought": "바로 답하면 밀릴 수 있어 한 번 더 상황을 읽으려 한다.",
                            "target_cast_ids": [],
                            "supporting_action_type": "initial_state",
                            "confidence": 0.5,
                            "changed_from_previous": False,
                        },
                    ],
                    event_updates=[],
                    round_time_advance={
                        "elapsed_unit": "minute",
                        "elapsed_amount": 30,
                        "selection_reason": "짧은 압박과 즉시 반응이 중심이다.",
                        "signals": ["직접 압박"],
                    },
                    observer_report={
                        "round_index": 2,
                        "summary": "직접 action이 먼저 쌓이며 다음 선택 압력이 커졌다.",
                        "notable_events": ["a가 압박 action을 보냈다."],
                        "atmosphere": "긴장",
                        "momentum": "medium",
                        "world_state_summary": "직접 압박 축은 좁게 유지되지만 반응 압력은 커졌다.",
                    },
                    actor_facing_scenario_digest={
                        "round_index": 2,
                        "relationship_map_summary": "a의 직접 압박과 b의 신중한 후퇴가 대비된다.",
                        "current_pressures": ["a는 지금 주도권을 굳히고 싶다."],
                        "talking_points": ["다음 대화에서는 답을 미루지 못하게 더 분명히 압박한다."],
                        "avoid_repetition_notes": ["막연한 호감 표현만 반복하지 않는다."],
                        "recommended_tone": "짧고 분명한 압박 톤",
                        "world_state_summary": "직접 압박 축은 좁게 유지되지만 반응 압력은 커졌다.",
                    },
                    world_state_summary="직접 압박 축은 좁게 유지되지만 반응 압력은 커졌다.",
                    stop_reason="",
                ),
                SimpleNamespace(duration_seconds=0.2, parse_failure_count=0, forced_default=False),
            )

    saved: dict[str, object] = {}

    def _save_round_artifacts(run_id, activities, observer_report):  # noqa: ANN001
        saved["run_id"] = run_id
        saved["activities"] = activities
        saved["observer_report"] = observer_report

    runtime = SimpleNamespace(
        context=_test_context(
            llms=FakeRouter(),
            logger=logging.getLogger("simula.test.round"),
            settings=SimpleNamespace(
                runtime=SimpleNamespace(max_recipients_per_message=2)
            ),
            store=SimpleNamespace(save_round_artifacts=_save_round_artifacts),
        )
    )
    state = {
        "run_id": "run-1",
        "round_index": 2,
        "max_rounds": 4,
        "actors": [
            {"cast_id": "a", "private_goal": "압박한다."},
            {"cast_id": "b", "private_goal": "관망한다."},
        ],
        "activity_feeds": initialize_activity_feeds([{"cast_id": "a"}, {"cast_id": "b"}]),
        "activities": [],
        "latest_round_activities": [],
        "round_focus_plan": {"selected_cast_ids": ["a"]},
        "latest_background_updates": [],
        "selected_cast_ids": ["a"],
        "actor_intent_states": [],
        "actor_facing_scenario_digest": {},
        "world_state_summary": "기존 상태",
        "plan": {
            "progression_plan": {
                "max_rounds": 4,
                "allowed_elapsed_units": ["minute", "hour"],
                "default_elapsed_unit": "hour",
                "pacing_guidance": ["짧게 본다."],
                "selection_reason": "짧은 상호작용 중심",
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
        "pending_actor_proposals": [
            {
                "cast_id": "a",
                "unread_activity_ids": [],
                "proposal": {
                    "action_type": "speech",
                    "intent": "b를 압박해 즉시 반응을 끌어낸다.",
                    "intent_target_cast_ids": ["b"],
                    "action_summary": "a가 압박 action을 보낸다.",
                    "action_detail": "즉시 반응을 요구한다.",
                    "utterance": "지금 답해야 한다.",
                    "visibility": "private",
                    "target_cast_ids": ["b"],
                    "thread_id": "warning",
                },
                "forced_idle": False,
                "parse_failure_count": 0,
                "latency_seconds": 0.01,
            }
        ],
        "simulation_clock": {
            "total_elapsed_minutes": 0,
            "total_elapsed_label": "0분",
            "last_elapsed_minutes": 0,
            "last_elapsed_label": "0분",
            "last_advanced_round_index": 0,
        },
        "observer_reports": [],
        "round_time_history": [],
        "intent_history": [],
        "forced_idles": 0,
        "parse_failures": 0,
        "stagnation_rounds": 0,
        "stop_requested": False,
        "stop_reason": "",
        "current_round_started_at": 0.0,
        "errors": [],
    }

    result = asyncio.run(resolve_round(state, runtime))

    assert saved["run_id"] == "run-1"
    assert result["observer_reports"][0]["round_index"] == 2
    assert result["event_memory_history"][0]["source"] == "resolve_round"


def test_resolve_round_merges_partial_intent_updates_and_preserves_full_roster() -> None:
    class FakeRouter:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del role, prompt, kwargs
            return (
                RoundResolution(
                    adopted_cast_ids=["a"],
                    updated_intent_states=[
                        {
                            "cast_id": "a",
                            "current_intent": "b를 다시 압박한다.",
                            "thought": "지금 한 번 더 밀어야 흐름을 닫을 수 있다고 본다.",
                            "target_cast_ids": ["b"],
                            "supporting_action_type": "speech",
                            "confidence": 0.85,
                            "changed_from_previous": True,
                        }
                    ],
                    event_updates=[],
                    round_time_advance={
                        "elapsed_unit": "minute",
                        "elapsed_amount": 20,
                        "selection_reason": "짧은 재압박과 반응 대기만 진행됐다.",
                        "signals": ["직접 압박"],
                    },
                    observer_report={
                        "round_index": 2,
                        "summary": "a의 직접 압박만 갱신되고 나머지 관계는 기존 흐름을 유지했다.",
                        "notable_events": ["a가 b를 다시 압박했다."],
                        "atmosphere": "긴장",
                        "momentum": "medium",
                        "world_state_summary": "핵심 압박선만 더 또렷해지고 다른 축은 유지된다.",
                    },
                    actor_facing_scenario_digest={
                        "round_index": 2,
                        "relationship_map_summary": "a의 압박은 강해지고 b와 c는 기존 입장을 유지한다.",
                        "current_pressures": ["지금은 a의 직접 압박이 가장 큰 변수다."],
                        "talking_points": ["같은 질문이라도 더 분명한 선택 압력으로 바꾼다."],
                        "avoid_repetition_notes": ["같은 말만 되풀이하지 않는다."],
                        "recommended_tone": "짧고 분명한 압박 톤",
                        "world_state_summary": "핵심 압박선만 더 또렷해지고 다른 축은 유지된다.",
                    },
                    world_state_summary="핵심 압박선만 더 또렷해지고 다른 축은 유지된다.",
                    stop_reason="",
                ),
                SimpleNamespace(
                    duration_seconds=0.2,
                    parse_failure_count=0,
                    forced_default=False,
                ),
            )

    runtime = SimpleNamespace(
        context=_test_context(
            llms=FakeRouter(),
            logger=logging.getLogger("simula.test.round"),
            settings=SimpleNamespace(
                runtime=SimpleNamespace(max_recipients_per_message=2)
            ),
            store=SimpleNamespace(save_round_artifacts=lambda *args, **kwargs: None),
        )
    )
    state = {
        "run_id": "run-1",
        "round_index": 2,
        "max_rounds": 4,
        "actors": [
            {"cast_id": "a", "display_name": "A", "private_goal": "압박한다."},
            {"cast_id": "b", "display_name": "B", "private_goal": "버틴다."},
            {"cast_id": "c", "display_name": "C", "private_goal": "관망한다."},
        ],
        "activity_feeds": initialize_activity_feeds(
            [{"cast_id": "a"}, {"cast_id": "b"}, {"cast_id": "c"}]
        ),
        "activities": [],
        "latest_round_activities": [],
        "round_focus_plan": {"selected_cast_ids": ["a"]},
        "latest_background_updates": [],
        "selected_cast_ids": ["a"],
        "actor_intent_states": [
            {
                "cast_id": "a",
                "current_intent": "b를 압박한다.",
                "thought": "지금 압박해야 한다고 본다.",
                "target_cast_ids": ["b"],
                "supporting_action_type": "speech",
                "confidence": 0.8,
                "changed_from_previous": False,
            },
            {
                "cast_id": "b",
                "current_intent": "답을 늦춘다.",
                "thought": "조금 더 버텨야 한다고 본다.",
                "target_cast_ids": ["a"],
                "supporting_action_type": "initial_state",
                "confidence": 0.6,
                "changed_from_previous": False,
            },
        ],
        "actor_facing_scenario_digest": {},
        "world_state_summary": "기존 상태",
        "plan": {
            "progression_plan": {
                "max_rounds": 4,
                "allowed_elapsed_units": ["minute", "hour"],
                "default_elapsed_unit": "hour",
                "pacing_guidance": ["짧게 본다."],
                "selection_reason": "짧은 상호작용 중심",
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
        "pending_actor_proposals": [
            {
                "cast_id": "a",
                "unread_activity_ids": [],
                "proposal": {
                    "action_type": "speech",
                    "intent": "b를 압박해 즉시 반응을 끌어낸다.",
                    "intent_target_cast_ids": ["b"],
                    "action_summary": "a가 압박 action을 보낸다.",
                    "action_detail": "즉시 반응을 요구한다.",
                    "utterance": "지금 답해야 한다.",
                    "visibility": "private",
                    "target_cast_ids": ["b"],
                    "thread_id": "warning",
                },
                "forced_idle": False,
                "parse_failure_count": 0,
                "latency_seconds": 0.01,
            }
        ],
        "simulation_clock": {
            "total_elapsed_minutes": 0,
            "total_elapsed_label": "0분",
            "last_elapsed_minutes": 0,
            "last_elapsed_label": "0분",
            "last_advanced_round_index": 0,
        },
        "observer_reports": [],
        "round_time_history": [],
        "intent_history": [],
        "forced_idles": 0,
        "parse_failures": 0,
        "stagnation_rounds": 0,
        "stop_requested": False,
        "stop_reason": "",
        "current_round_started_at": 0.0,
        "errors": [],
    }

    result = asyncio.run(resolve_round(state, runtime))

    assert [item["cast_id"] for item in result["actor_intent_states"]] == ["a", "b", "c"]
    assert result["actor_intent_states"][0]["current_intent"] == "b를 다시 압박한다."
    assert result["actor_intent_states"][1]["current_intent"] == "답을 늦춘다."
    assert result["actor_intent_states"][2]["current_intent"] == "관망한다."
    assert result["intent_history"][0]["actor_intent_states"] == result["actor_intent_states"]


def test_resolve_round_completes_matching_major_event_from_applied_actions() -> None:
    class FakeRouter:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del role, prompt, kwargs
            return (
                RoundResolution(
                    adopted_cast_ids=["a"],
                    updated_intent_states=[
                        {
                            "cast_id": "a",
                            "current_intent": "b에게 최종 선택 의사를 직접 묻는다.",
                            "thought": "이번에는 선택 확인을 분명히 끝내야 한다고 본다.",
                            "target_cast_ids": ["b"],
                            "supporting_action_type": "speech",
                            "confidence": 0.9,
                            "changed_from_previous": True,
                        },
                        {
                            "cast_id": "b",
                            "current_intent": "답을 정리한다.",
                            "thought": "더는 미룰 수 없어 입장을 분명히 해야 한다고 본다.",
                            "target_cast_ids": ["a"],
                            "supporting_action_type": "speech",
                            "confidence": 0.7,
                            "changed_from_previous": True,
                        },
                    ],
                    event_updates=[],
                    round_time_advance={
                        "elapsed_unit": "minute",
                        "elapsed_amount": 15,
                        "selection_reason": "이번에는 최종 확인만 짧게 진행됐다.",
                        "signals": ["선택 확인"],
                    },
                    observer_report={
                        "round_index": 2,
                        "summary": "최종 선택 관련 대화가 실제 행동으로 이어졌다.",
                        "notable_events": ["a가 b에게 최종 선택을 직접 물었다."],
                        "atmosphere": "긴장",
                        "momentum": "high",
                        "world_state_summary": "최종 선택 단계가 직접 가시화됐다.",
                    },
                    actor_facing_scenario_digest={
                        "round_index": 2,
                        "relationship_map_summary": "최종 선택을 둘러싼 직접 확인이 시작됐다.",
                        "current_pressures": ["이제 선택을 미루기 어렵다."],
                        "talking_points": ["입장을 분명히 말해 흐름을 닫는다."],
                        "avoid_repetition_notes": ["애매한 탐색 대화를 다시 반복하지 않는다."],
                        "recommended_tone": "짧고 분명한 확인 톤",
                        "world_state_summary": "최종 선택 단계가 직접 가시화됐다.",
                    },
                    world_state_summary="최종 선택 단계가 직접 가시화됐다.",
                    stop_reason="",
                ),
                SimpleNamespace(duration_seconds=0.2, parse_failure_count=0, forced_default=False),
            )

    runtime = SimpleNamespace(
        context=_test_context(
            llms=FakeRouter(),
            logger=logging.getLogger("simula.test.round"),
            settings=SimpleNamespace(
                runtime=SimpleNamespace(max_recipients_per_message=2)
            ),
            store=SimpleNamespace(save_round_artifacts=lambda *args, **kwargs: None),
        )
    )
    state = {
        "run_id": "run-1",
        "round_index": 2,
        "max_rounds": 5,
        "planned_max_rounds": 4,
        "actors": [
            {"cast_id": "a", "private_goal": "선택을 확인한다."},
            {"cast_id": "b", "private_goal": "답을 정리한다."},
        ],
        "activity_feeds": initialize_activity_feeds([{"cast_id": "a"}, {"cast_id": "b"}]),
        "activities": [],
        "latest_round_activities": [],
        "round_focus_plan": {"selected_cast_ids": ["a"]},
        "latest_background_updates": [],
        "selected_cast_ids": ["a"],
        "actor_intent_states": [],
        "actor_facing_scenario_digest": {},
        "world_state_summary": "기존 상태",
        "event_memory": build_event_memory(
            [
                {
                    "event_id": "final_choice",
                    "title": "최종 선택",
                    "summary": "a와 b가 직접 선택 대화를 마무리한다.",
                    "participant_cast_ids": ["a", "b"],
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
                "default_elapsed_unit": "hour",
                "pacing_guidance": ["짧게 본다."],
                "selection_reason": "짧은 상호작용 중심",
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
        "pending_actor_proposals": [
            {
                "cast_id": "a",
                "unread_activity_ids": [],
                "proposal": {
                    "action_type": "speech",
                    "intent": "b에게 최종 선택 의사를 직접 확인한다.",
                    "intent_target_cast_ids": ["b"],
                    "action_summary": "a가 b에게 최종 선택 의사를 직접 묻는다.",
                    "action_detail": "이제 최종 선택을 말해 달라고 분명히 요구한다.",
                    "utterance": "이제는 최종 선택을 분명히 말해줘.",
                    "visibility": "private",
                    "target_cast_ids": ["b"],
                    "thread_id": "final-choice",
                },
                "forced_idle": False,
                "parse_failure_count": 0,
                "latency_seconds": 0.01,
            }
        ],
        "simulation_clock": {
            "total_elapsed_minutes": 0,
            "total_elapsed_label": "0분",
            "last_elapsed_minutes": 0,
            "last_elapsed_label": "0분",
            "last_advanced_round_index": 0,
        },
        "observer_reports": [],
        "round_time_history": [],
        "intent_history": [],
        "forced_idles": 0,
        "parse_failures": 0,
        "stagnation_rounds": 0,
        "stop_requested": False,
        "stop_reason": "",
        "current_round_started_at": 0.0,
        "errors": [],
    }

    result = asyncio.run(resolve_round(state, runtime))

    assert result["event_memory"]["completed_event_ids"] == ["final_choice"]
    assert result["event_memory"]["events"][0]["status"] == "completed"
    assert result["event_memory_history"][0]["event_updates"][0]["status"] == "completed"


def test_evaluate_round_event_updates_matches_public_conversation_to_speech_event() -> None:
    event_memory = build_event_memory(
        [
            {
                "event_id": "public_selection",
                "title": "공개 선택",
                "summary": "두 사람이 공개적으로 선택을 확인한다.",
                "participant_cast_ids": ["a", "b"],
                "earliest_round": 1,
                "latest_round": 2,
                "completion_action_types": ["speech"],
                "completion_signals": ["선택 확인"],
                "required_before_end": True,
            }
        ]
    )

    hints = evaluate_round_event_updates(
        event_memory,
        latest_round_activities=[
            {
                "activity_id": "act-1",
                "source_cast_id": "a",
                "target_cast_ids": ["b"],
                "action_type": "public_conversation",
                "action_summary": "A가 B에게 공개적으로 선택 의사를 묻는다.",
                "action_detail": "공개 자리에서 선택 확인을 요구한다.",
                "utterance": "이제는 서로 선택을 확인하자.",
                "intent": "선택 확인",
            },
            {
                "activity_id": "act-2",
                "source_cast_id": "b",
                "target_cast_ids": ["a"],
                "action_type": "public_dialogue",
                "action_summary": "B가 A에게 공개적으로 답한다.",
                "action_detail": "공개 자리에서 같은 선택 의사를 밝힌다.",
                "utterance": "나도 같은 선택이야.",
                "intent": "선택 확인",
            },
        ],
        current_round_index=1,
    )

    assert hints["suggested_updates"][0]["event_id"] == "public_selection"
    assert hints["suggested_updates"][0]["status"] == "completed"
    assert hints["allowed_completed_event_ids"] == ["public_selection"]


def test_resolve_round_drops_invalid_adopted_private_action_targets() -> None:
    class FakeRouter:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del role, prompt, kwargs
            return (
                RoundResolution(
                    adopted_cast_ids=["a"],
                    updated_intent_states=[
                        {
                            "cast_id": "a",
                            "current_intent": "b에게 비공개 고백을 시도한다.",
                            "thought": "지금 감정을 밀어야 반응을 확인할 수 있다고 본다.",
                            "target_cast_ids": ["b"],
                            "supporting_action_type": "private_confide",
                            "confidence": 0.8,
                            "changed_from_previous": True,
                        }
                    ],
                    event_updates=[],
                    round_time_advance={
                        "elapsed_unit": "minute",
                        "elapsed_amount": 30,
                        "selection_reason": "짧은 압박과 즉시 반응이 중심이다.",
                        "signals": ["직접 압박"],
                    },
                    observer_report={
                        "round_index": 2,
                        "summary": "잘못된 제안은 채택 직전에 제외됐다.",
                        "notable_events": ["invalid proposal dropped"],
                        "atmosphere": "긴장",
                        "momentum": "medium",
                        "world_state_summary": "직접 행동은 보류됐다.",
                    },
                    actor_facing_scenario_digest={
                        "round_index": 2,
                        "relationship_map_summary": "고백 시도는 있었지만 직접 행동은 보류됐다.",
                        "current_pressures": ["다음 선택 전에 감정 확인 압력이 남아 있다."],
                        "talking_points": ["다음에는 실제 상대를 특정한 말로 접근한다."],
                        "avoid_repetition_notes": ["대상 없는 고백 시도는 반복하지 않는다."],
                        "recommended_tone": "조심스럽지만 분명한 확인 톤",
                        "world_state_summary": "직접 행동은 보류됐다.",
                    },
                    world_state_summary="직접 행동은 보류됐다.",
                    stop_reason="",
                ),
                SimpleNamespace(duration_seconds=0.2, parse_failure_count=0, forced_default=False),
            )

    runtime = SimpleNamespace(
        context=_test_context(
            llms=FakeRouter(),
            logger=logging.getLogger("simula.test.round"),
            settings=SimpleNamespace(
                runtime=SimpleNamespace(max_recipients_per_message=2)
            ),
            store=SimpleNamespace(save_round_artifacts=lambda *args, **kwargs: None),
        )
    )
    state = {
        "run_id": "run-1",
        "round_index": 2,
        "max_rounds": 4,
        "actors": [
            {"cast_id": "a", "private_goal": "고백한다."},
            {"cast_id": "b", "private_goal": "관망한다."},
        ],
        "activity_feeds": initialize_activity_feeds([{"cast_id": "a"}, {"cast_id": "b"}]),
        "activities": [],
        "latest_round_activities": [],
        "round_focus_plan": {"selected_cast_ids": ["a"]},
        "latest_background_updates": [],
        "selected_cast_ids": ["a"],
        "actor_intent_states": [],
        "actor_facing_scenario_digest": {},
        "world_state_summary": "기존 상태",
        "plan": {
            "progression_plan": {
                "max_rounds": 4,
                "allowed_elapsed_units": ["minute", "hour"],
                "default_elapsed_unit": "hour",
                "pacing_guidance": ["짧게 본다."],
                "selection_reason": "짧은 상호작용 중심",
            },
            "action_catalog": {
                "actions": [
                    {
                        "action_type": "private_confide",
                        "label": "비공개 고백",
                        "description": "상대에게 비공개로 감정을 털어놓는다.",
                        "supported_visibility": ["private"],
                        "requires_target": True,
                        "supports_utterance": True,
                    }
                ],
                "selection_guidance": [],
            },
        },
        "pending_actor_proposals": [
            {
                "cast_id": "a",
                "unread_activity_ids": [],
                "proposal": {
                    "action_type": "private_confide",
                    "intent": "b에게 감정을 털어놓는다.",
                    "intent_target_cast_ids": ["b"],
                    "action_summary": "a가 비공개 고백을 시도한다.",
                    "action_detail": "하지만 대상 actor를 비워 둔 잘못된 제안이다.",
                    "utterance": "사실 마음이 갑니다.",
                    "visibility": "private",
                    "target_cast_ids": [],
                    "thread_id": "",
                },
                "forced_idle": False,
                "parse_failure_count": 0,
                "latency_seconds": 0.01,
            }
        ],
        "simulation_clock": {
            "total_elapsed_minutes": 0,
            "total_elapsed_label": "0분",
            "last_elapsed_minutes": 0,
            "last_elapsed_label": "0분",
            "last_advanced_round_index": 0,
        },
        "observer_reports": [],
        "round_time_history": [],
        "intent_history": [],
        "forced_idles": 0,
        "parse_failures": 0,
        "stagnation_rounds": 0,
        "stop_requested": False,
        "stop_reason": "",
        "current_round_started_at": 0.0,
        "errors": [],
    }

    result = asyncio.run(resolve_round(state, runtime))

    assert result["latest_round_activities"] == []
    assert any("dropped" in error for error in result["errors"])


def test_resolve_round_marks_simulation_done_stop() -> None:
    class FakeRouter:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del role, prompt, kwargs
            return (
                RoundResolution(
                    adopted_cast_ids=["a"],
                    updated_intent_states=[
                        {
                            "cast_id": "a",
                            "current_intent": "목표를 마무리한다.",
                            "thought": "이번 행동으로 목적이 사실상 달성됐다고 본다.",
                            "target_cast_ids": ["b"],
                            "supporting_action_type": "speech",
                            "confidence": 0.9,
                            "changed_from_previous": True,
                        }
                    ],
                    event_updates=[],
                    round_time_advance={
                        "elapsed_unit": "minute",
                        "elapsed_amount": 15,
                        "selection_reason": "짧은 마무리 반응이다.",
                        "signals": ["합의 도달"],
                    },
                    observer_report={
                        "round_index": 2,
                        "summary": "핵심 목표가 정리됐다.",
                        "notable_events": ["a가 최종 결론을 이끌었다."],
                        "atmosphere": "정리",
                        "momentum": "high",
                        "world_state_summary": "핵심 목적이 달성됐다.",
                    },
                    actor_facing_scenario_digest={
                        "round_index": 2,
                        "relationship_map_summary": "핵심 갈등이 정리됐다.",
                        "current_pressures": ["남은 후속 반응은 크지 않다."],
                        "talking_points": ["핵심 결론은 이미 정해졌다."],
                        "avoid_repetition_notes": ["같은 확인을 반복하지 않는다."],
                        "recommended_tone": "짧고 정리된 톤",
                        "world_state_summary": "핵심 목적이 달성됐다.",
                    },
                    world_state_summary="핵심 목적이 달성됐다.",
                    stop_reason="simulation_done",
                ),
                SimpleNamespace(duration_seconds=0.2, parse_failure_count=0, forced_default=False),
            )

    runtime = SimpleNamespace(
        context=_test_context(
            llms=FakeRouter(),
            logger=logging.getLogger("simula.test.round"),
            settings=SimpleNamespace(
                runtime=SimpleNamespace(max_recipients_per_message=2)
            ),
            store=SimpleNamespace(save_round_artifacts=lambda *args, **kwargs: None),
        )
    )
    state = {
        "run_id": "run-1",
        "round_index": 2,
        "max_rounds": 4,
        "actors": [
            {"cast_id": "a", "private_goal": "마무리한다."},
            {"cast_id": "b", "private_goal": "반응한다."},
        ],
        "activity_feeds": initialize_activity_feeds([{"cast_id": "a"}, {"cast_id": "b"}]),
        "activities": [],
        "latest_round_activities": [],
        "round_focus_plan": {"selected_cast_ids": ["a"]},
        "latest_background_updates": [],
        "selected_cast_ids": ["a"],
        "actor_intent_states": [],
        "actor_facing_scenario_digest": {},
        "world_state_summary": "기존 상태",
        "plan": {
            "progression_plan": {
                "max_rounds": 4,
                "allowed_elapsed_units": ["minute", "hour"],
                "default_elapsed_unit": "hour",
                "pacing_guidance": ["짧게 본다."],
                "selection_reason": "짧은 상호작용 중심",
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
        "pending_actor_proposals": [
            {
                "cast_id": "a",
                "unread_activity_ids": [],
                "proposal": {
                    "action_type": "speech",
                    "intent": "마무리 결론을 낸다.",
                    "intent_target_cast_ids": ["b"],
                    "action_summary": "a가 최종 결론을 제안한다.",
                    "action_detail": "남은 쟁점을 닫는다.",
                    "utterance": "이제 결론을 내립시다.",
                    "visibility": "private",
                    "target_cast_ids": ["b"],
                    "thread_id": "closure",
                },
                "forced_idle": False,
                "parse_failure_count": 0,
                "latency_seconds": 0.01,
            }
        ],
        "simulation_clock": {
            "total_elapsed_minutes": 0,
            "total_elapsed_label": "0분",
            "last_elapsed_minutes": 0,
            "last_elapsed_label": "0분",
            "last_advanced_round_index": 0,
        },
        "observer_reports": [],
        "round_time_history": [],
        "intent_history": [],
        "forced_idles": 0,
        "parse_failures": 0,
        "stagnation_rounds": 0,
        "stop_requested": False,
        "stop_reason": "",
        "current_round_started_at": 0.0,
        "errors": [],
    }

    result = asyncio.run(resolve_round(state, runtime))

    assert result["stop_requested"] is True
    assert result["stop_reason"] == "simulation_done"
