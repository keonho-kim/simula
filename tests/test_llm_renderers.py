"""목적:
- 사람이 읽기 좋은 LLM 로그 렌더링을 검증한다.

설명:
- 주요 schema가 raw JSON 대신 요약 문장으로 변환되는지 확인한다.

사용한 설계 패턴:
- renderer 단위 테스트 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.llm.renderers
"""

from __future__ import annotations

from simula.domain.contracts import (
    ActionCatalog,
    ActorActionProposal,
    ActorCard,
    ActorIntentStateBatch,
    ObserverEventProposal,
    ObserverReport,
    RuntimeProgressionPlan,
    ScenarioInterpretation,
    ScenarioTimeScope,
    SimulationClockSnapshot,
    StepTimeAdvanceProposal,
    SituationBundle,
)
from simula.infrastructure.llm.renderers import render_structured_response


def test_render_interpretation_is_human_readable() -> None:
    text = render_structured_response(
        role="planner",
        parsed=ScenarioInterpretation(
            premise="공개 경쟁과 비공개 계산이 동시에 움직인다.",
            time_scope=ScenarioTimeScope(
                start="초기 대면 직후",
                end="핵심 선택 직전",
            ),
            public_context=["겉으로는 신중하다."],
            private_context=["속으로는 계산이 많다."],
            key_pressures=["시간 압박", "감정 경쟁"],
            observation_points=["공개 신호", "비공개 정렬"],
        ),
        content="",
        log_context=None,
    )

    assert "시나리오 1차 해석을 완료했습니다." in text
    assert "중요 변수: 시간 압박, 감정 경쟁" in text


def test_render_situation_bundle_is_human_readable() -> None:
    text = render_structured_response(
        role="planner",
        parsed=SituationBundle(
            simulation_objective="관계 재편 추적",
            world_summary="공개와 비공개 계산이 교차한다.",
            initial_tensions=["호감 경쟁", "정보 비대칭"],
            channel_guidance={"public": "공개", "private": "비공개", "group": "그룹"},
            current_constraints=["시간 제한"],
        ),
        content="",
        log_context=None,
    )

    assert "실행에 필요한 상황을 정리했습니다." in text
    assert "시뮬레이션 목표: 관계 재편 추적" in text
    assert "처음 갈등: 호감 경쟁, 정보 비대칭" in text


def test_render_runtime_progression_is_human_readable() -> None:
    text = render_structured_response(
        role="planner",
        parsed=RuntimeProgressionPlan(
            max_steps=4,
            allowed_units=["minute", "hour", "day"],
            default_unit="hour",
            pacing_guidance=["대화는 짧게, 이동은 길게 본다."],
            selection_reason="짧은 반응과 긴 준비 구간이 섞여 있어 복수 단위가 적절하다.",
        ),
        content="",
        log_context=None,
    )

    assert "실행 시간 진행 계획을 정했습니다." in text
    assert "최대 단계: 4" in text
    assert "허용 단위: minute, hour, day" in text


def test_render_step_time_advance_is_human_readable() -> None:
    text = render_structured_response(
        role="observer",
        parsed=StepTimeAdvanceProposal(
            elapsed_unit="minute",
            elapsed_amount=30,
            selection_reason="직접 반응과 짧은 조율이 중심이라 반시간이 적절하다.",
            signals=["직접 반응", "짧은 조율"],
        ),
        content="",
        log_context=None,
    )

    assert "step 시간 경과를 추정했습니다." in text
    assert "이번 step 경과: 30분" in text


def test_render_actor_action_proposal_is_human_readable() -> None:
    text = render_structured_response(
        role="actor",
        parsed=ActorActionProposal(
            action_type="speech",
            intent="핵심 범위를 다시 정리하도록 방향을 튼다.",
            intent_target_actor_ids=["cfo"],
            action_summary="운영 총괄이 일정 재조정을 제안한다.",
            action_detail="기존 일정은 무리이므로 범위를 다시 정리해야 한다.",
            utterance="기존 일정은 무리입니다.",
            visibility="group",
            target_actor_ids=["cfo"],
            thread_id=None,
        ),
        content="",
        log_context={"actor_display_name": "운영 총괄"},
    )

    assert "운영 총괄이 일부 공개 행동을 제안했습니다." in text
    assert "action_type: speech" in text
    assert "일정 재조정을 제안한다" in text


def test_render_observer_report_is_human_readable() -> None:
    text = render_structured_response(
        role="observer",
        parsed=ObserverReport(
            step_index=2,
            summary="공개 활동은 조심스러웠다.",
            notable_events=["일정 재조정 제안"],
            atmosphere="긴장",
            momentum="medium",
            world_state_summary="실무 정렬이 천천히 시작됐다.",
        ),
        content="",
        log_context={"step_index": 2, "simulation_clock_label": "6시간 30분"},
    )

    assert "관찰 요약을 정리했습니다." in text
    assert "6시간 30분" in text
    assert "흐름 속도: 보통(medium)" in text
    assert "세계 상태: 실무 정렬이 천천히 시작됐다." in text


def test_render_observer_event_is_human_readable() -> None:
    text = render_structured_response(
        role="observer",
        parsed=ObserverEventProposal(
            action_type="public_event",
            intent="기존 흐름을 다시 흔든다.",
            action_summary="예정과 다른 공용 일정이 공개된다.",
            action_detail="기존 대화 흐름을 다시 정리해야 할 만큼 일정이 흔들린다.",
            utterance=None,
            thread_id="observer-event",
        ),
        content="",
        log_context=None,
    )

    assert "관찰 기반 상황 이벤트를 제안했습니다." in text
    assert "예정과 다른 공용 일정이 공개된다." in text


def test_render_action_catalog_is_human_readable() -> None:
    text = render_structured_response(
        role="planner",
        parsed=ActionCatalog(
            actions=[
                {
                    "action_type": "speech",
                    "label": "직접 발화",
                    "description": "직접 말로 의도를 전달한다.",
                    "role_hints": ["조정자"],
                    "group_hints": ["운영팀"],
                    "supported_visibility": ["public", "private", "group"],
                    "requires_target": False,
                    "supports_utterance": True,
                    "examples_or_usage_notes": ["짧은 공개 발언"],
                }
            ],
            selection_guidance=["발화는 여러 액션 중 하나다."],
        ),
        content="",
        log_context=None,
    )

    assert "시나리오 공통 action catalog를 만들었습니다." in text
    assert "대표 action_type: speech" in text


def test_render_intent_batch_is_human_readable() -> None:
    text = render_structured_response(
        role="observer",
        parsed=ActorIntentStateBatch(
            actor_intent_states=[
                {
                    "actor_id": "ops",
                    "current_intent": "핵심 범위를 다시 정리하게 만든다.",
                    "target_actor_ids": ["cfo"],
                    "supporting_action_type": "speech",
                    "confidence": 0.8,
                    "changed_from_previous": True,
                }
            ]
        ),
        content="",
        log_context=None,
    )

    assert "actor intent 상태를 갱신했습니다." in text
    assert "변경된 intent: 1명" in text


def test_render_actor_card_is_human_readable() -> None:
    text = render_structured_response(
        role="generator",
        parsed=ActorCard(
            cast_id="cast-ops",
            actor_id="ops",
            display_name="운영 총괄",
            role="운영 책임자",
            group_name="운영팀",
            public_profile="공개적으로는 안정적 일정을 강조한다.",
            private_goal="내부 리스크를 먼저 통제하고 싶다.",
            speaking_style="짧고 단호하다.",
            avatar_seed="ops-seed",
            baseline_attention_tier="driver",
            story_function="초기 압박을 직접 밀어 올리는 조율 축이다.",
            preferred_action_types=["speech", "reposition"],
            action_bias_notes=["실행 조정을 선호한다."],
        ),
        content="",
        log_context={"slot_index": 1},
    )

    assert "운영 총괄 역할 카드를 만들었습니다." in text


def test_render_simulation_clock_is_human_readable() -> None:
    text = render_structured_response(
        role="observer",
        parsed=SimulationClockSnapshot(
            total_elapsed_minutes=390,
            total_elapsed_label="6시간 30분",
            last_elapsed_minutes=30,
            last_elapsed_label="30분",
            last_advanced_step_index=4,
        ),
        content="",
        log_context=None,
    )

    assert "시뮬레이션 clock 상태를 갱신했습니다." in text
    assert "누적 시간: 6시간 30분" in text
