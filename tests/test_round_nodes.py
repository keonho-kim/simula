"""Purpose:
- Verify the compact round coordination nodes.
"""

from __future__ import annotations

import asyncio
import logging
from types import SimpleNamespace

from simula.application.workflow.graphs.coordinator.nodes.build_round_directive import (
    build_round_directive,
)
from simula.application.workflow.graphs.coordinator.nodes.prepare_focus_candidates import (
    prepare_focus_candidates,
)
from simula.application.workflow.graphs.coordinator.nodes.resolve_round import (
    resolve_round,
)
from simula.domain.activity_feeds import initialize_activity_feeds
from simula.domain.contracts import RoundDirective, RoundResolution


def test_prepare_focus_candidates_advances_round_and_builds_candidates() -> None:
    runtime = SimpleNamespace(
        context=SimpleNamespace(logger=logging.getLogger("simula.test.round"))
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
        "round_focus_history": [],
        "observer_reports": [],
        "actor_intent_states": [],
        "rng_seed": 7,
        "round_index": 0,
    }

    result = prepare_focus_candidates(state, runtime)

    assert result["round_index"] == 1
    assert result["focus_candidates"]


def test_build_round_directive_sets_selected_actor_ids() -> None:
    class FakeRouter:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del role, prompt, kwargs
            return (
                schema.model_validate(
                    RoundDirective(
                        round_index=2,
                        focus_summary="직접 압박 축을 우선 추적한다.",
                        selection_reason="직접 반응 압력이 가장 높다.",
                        selected_actor_ids=["a", "b"],
                        deferred_actor_ids=["c"],
                        focus_slices=[
                            {
                                "slice_id": "focus-1",
                                "title": "압박 축",
                                "focus_actor_ids": ["a", "b"],
                                "visibility": "private",
                                "stakes": "즉시 반응이 필요하다.",
                                "selection_reason": "핵심 압박이 몰렸다.",
                            }
                        ],
                        background_updates=[
                            {
                                "round_index": 2,
                                "actor_id": "c",
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
        context=SimpleNamespace(
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
        "round_index": 2,
        "actors": [{"actor_id": "c", "display_name": "C"}],
        "focus_candidates": [{"actor_id": "a"}, {"actor_id": "b"}, {"actor_id": "c"}],
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

    assert result["selected_actor_ids"] == ["a", "b"]
    assert result["latest_background_updates"][0]["actor_id"] == "c"


def test_resolve_round_persists_round_artifacts() -> None:
    class FakeRouter:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del role, prompt, kwargs
            return (
                RoundResolution(
                    adopted_actor_ids=["a"],
                    updated_intent_states=[
                        {
                            "actor_id": "a",
                            "current_intent": "b를 압박한다.",
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
        context=SimpleNamespace(
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
            {"actor_id": "a", "private_goal": "압박한다."},
            {"actor_id": "b", "private_goal": "관망한다."},
        ],
        "activity_feeds": initialize_activity_feeds([{"actor_id": "a"}, {"actor_id": "b"}]),
        "activities": [],
        "latest_round_activities": [],
        "round_focus_plan": {"selected_actor_ids": ["a"]},
        "latest_background_updates": [],
        "selected_actor_ids": ["a"],
        "actor_intent_states": [],
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
