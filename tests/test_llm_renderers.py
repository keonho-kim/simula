"""Purpose:
- Verify the human-readable rendering of current structured contracts.
"""

from __future__ import annotations

from simula.domain.contracts import (
    ActionCatalog,
    ActorActionProposal,
    ActorCard,
    FinalReportSections,
    PlanningAnalysis,
    RuntimeProgressionPlan,
    ScenarioTimeScope,
    StepDirective,
    StepResolution,
    StepTimeAdvanceProposal,
)
from simula.infrastructure.llm.renderers import render_structured_response


def test_render_planning_analysis_is_human_readable() -> None:
    text = render_structured_response(
        role="planner",
        parsed=PlanningAnalysis(
            brief_summary="공개 경쟁과 비공개 계산이 동시에 움직인다.",
            premise="표면적 입장보다 실제 정렬 방향이 중요하다.",
            time_scope=ScenarioTimeScope(
                start="초기 대면 직후",
                end="핵심 선택 직전",
            ),
            public_context=["겉으로는 신중하다."],
            private_context=["속으로는 계산이 많다."],
            key_pressures=["시간 압박", "감정 경쟁"],
            progression_plan=RuntimeProgressionPlan(
                max_steps=4,
                allowed_units=["minute", "hour", "day"],
                default_unit="hour",
                pacing_guidance=["대화는 짧게, 이동은 길게 본다."],
                selection_reason="짧은 반응과 긴 준비 구간이 섞여 있다.",
            ),
        ),
        content="",
        log_context=None,
    )

    assert "계획 분석을 완료했습니다." in text
    assert "중요 변수: 시간 압박, 감정 경쟁" in text


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
            thread_id="",
        ),
        content="",
        log_context={"actor_display_name": "운영 총괄"},
    )

    assert "운영 총괄이 일부 공개 행동을 제안했습니다." in text
    assert "action_type: speech" in text


def test_render_step_directive_is_human_readable() -> None:
    text = render_structured_response(
        role="coordinator",
        parsed=StepDirective(
            step_index=2,
            focus_summary="핵심 압박 축을 직접 따라간다.",
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
                    "step_index": 2,
                    "actor_id": "c",
                    "summary": "배경 압력이 유지된다.",
                    "pressure_level": "medium",
                    "future_hook": "다음 단계에서 전면으로 올라올 수 있다.",
                }
            ],
        ),
        content="",
        log_context=None,
    )

    assert "step 지시를 정했습니다." in text
    assert "선택 actor: 2명" in text


def test_render_step_resolution_is_human_readable() -> None:
    text = render_structured_response(
        role="coordinator",
        parsed=StepResolution(
            adopted_actor_ids=["a"],
            updated_intent_states=[
                {
                    "actor_id": "a",
                    "current_intent": "b를 압박한다.",
                    "target_actor_ids": ["b"],
                    "supporting_action_type": "speech",
                    "confidence": 0.8,
                    "changed_from_previous": True,
                }
            ],
            step_time_advance=StepTimeAdvanceProposal(
                elapsed_unit="minute",
                elapsed_amount=30,
                selection_reason="짧은 직접 반응이 중심이다.",
                signals=["직접 반응"],
            ),
            observer_report={
                "step_index": 2,
                "summary": "직접 action이 쌓이며 압력이 커졌다.",
                "notable_events": ["압박 action"],
                "atmosphere": "긴장",
                "momentum": "medium",
                "world_state_summary": "압력이 커졌다.",
            },
            world_state_summary="압력이 커졌다.",
            stop_reason="",
        ),
        content="",
        log_context=None,
    )

    assert "step 해소 결과를 정리했습니다." in text
    assert "채택 actor: 1명" in text


def test_render_final_report_sections_is_human_readable() -> None:
    text = render_structured_response(
        role="observer",
        parsed=FinalReportSections(
            conclusion_section="### 최종 상태\n- 유지\n### 핵심 이유\n- 유지",
            actor_results_rows="| A | 유지 | B | 우세 | 근거 |",
            timeline_section="- 2027-06-18 03:20 | 시작 단계 | 사건 | 결과",
            actor_dynamics_section="### 현재 구도\nA\n### 관계 변화\nB",
            major_events_section="- 사건",
        ),
        content="",
        log_context=None,
    )

    assert "최종 보고서 번들을 작성했습니다." in text


def test_render_actor_card_is_human_readable() -> None:
    text = render_structured_response(
        role="generator",
        parsed=ActorCard(
            cast_id="cast-ops",
            actor_id="ops",
            display_name="운영 총괄",
            role="실행 조정자",
            group_name="운영팀",
            public_profile="공개적으로는 신중하다.",
            private_goal="일정을 다시 정리하고 싶다.",
            speaking_style="짧고 단호하다.",
            avatar_seed="ops-seed",
            baseline_attention_tier="driver",
            story_function="실행 제약을 전면으로 올린다.",
            preferred_action_types=["speech"],
            action_bias_notes=["짧게 말한다."],
        ),
        content="",
        log_context=None,
    )

    assert "운영 총괄 역할 카드를 만들었습니다." in text


def test_render_action_catalog_is_human_readable() -> None:
    text = render_structured_response(
        role="planner",
        parsed=ActionCatalog(
            actions=[
                {
                    "action_type": "speech",
                    "label": "직접 발화",
                    "description": "직접 말로 의도를 전달한다.",
                    "supported_visibility": ["public", "private", "group"],
                    "requires_target": False,
                    "supports_utterance": True,
                }
            ],
            selection_guidance=["발화는 여러 액션 중 하나다."],
        ),
        content="",
        log_context=None,
    )

    assert "시나리오 공통 action catalog를 만들었습니다." in text
