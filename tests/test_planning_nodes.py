"""목적:
- planning 노드의 구조화 출력 경계를 검증한다.

설명:
- cast roster 단계가 구조화 출력과 명시적 parse error를 올바르게 다루는지 확인한다.

사용한 설계 패턴:
- planning node 단위 테스트 패턴

연관된 다른 모듈/구조:
- simula.application.workflow.graphs.planning.nodes.planner
"""

from __future__ import annotations

import asyncio
import logging
from types import SimpleNamespace

import pytest

from simula.application.workflow.graphs.planning.nodes.planner import build_cast_roster
from simula.domain.contracts import CastRoster


class _FakeMeta:
    duration_seconds = 0.01


def _build_state() -> dict[str, object]:
    return {
        "scenario": "테스트 시나리오",
        "max_steps": 6,
        "pending_interpretation": {
            "premise": "공개 신호와 비공개 계산이 함께 움직인다.",
            "time_scope": {"start": "초기", "end": "결말 직전"},
            "public_context": ["공개 압박이 있다."],
            "private_context": ["비공개 계산이 있다."],
            "key_pressures": ["시간 압박"],
            "observation_points": ["누가 먼저 움직이는가"],
        },
        "pending_situation": {
            "simulation_objective": "위기 추적",
            "world_summary": "요약",
            "initial_tensions": ["긴장"],
            "channel_guidance": {
                "public": "공개",
                "private": "비공개",
                "group": "집단",
            },
            "current_constraints": ["제약"],
        },
        "pending_action_catalog": {
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
        "pending_coordination_frame": {
            "focus_selection_rules": ["직접 압박을 본다."],
            "background_motion_rules": ["배경은 요약한다."],
            "focus_archetypes": ["직접 충돌"],
            "attention_shift_rules": ["조용한 actor도 끌어올린다."],
            "budget_guidance": ["소수만 직접 본다."],
        },
        "pending_scenario_brief": {
            "summary": "공개 압박과 비공개 계산이 함께 움직이는 시나리오다.",
            "key_entities": ["알파", "베타"],
            "explicit_time_signals": ["초기", "결말 직전"],
            "public_facts": ["공개 압박이 있다."],
            "private_dynamics": ["비공개 계산이 있다."],
            "terminal_conditions": ["핵심 갈등이 정리될 때까지 본다."],
        },
        "pending_progression_plan": {
            "max_steps": 6,
            "allowed_units": ["hour"],
            "default_unit": "hour",
        },
        "planning_latency_seconds": 0.0,
    }


def _build_runtime(llms: object) -> SimpleNamespace:
    return SimpleNamespace(
        context=SimpleNamespace(
            llms=llms,
            logger=logging.getLogger("simula.test.planning"),
        )
    )


def test_build_cast_roster_accepts_structured_items_array() -> None:
    class FakeLLM:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            assert role == "planner"
            assert schema is CastRoster
            assert kwargs["enforce_native_structured_output"] is True
            assert "items" in prompt
            return (
                CastRoster(
                    items=[
                        {
                            "cast_id": "cast-alpha",
                            "display_name": "알파",
                            "role_hint": "선도자",
                            "group_name": "A",
                            "core_tension": "먼저 움직이고 싶다.",
                        },
                        {
                            "cast_id": "cast-beta",
                            "display_name": "베타",
                            "role_hint": "조정자",
                            "group_name": "B",
                            "core_tension": "리스크를 줄이고 싶다.",
                        },
                    ]
                ),
                _FakeMeta(),
            )

    result = asyncio.run(build_cast_roster(_build_state(), _build_runtime(FakeLLM())))

    assert len(result["pending_cast_roster"]) == 2
    assert result["pending_cast_roster"][0]["cast_id"] == "cast-alpha"


def test_build_cast_roster_surfaces_field_mismatch_parse_error() -> None:
    class FakeLLM:
        async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
            del role, prompt, schema, kwargs
            raise ValueError(
                "planner 구조화 응답 파싱에 실패했습니다. error="
                "1 validation error for CastRoster\n"
                "items.0.cast_id\n"
                "  Field required [type=missing, input_value={'cast::id':'broken'}]"
            )

    with pytest.raises(ValueError, match=r"CastRoster"):
        asyncio.run(build_cast_roster(_build_state(), _build_runtime(FakeLLM())))
