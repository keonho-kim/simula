"""Purpose:
- Verify the compact planning nodes.
"""

from __future__ import annotations

import asyncio
import logging
from types import SimpleNamespace

import pytest

from simula.application.workflow.graphs.planning.nodes.planner import (
    build_execution_plan,
    build_planning_analysis,
    finalize_plan,
)
from simula.domain.contracts import ExecutionPlanBundle, PlanningAnalysis


class _FakeMeta:
    duration_seconds = 0.01
    forced_default = False


def _build_runtime(llms: object) -> SimpleNamespace:
    store = SimpleNamespace(saved_plan=None)

    def _save_plan(run_id: str, plan: dict[str, object]) -> None:
        store.saved_plan = (run_id, plan)

    store.save_plan = _save_plan  # type: ignore[attr-defined]
    return SimpleNamespace(
        context=SimpleNamespace(
            llms=llms,
            logger=logging.getLogger("simula.test.planning"),
            store=store,
        )
    )


def test_build_planning_analysis_returns_required_bundle() -> None:
    class FakeLLM:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del kwargs
            assert role == "planner"
            assert schema is PlanningAnalysis
            assert "brief_summary" in prompt
            return (
                PlanningAnalysis(
                    brief_summary="공개 압박과 비공개 조율이 함께 움직인다.",
                    premise="표면적 입장보다 실제 정렬 방향이 중요하다.",
                    time_scope={"start": "초기", "end": "종결 직전"},
                    public_context=["공개 압박"],
                    private_context=["비공개 계산"],
                    key_pressures=["시간 압박"],
                    progression_plan={
                        "max_steps": 6,
                        "allowed_units": ["hour"],
                        "default_unit": "hour",
                        "pacing_guidance": ["짧게 본다."],
                        "selection_reason": "짧은 조율이 중심이다.",
                    },
                ),
                _FakeMeta(),
            )

    state = {
        "scenario": "테스트 시나리오",
        "scenario_controls": {"create_all_participants": False},
        "max_steps": 6,
        "planning_latency_seconds": 0.0,
    }

    result = asyncio.run(build_planning_analysis(state, _build_runtime(FakeLLM())))

    assert result["planning_analysis"]["premise"] == "표면적 입장보다 실제 정렬 방향이 중요하다."


def test_build_execution_plan_returns_minimum_plan_payload() -> None:
    class FakeLLM:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del kwargs
            assert role == "planner"
            assert schema is ExecutionPlanBundle
            assert "cast_roster" in prompt
            return (
                ExecutionPlanBundle(
                    situation={
                        "simulation_objective": "위기 추적",
                        "world_summary": "요약",
                        "initial_tensions": ["긴장"],
                        "channel_guidance": {
                            "public": "공개",
                            "private": "비공개",
                            "group": "그룹",
                        },
                        "current_constraints": ["제약"],
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
                        "focus_selection_rules": ["직접 압박을 본다."],
                        "background_motion_rules": ["배경은 요약한다."],
                        "focus_archetypes": ["직접 충돌"],
                        "attention_shift_rules": ["조용한 actor도 끌어올린다."],
                        "budget_guidance": ["소수만 직접 본다."],
                    },
                    cast_roster={
                        "items": [
                            {
                                "cast_id": "cast-alpha",
                                "display_name": "알파",
                                "role_hint": "선도자",
                                "group_name": "A",
                                "core_tension": "먼저 움직인다.",
                            }
                        ]
                    },
                ),
                _FakeMeta(),
            )

    state = {
        "scenario_controls": {"create_all_participants": True},
        "max_steps": 6,
        "planning_latency_seconds": 0.0,
        "planning_analysis": {
            "brief_summary": "요약",
            "premise": "전제",
            "time_scope": {"start": "초기", "end": "종결"},
            "public_context": ["공개"],
            "private_context": ["비공개"],
            "key_pressures": ["압박"],
            "progression_plan": {
                "max_steps": 6,
                "allowed_units": ["hour"],
                "default_unit": "hour",
                "pacing_guidance": ["짧게 본다."],
                "selection_reason": "짧은 조율이 중심이다.",
            },
        },
    }

    result = asyncio.run(build_execution_plan(state, _build_runtime(FakeLLM())))

    assert result["plan"]["interpretation"]["brief_summary"] == "요약"
    assert result["plan"]["cast_roster"][0]["cast_id"] == "cast-alpha"


def test_finalize_plan_persists_compact_plan() -> None:
    runtime = _build_runtime(object())
    state = {
        "run_id": "run-1",
        "plan": {
            "cast_roster": [
                {"cast_id": "a", "display_name": "A"},
                {"cast_id": "b", "display_name": "B"},
            ]
        },
    }

    result = finalize_plan(state, runtime)

    assert result["plan"]["cast_roster"][0]["cast_id"] == "a"
    assert runtime.context.store.saved_plan[0] == "run-1"


def test_finalize_plan_rejects_duplicate_cast_names() -> None:
    runtime = _build_runtime(object())
    state = {
        "run_id": "run-1",
        "plan": {
            "cast_roster": [
                {"cast_id": "a", "display_name": "A"},
                {"cast_id": "b", "display_name": "A"},
            ]
        },
    }

    with pytest.raises(ValueError, match="display_name"):
        finalize_plan(state, runtime)
