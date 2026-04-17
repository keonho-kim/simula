"""Purpose:
- Verify the compact planning nodes.
"""

from __future__ import annotations

import asyncio
import logging
from types import SimpleNamespace

import pytest
from langgraph.types import Overwrite

from simula.application.workflow.graphs.planning.nodes.planner import (
    assemble_execution_plan,
    build_cast_roster_outline,
    build_execution_plan_frame,
    build_plan_cast_chunk,
    build_planning_analysis,
    finalize_plan,
    prepare_plan_cast_chunks,
    validate_execution_plan_frame_semantics,
)
from simula.domain.contracts import (
    ActionCatalog,
    CastRoster,
    CastRosterOutlineBundle,
    CoordinationFrame,
    ExecutionPlanFrameBundle,
    MajorEventPlanBatch,
    PlanningAnalysis,
    SituationBundle,
)


class _FakeMeta:
    duration_seconds = 0.01
    forced_default = False
    parse_failure_count = 0


def _build_runtime(llms: object) -> SimpleNamespace:
    store = SimpleNamespace(saved_plan=None)

    def _save_plan(run_id: str, plan: dict[str, object]) -> None:
        store.saved_plan = (run_id, plan)

    store.save_plan = _save_plan  # type: ignore[attr-defined]
    return SimpleNamespace(
        context=SimpleNamespace(
            llms=llms,
            logger=logging.getLogger("simula.test.planning"),
            run_jsonl_appender=None,
            store=store,
        )
    )


def test_build_planning_analysis_returns_required_bundle() -> None:
    class FakeLLM:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del prompt, kwargs
            assert role == "planner"
            assert schema is PlanningAnalysis
            return (
                PlanningAnalysis(
                    brief_summary="공개 압박과 비공개 조율이 함께 움직인다.",
                    premise="표면적 입장보다 실제 정렬 방향이 중요하다.",
                    time_scope={"start": "초기", "end": "종결 직전"},
                    public_context=["공개 압박"],
                    private_context=["비공개 계산"],
                    key_pressures=["시간 압박"],
                    progression_plan={
                        "max_rounds": 6,
                        "allowed_elapsed_units": ["hour"],
                        "default_elapsed_unit": "hour",
                        "pacing_guidance": ["짧게 본다."],
                        "selection_reason": "짧은 조율이 중심이다.",
                    },
                ),
                _FakeMeta(),
            )

    state = {
        "scenario": "테스트 시나리오",
        "scenario_controls": {"num_cast": 4, "allow_additional_cast": True},
        "max_rounds": 6,
        "planning_latency_seconds": 0.0,
    }

    result = asyncio.run(build_planning_analysis(state, _build_runtime(FakeLLM())))

    assert result["planning_analysis"]["premise"] == "표면적 입장보다 실제 정렬 방향이 중요하다."


def test_build_cast_roster_outline_returns_required_outline() -> None:
    class FakeLLM:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            assert role == "planner"
            assert schema is CastRosterOutlineBundle
            assert "Cast roster policy" in prompt
            semantic_validator = kwargs["semantic_validator"]
            repair_context = kwargs["repair_context"]
            parsed = CastRosterOutlineBundle(
                items=[
                    {
                        "slot_index": 1,
                        "cast_id": "cast-alpha",
                        "display_name": "알파",
                    },
                    {
                        "slot_index": 2,
                        "cast_id": "cast-beta",
                        "display_name": "베타",
                    },
                ]
            )
            assert semantic_validator(parsed) == []
            assert repair_context["num_cast"] == 2
            return parsed, _FakeMeta()

    state = {
        "scenario": "등장인물 2명 테스트 시나리오",
        "scenario_controls": {"num_cast": 2, "allow_additional_cast": False},
        "planning_analysis": {
            "brief_summary": "요약",
            "premise": "전제",
            "time_scope": {"start": "초기", "end": "종결"},
            "public_context": ["공개"],
            "private_context": ["비공개"],
            "key_pressures": ["압박"],
            "progression_plan": {
                "max_rounds": 6,
                "allowed_elapsed_units": ["hour"],
                "default_elapsed_unit": "hour",
                "pacing_guidance": ["짧게 본다."],
                "selection_reason": "짧은 조율이 중심이다.",
            },
        },
        "planning_latency_seconds": 0.0,
    }

    result = asyncio.run(build_cast_roster_outline(state, _build_runtime(FakeLLM())))

    assert len(result["cast_roster_outline"]["items"]) == 2
    assert result["cast_roster_outline"]["items"][0]["cast_id"] == "cast-alpha"


def test_build_execution_plan_frame_returns_required_frame() -> None:
    class FakeLLM:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            assert role == "planner"
            if schema is SituationBundle:
                return (
                    SituationBundle(
                        simulation_objective="위기 추적",
                        world_summary="요약",
                        initial_tensions=["긴장"],
                        channel_guidance={
                            "public": "공개",
                            "private": "비공개",
                            "group": "그룹",
                        },
                        current_constraints=["제약"],
                    ),
                    _FakeMeta(),
                )
            if schema is ActionCatalog:
                assert "at most 5 items" in prompt
                semantic_validator = kwargs["semantic_validator"]
                repair_context = kwargs["repair_context"]
                parsed = ActionCatalog(
                    actions=[
                        {
                            "action_type": "speech",
                            "label": "발화",
                            "description": "말한다.",
                            "supported_visibility": ["public", "private", "group"],
                            "requires_target": False,
                            "supports_utterance": True,
                        }
                    ],
                    selection_guidance=["상황에 맞게 고른다."],
                )
                assert semantic_validator(parsed) == []
                assert repair_context["max_actions"] == 5
                return parsed, _FakeMeta()
            if schema is CoordinationFrame:
                return (
                    CoordinationFrame(
                        focus_selection_rules=["직접 압박을 본다."],
                        background_motion_rules=["배경은 요약한다."],
                        focus_archetypes=["직접 충돌"],
                        attention_shift_rules=["조용한 actor도 끌어올린다."],
                        budget_guidance=["소수만 직접 본다."],
                    ),
                    _FakeMeta(),
                )
            if schema is MajorEventPlanBatch:
                assert "at most 6 items" in prompt
                semantic_validator = kwargs["semantic_validator"]
                repair_context = kwargs["repair_context"]
                parsed = MajorEventPlanBatch(major_events=[])
                assert semantic_validator(parsed) == []
                assert repair_context["max_major_events"] == 6
                return parsed, _FakeMeta()
            raise AssertionError(f"unexpected schema: {schema}")

    state = {
        "scenario": "등장인물 1명이 있는 테스트 시나리오",
        "scenario_controls": {"num_cast": 1, "allow_additional_cast": False},
        "max_rounds": 6,
        "planned_max_rounds": 6,
        "planning_latency_seconds": 0.0,
        "planning_analysis": {
            "brief_summary": "요약",
            "premise": "전제",
            "time_scope": {"start": "초기", "end": "종결"},
            "public_context": ["공개"],
            "private_context": ["비공개"],
            "key_pressures": ["압박"],
            "progression_plan": {
                "max_rounds": 6,
                "allowed_elapsed_units": ["hour"],
                "default_elapsed_unit": "hour",
                "pacing_guidance": ["짧게 본다."],
                "selection_reason": "짧은 조율이 중심이다.",
            },
        },
        "cast_roster_outline": {
            "items": [
                {
                    "slot_index": 1,
                    "cast_id": "cast-alpha",
                    "display_name": "알파",
                }
            ]
        },
    }

    result = asyncio.run(build_execution_plan_frame(state, _build_runtime(FakeLLM())))

    assert result["execution_plan_frame"]["action_catalog"]["actions"][0]["requires_target"] is False


def test_validate_execution_plan_frame_semantics_rejects_speaking_action_without_utterance_support() -> None:
    issues = validate_execution_plan_frame_semantics(
        execution_plan_frame=ExecutionPlanFrameBundle(
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
                        "action_type": "review_sharing",
                        "label": "후기 공유",
                        "description": "체험 후 느낀 점을 공개적으로 공유한다.",
                        "supported_visibility": ["public", "private"],
                        "requires_target": False,
                        "supports_utterance": False,
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
            major_events=[],
        ),
        cast_roster_outline=CastRosterOutlineBundle(
            items=[
                {
                    "slot_index": 1,
                    "cast_id": "cast-alpha",
                    "display_name": "알파",
                }
            ]
        ),
        planned_max_rounds=6,
    )

    assert "supports_utterance=true" in issues[0]


def test_prepare_plan_cast_chunks_groups_outline_by_fixed_size() -> None:
    runtime = _build_runtime(object())
    state = {
        "cast_roster_outline": {
            "items": [
                {
                    "slot_index": index,
                    "cast_id": f"cast-{index}",
                    "display_name": f"배역 {index}",
                }
                for index in range(1, 15)
            ]
        }
    }

    result = prepare_plan_cast_chunks(state, runtime)

    assert [len(item["cast_outline_items"]) for item in result["pending_plan_cast_chunks"]] == [5, 5, 4]
    assert isinstance(result["generated_plan_cast_results"], Overwrite)


def test_build_plan_cast_chunk_returns_assigned_cast_only() -> None:
    class FakeLLM:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            assert role == "planner"
            assert schema is CastRoster
            assert "Assigned outline JSON" in prompt
            semantic_validator = kwargs["semantic_validator"]
            repair_context = kwargs["repair_context"]
            parsed = CastRoster(
                items=[
                    {
                        "cast_id": "cast-alpha",
                        "display_name": "알파",
                        "role_hint": "선도자",
                        "group_name": "A",
                        "core_tension": "먼저 움직인다.",
                    },
                    {
                        "cast_id": "cast-beta",
                        "display_name": "베타",
                        "role_hint": "조정자",
                        "group_name": "B",
                        "core_tension": "즉시 결정이 부담스럽다.",
                    },
                ]
            )
            assert semantic_validator(parsed) == []
            assert repair_context["exact_chunk_size"] == 2
            meta = _FakeMeta()
            meta.parse_failure_count = 1
            return parsed, meta

    state = {
        "scenario": "테스트 시나리오",
        "planning_analysis": {
            "brief_summary": "요약",
            "premise": "전제",
            "time_scope": {"start": "초기", "end": "종결"},
            "public_context": ["공개"],
            "private_context": ["비공개"],
            "key_pressures": ["압박"],
            "progression_plan": {
                "max_rounds": 6,
                "allowed_elapsed_units": ["hour"],
                "default_elapsed_unit": "hour",
                "pacing_guidance": ["짧게 본다."],
                "selection_reason": "짧은 조율이 중심이다.",
            },
        },
        "execution_plan_frame": {
            "situation": {},
            "action_catalog": {},
            "coordination_frame": {},
            "major_events": [],
        },
        "plan_cast_chunk": {
            "chunk_index": 1,
            "cast_outline_items": [
                {
                    "slot_index": 1,
                    "cast_id": "cast-alpha",
                    "display_name": "알파",
                },
                {
                    "slot_index": 2,
                    "cast_id": "cast-beta",
                    "display_name": "베타",
                },
            ],
        },
    }

    result = asyncio.run(build_plan_cast_chunk(state, _build_runtime(FakeLLM())))

    assert result["generated_plan_cast_results"][0]["chunk_index"] == 1
    assert result["generated_plan_cast_results"][0]["cast_items"][0]["slot_index"] == 1
    assert result["generated_plan_cast_results"][0]["parse_failure_count"] == 1


def test_assemble_execution_plan_merges_chunk_results_in_slot_order() -> None:
    runtime = _build_runtime(object())
    state = {
        "planning_analysis": {
            "brief_summary": "요약",
            "premise": "전제",
            "time_scope": {"start": "초기", "end": "종결"},
            "public_context": ["공개"],
            "private_context": ["비공개"],
            "key_pressures": ["압박"],
            "progression_plan": {
                "max_rounds": 6,
                "allowed_elapsed_units": ["hour"],
                "default_elapsed_unit": "hour",
                "pacing_guidance": ["짧게 본다."],
                "selection_reason": "짧은 조율이 중심이다.",
            },
        },
        "execution_plan_frame": {
            "situation": {"simulation_objective": "위기 추적"},
            "action_catalog": {"actions": []},
            "coordination_frame": {"focus_selection_rules": []},
            "major_events": [],
        },
        "generated_plan_cast_results": [
            {
                "chunk_index": 2,
                "cast_items": [
                    {
                        "slot_index": 3,
                        "cast_id": "cast-gamma",
                        "display_name": "감마",
                        "role_hint": "관찰자",
                        "group_name": "C",
                        "core_tension": "흐름을 본다.",
                    }
                ],
                "parse_failure_count": 0,
            },
            {
                "chunk_index": 1,
                "cast_items": [
                    {
                        "slot_index": 2,
                        "cast_id": "cast-beta",
                        "display_name": "베타",
                        "role_hint": "조정자",
                        "group_name": "B",
                        "core_tension": "즉시 결정이 부담스럽다.",
                    },
                    {
                        "slot_index": 1,
                        "cast_id": "cast-alpha",
                        "display_name": "알파",
                        "role_hint": "선도자",
                        "group_name": "A",
                        "core_tension": "먼저 움직인다.",
                    },
                ],
                "parse_failure_count": 0,
            },
        ],
    }

    result = assemble_execution_plan(state, runtime)

    assert [item["cast_id"] for item in result["plan"]["cast_roster"]] == [
        "cast-alpha",
        "cast-beta",
        "cast-gamma",
    ]


def test_finalize_plan_persists_compact_plan() -> None:
    runtime = _build_runtime(object())
    state = {
        "run_id": "run-1",
        "scenario_controls": {"num_cast": 2, "allow_additional_cast": False},
        "planned_max_rounds": 4,
        "plan": {
            "cast_roster": [
                {"cast_id": "a", "display_name": "A"},
                {"cast_id": "b", "display_name": "B"},
            ],
            "major_events": [],
        },
    }

    result = finalize_plan(state, runtime)

    assert result["plan"]["cast_roster"][0]["cast_id"] == "a"
    assert runtime.context.store.saved_plan[0] == "run-1"


def test_finalize_plan_rejects_duplicate_cast_names() -> None:
    runtime = _build_runtime(object())
    state = {
        "run_id": "run-1",
        "scenario_controls": {"num_cast": 2, "allow_additional_cast": False},
        "planned_max_rounds": 4,
        "plan": {
            "cast_roster": [
                {"cast_id": "a", "display_name": "A"},
                {"cast_id": "b", "display_name": "A"},
            ],
            "major_events": [],
        },
    }

    with pytest.raises(ValueError, match="display_name"):
        finalize_plan(state, runtime)


def test_finalize_plan_rejects_cast_count_below_required_minimum() -> None:
    runtime = _build_runtime(object())
    state = {
        "run_id": "run-1",
        "scenario_controls": {"num_cast": 3, "allow_additional_cast": True},
        "planned_max_rounds": 4,
        "plan": {
            "cast_roster": [
                {"cast_id": "a", "display_name": "A"},
                {"cast_id": "b", "display_name": "B"},
            ],
            "major_events": [],
        },
    }

    with pytest.raises(ValueError, match="최소 3명"):
        finalize_plan(state, runtime)


def test_finalize_plan_rejects_cast_count_when_exact_count_is_required() -> None:
    runtime = _build_runtime(object())
    state = {
        "run_id": "run-1",
        "scenario_controls": {"num_cast": 2, "allow_additional_cast": False},
        "planned_max_rounds": 4,
        "plan": {
            "cast_roster": [
                {"cast_id": "a", "display_name": "A"},
            ],
            "major_events": [],
        },
    }

    with pytest.raises(ValueError, match="정확히 2명"):
        finalize_plan(state, runtime)


def test_finalize_plan_rejects_major_event_with_unknown_participant() -> None:
    runtime = _build_runtime(object())
    state = {
        "run_id": "run-1",
        "scenario_controls": {"num_cast": 2, "allow_additional_cast": False},
        "planned_max_rounds": 4,
        "plan": {
            "cast_roster": [
                {"cast_id": "a", "display_name": "A"},
                {"cast_id": "b", "display_name": "B"},
            ],
            "major_events": [
                {
                    "event_id": "final-choice",
                    "title": "최종 선택",
                    "summary": "마지막 선택을 직접 확인한다.",
                    "participant_cast_ids": ["a", "missing"],
                    "earliest_round": 3,
                    "latest_round": 4,
                    "completion_action_types": ["speech"],
                    "completion_signals": ["최종 선택"],
                    "required_before_end": True,
                }
            ],
        },
    }

    with pytest.raises(ValueError, match="participant_cast_ids"):
        finalize_plan(state, runtime)
