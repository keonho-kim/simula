"""Purpose:
- Verify compact-input hydration and root graph execution.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace

from simula.application.services import executor as executor_module
from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.runtime.graph import RUNTIME_SUBGRAPH
from simula.application.workflow.graphs.simulation.states.initial_state import (
    build_simulation_input_state,
    expand_input_state_to_workflow_state,
)
from simula.domain.contracts import (
    ActorActionNarrative,
    ActorActionShell,
    ActorCard,
    CastRoster,
    CastRosterOutlineBundle,
    ExecutionPlanFrameBundle,
    PlanningAnalysis,
    RoundContinuationDecision,
    RoundDirective,
    RoundResolution,
    TimelineAnchorDecision,
)
from simula.infrastructure.config.models import (
    AppSettings,
    ModelConfig,
    ModelRouterConfig,
    OpenAIProviderConfig,
    RuntimeConfig,
    StorageConfig,
)
from simula.infrastructure.llm.usage import LLMUsageTracker


@dataclass(slots=True)
class FakeMeta:
    parse_failure_count: int = 0
    forced_default: bool = False
    duration_seconds: float = 0.01
    last_content: str = ""
    ttft_seconds: float | None = 0.005
    input_tokens: int | None = 10
    output_tokens: int | None = 20
    total_tokens: int | None = 30


class FakeRouter:
    """Compact root-graph integration router."""

    def __init__(self) -> None:
        self._actor_card_calls = 0

    async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
        del role, kwargs
        if schema is PlanningAnalysis:
            return (
                PlanningAnalysis(
                    brief_summary="공개 압박과 비공개 조율이 겹친다.",
                    premise="표면적 입장보다 실제 정렬 방향이 중요하다.",
                    time_scope={"start": "초기 대면 직후", "end": "핵심 선택 직전"},
                    public_context=["공개 신호가 판세를 흔든다."],
                    private_context=["비공개 조율이 실제 선택을 움직인다."],
                    key_pressures=["시간 압박"],
                    progression_plan={
                        "max_rounds": 1,
                        "allowed_elapsed_units": ["minute", "hour"],
                        "default_elapsed_unit": "minute",
                        "pacing_guidance": ["직접 반응은 짧게 본다."],
                        "selection_reason": "짧은 직접 반응이 중심이다.",
                    },
                ),
                FakeMeta(),
            )
        if schema is CastRosterOutlineBundle:
            return (
                CastRosterOutlineBundle(
                    items=[
                        {
                            "slot_index": 1,
                            "cast_id": "cast-alpha",
                            "display_name": "Alpha",
                        },
                        {
                            "slot_index": 2,
                            "cast_id": "cast-beta",
                            "display_name": "Beta",
                        },
                    ]
                ),
                FakeMeta(),
            )
        if schema is ExecutionPlanFrameBundle:
            return (
                ExecutionPlanFrameBundle(
                    situation={
                        "simulation_objective": "긴장 추적",
                        "world_summary": "짧은 직접 조율이 핵심이다.",
                        "initial_tensions": ["즉시 반응 압력"],
                        "channel_guidance": {
                            "public": "공개 신호에 쓴다.",
                            "private": "비공개 조율에 쓴다.",
                            "group": "소규모 반응 묶음에 쓴다.",
                        },
                        "current_constraints": ["시간이 짧다."],
                    },
                    action_catalog={
                        "actions": [
                            {
                                "action_type": "speech",
                                "label": "직접 발화",
                                "description": "직접 말로 방향을 조정한다.",
                                "supported_visibility": ["public", "private", "group"],
                                "requires_target": False,
                                "supports_utterance": True,
                            }
                        ],
                        "selection_guidance": ["짧고 직접적인 행동을 우선 본다."],
                    },
                    coordination_frame={
                        "focus_selection_rules": ["직접 반응 압력이 높은 actor를 우선 본다."],
                        "background_motion_rules": ["직접 추적하지 않은 actor는 배경 update로만 남긴다."],
                        "focus_archetypes": ["직접 압박"],
                        "attention_shift_rules": ["조용했던 actor도 압력이 올라가면 끌어올린다."],
                        "budget_guidance": ["한 round에는 소수 actor만 직접 호출한다."],
                    },
                    major_events=[],
                ),
                FakeMeta(),
            )
        if schema is CastRoster:
            if '"chunk_index":1' in prompt or '"slot_index":1' in prompt:
                return (
                    CastRoster(
                        items=[
                            {
                                "cast_id": "cast-alpha",
                                "display_name": "Alpha",
                                "role_hint": "선도자",
                                "group_name": "A",
                                "core_tension": "먼저 압박하고 싶다.",
                            },
                            {
                                "cast_id": "cast-beta",
                                "display_name": "Beta",
                                "role_hint": "조정자",
                                "group_name": "B",
                                "core_tension": "즉시 결정을 피하고 싶다.",
                            },
                        ]
                    ),
                    FakeMeta(),
                )
            return (
                CastRoster(
                    items=[
                        {
                            "cast_id": "cast-alpha",
                            "display_name": "Alpha",
                            "role_hint": "선도자",
                            "group_name": "A",
                            "core_tension": "먼저 압박하고 싶다.",
                        },
                        {
                            "cast_id": "cast-beta",
                            "display_name": "Beta",
                            "role_hint": "조정자",
                            "group_name": "B",
                            "core_tension": "즉시 결정을 피하고 싶다.",
                        },
                    ]
                ),
                FakeMeta(),
            )
        if schema is ActorCard:
            self._actor_card_calls += 1
            if self._actor_card_calls == 1:
                return (
                    ActorCard(
                        cast_id="cast-alpha",
                        display_name="Alpha",
                        role="선도자",
                        group_name="A",
                        public_profile="공개적으로는 강경하다.",
                        private_goal="먼저 재검토를 밀어붙인다.",
                        speaking_style="짧고 단호하다.",
                        avatar_seed="alpha-seed",
                        baseline_attention_tier="lead",
                        story_function="직접 압박 축",
                        preferred_action_types=["speech"],
                        action_bias_notes=["먼저 발화한다."],
                    ),
                    FakeMeta(),
                )
            return (
                ActorCard(
                    cast_id="cast-beta",
                    display_name="Beta",
                    role="조정자",
                    group_name="B",
                    public_profile="공개적으로는 신중하다.",
                    private_goal="즉시 결정을 늦춘다.",
                    speaking_style="짧고 신중하다.",
                    avatar_seed="beta-seed",
                    baseline_attention_tier="driver",
                    story_function="응답 조정 축",
                    preferred_action_types=["speech"],
                    action_bias_notes=["바로 확답하지 않는다."],
                ),
                FakeMeta(),
            )
        if schema is RoundDirective:
            return (
                RoundDirective(
                    round_index=1,
                    focus_summary="Alpha의 직접 압박을 따라간다.",
                    selection_reason="현재 직접 반응 압력이 가장 높다.",
                    selected_cast_ids=["alpha"],
                    deferred_cast_ids=["beta"],
                    focus_slices=[
                        {
                            "slice_id": "focus-1",
                            "title": "직접 압박",
                            "focus_cast_ids": ["alpha"],
                            "visibility": "private",
                            "stakes": "즉시 반응이 필요하다.",
                            "selection_reason": "가장 빠른 상태 변화가 난다.",
                        }
                    ],
                    background_updates=[
                        {
                            "round_index": 1,
                            "cast_id": "beta",
                            "summary": "Beta는 직접 호출되지는 않았지만 반응 압력이 올라간다.",
                            "pressure_level": "medium",
                            "future_hook": "다음 단계에서 직접 응답할 수 있다.",
                        }
                    ],
                ),
                FakeMeta(),
            )
        if schema is ActorActionShell:
            return (
                ActorActionShell(
                    action_type="speech",
                    visibility="private",
                    target_cast_ids=["beta"],
                    thread_id="review-thread",
                ),
                FakeMeta(),
            )
        if schema is ActorActionNarrative:
            return (
                ActorActionNarrative(
                    intent="Beta가 재검토를 피하지 못하게 만든다.",
                    intent_target_cast_ids=["beta"],
                    action_summary="Alpha가 비공개로 재검토를 요구한다.",
                    action_detail="지금 바로 결론을 내지 말고 리스크를 다시 보자고 압박한다.",
                    utterance="지금 결론 내리지 말고 리스크를 다시 봅시다.",
                ),
                FakeMeta(),
            )
        if schema is RoundResolution:
            return (
                RoundResolution(
                    adopted_cast_ids=["alpha"],
                    updated_intent_states=[
                        {
                            "cast_id": "alpha",
                            "current_intent": "Beta의 결정을 늦춘다.",
                            "thought": "지금 압박해야 다음 선택을 자신에게 유리하게 돌릴 수 있다고 본다.",
                            "target_cast_ids": ["beta"],
                            "supporting_action_type": "speech",
                            "confidence": 0.8,
                            "changed_from_previous": True,
                        },
                        {
                            "cast_id": "beta",
                            "current_intent": "상황을 더 본다.",
                            "thought": "즉시 답하면 밀릴 수 있어 시간을 더 벌고 싶다.",
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
                        "selection_reason": "짧은 직접 반응이 중심이다.",
                        "signals": ["직접 압박"],
                    },
                    observer_report={
                        "round_index": 1,
                        "summary": "직접 압박이 쌓이며 다음 선택 압력이 커졌다.",
                        "notable_events": ["Alpha가 재검토를 요구했다."],
                        "atmosphere": "긴장",
                        "momentum": "medium",
                        "world_state_summary": "직접 압박과 배경 압력이 함께 누적됐다.",
                    },
                    actor_facing_scenario_digest={
                        "round_index": 1,
                        "relationship_map_summary": "Alpha가 압박을 주도하고 Beta가 방어적으로 반응한다.",
                        "current_pressures": ["비공개 압박이 다음 선택을 좌우할 수 있다."],
                        "talking_points": ["다음에는 결정을 미루지 못하게 더 직접적으로 묻는다."],
                        "avoid_repetition_notes": ["이미 한 요구를 같은 표현으로만 반복하지 않는다."],
                        "recommended_tone": "짧고 단호한 설득 톤",
                        "world_state_summary": "직접 압박과 배경 압력이 함께 누적됐다.",
                    },
                    world_state_summary="직접 압박과 배경 압력이 함께 누적됐다.",
                    stop_reason="",
                ),
                FakeMeta(),
            )
        if schema is TimelineAnchorDecision:
            return (
                TimelineAnchorDecision(
                    anchor_iso="2027-06-18T03:20:00",
                    selection_reason="시나리오에 날짜와 시작 시각이 있다.",
                ),
                FakeMeta(),
            )
        raise AssertionError(f"unexpected schema: {schema}")

    async def ainvoke_text_with_meta(self, role, prompt, **kwargs):  # noqa: ANN001
        del role, prompt
        log_context = kwargs.get("log_context", {})
        section = str(log_context.get("section", ""))
        if section == "conclusion":
            return (
                "### 최종 상태\n- Alpha의 직접 압박이 결정을 늦췄다.\n### 핵심 판단 근거\n- 마지막 비공개 조율이 흐름을 지배했다.",
                FakeMeta(),
            )
        if section == "timeline":
            return (
                "- 2027-06-18 03:20 | 시작 단계 | 긴장이 형성됐다 | 이후 직접 압박이 쉬워졌다.\n"
                "- 2027-06-18 03:50 | 마무리 단계 | Alpha가 재검토를 요구했다 | Beta의 즉시 결정을 늦췄다.",
                FakeMeta(),
            )
        if section == "actor-dynamics":
            return (
                "### 현재 구도\n- Alpha가 직접 압박을 주도하고 Beta가 방어적으로 반응한다.\n"
                "### 관계 변화\n- 후반으로 갈수록 비공개 조율이 공개 신호보다 중요해졌다.",
                FakeMeta(),
            )
        if section == "major-events":
            return (
                "- Alpha가 비공개 재검토를 강하게 요구했다.\n"
                "- Beta가 즉시 결정을 미뤘다.",
                FakeMeta(),
            )
        raise AssertionError(f"unexpected text section: {section}")


class FakeStore:
    """Minimal store double for root-graph execution."""

    def __init__(self) -> None:
        self.plans: list[dict[str, object]] = []
        self.actors: list[list[dict[str, object]]] = []
        self.round_artifacts: list[dict[str, object]] = []
        self.final_reports: list[dict[str, object]] = []

    def save_plan(self, run_id: str, plan: dict[str, object]) -> None:
        self.plans.append({"run_id": run_id, "plan": plan})

    def save_actors(self, run_id: str, actors: list[dict[str, object]]) -> None:
        self.actors.append([{"run_id": run_id, **actor} for actor in actors])

    def save_round_artifacts(
        self,
        run_id: str,
        *,
        activities: list[dict[str, object]],
        observer_report: dict[str, object],
    ) -> None:
        self.round_artifacts.append(
            {
                "run_id": run_id,
                "activities": activities,
                "observer_report": observer_report,
            }
        )

    def save_final_report(self, run_id: str, final_report: dict[str, object]) -> None:
        self.final_reports.append({"run_id": run_id, "final_report": final_report})


def _settings(*, max_rounds: int = 1) -> AppSettings:
    provider = OpenAIProviderConfig(api_key="test-key")
    model = ModelConfig(provider="openai", model="gpt-test", openai=provider)
    return AppSettings(
        models=ModelRouterConfig(
            planner=model,
            generator=model,
            coordinator=model,
            actor=model,
            observer=model,
            fixer=model,
        ),
        runtime=RuntimeConfig(max_rounds=max_rounds, enable_checkpointing=False),
        storage=StorageConfig(),
    )


class RuntimeGraphRouter:
    """Router double for runtime subgraph branching tests."""

    def __init__(
        self,
        *,
        continuation_stop_reason: str = "",
        resolution_stop_reason: str = "",
    ) -> None:
        self.continuation_stop_reason = continuation_stop_reason
        self.resolution_stop_reason = resolution_stop_reason
        self.calls: dict[str, int] = {}

    async def ainvoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
        del role, prompt, kwargs
        self.calls[schema.__name__] = self.calls.get(schema.__name__, 0) + 1
        if schema is RoundDirective:
            return (
                RoundDirective(
                    round_index=1,
                    focus_summary="Alpha의 직접 압박을 따라간다.",
                    selection_reason="현재 직접 반응 압력이 가장 높다.",
                    selected_cast_ids=["alpha"],
                    deferred_cast_ids=["beta"],
                    focus_slices=[
                        {
                            "slice_id": "focus-1",
                            "title": "직접 압박",
                            "focus_cast_ids": ["alpha"],
                            "visibility": "private",
                            "stakes": "즉시 반응이 필요하다.",
                            "selection_reason": "가장 빠른 상태 변화가 난다.",
                        }
                    ],
                    background_updates=[
                        {
                            "round_index": 1,
                            "cast_id": "beta",
                            "summary": "Beta는 아직 직접 응답을 아끼고 있다.",
                            "pressure_level": "medium",
                            "future_hook": "다음 round에 직접 응답할 수 있다.",
                        }
                    ],
                ),
                FakeMeta(),
            )
        if schema is ActorActionShell:
            return (
                ActorActionShell(
                    action_type="speech",
                    visibility="private",
                    target_cast_ids=["beta"],
                    thread_id="review-thread",
                ),
                FakeMeta(),
            )
        if schema is ActorActionNarrative:
            return (
                ActorActionNarrative(
                    intent="Beta의 결정을 재검토로 이끈다.",
                    intent_target_cast_ids=["beta"],
                    action_summary="Alpha가 재검토를 요구한다.",
                    action_detail="비공개로 다시 판단해야 한다고 압박한다.",
                    utterance="지금 결론 내리지 말고 다시 봅시다.",
                ),
                FakeMeta(),
            )
        if schema is RoundResolution:
            return (
                RoundResolution(
                    adopted_cast_ids=["alpha"],
                    updated_intent_states=[
                        {
                            "cast_id": "alpha",
                            "current_intent": "Beta의 결정을 늦춘다.",
                            "thought": "조금 더 압박해야 유리한 흐름이 유지된다고 본다.",
                            "target_cast_ids": ["beta"],
                            "supporting_action_type": "speech",
                            "confidence": 0.8,
                            "changed_from_previous": True,
                        },
                        {
                            "cast_id": "beta",
                            "current_intent": "상황을 더 본다.",
                            "thought": "즉시 답하면 밀릴 수 있어 시간을 더 벌고 싶다.",
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
                        "selection_reason": "짧은 직접 반응이 중심이다.",
                        "signals": ["직접 압박"],
                    },
                    observer_report={
                        "round_index": 1,
                        "summary": "직접 압박이 이어졌다.",
                        "notable_events": ["Alpha가 재검토를 요구했다."],
                        "atmosphere": "긴장",
                        "momentum": "medium",
                        "world_state_summary": "직접 압박이 유지되고 있다.",
                    },
                    actor_facing_scenario_digest={
                        "round_index": 1,
                        "relationship_map_summary": "Alpha가 압박을 주도하고 Beta가 방어적으로 반응한다.",
                        "current_pressures": ["비공개 압박이 다음 선택을 좌우할 수 있다."],
                        "talking_points": ["다음에는 결정을 미루지 못하게 더 직접적으로 묻는다."],
                        "avoid_repetition_notes": ["이미 한 요구를 같은 표현으로만 반복하지 않는다."],
                        "recommended_tone": "짧고 단호한 설득 톤",
                        "world_state_summary": "직접 압박이 유지되고 있다.",
                    },
                    world_state_summary="직접 압박이 유지되고 있다.",
                    stop_reason=self.resolution_stop_reason,
                ),
                FakeMeta(),
            )
        if schema is RoundContinuationDecision:
            return (
                RoundContinuationDecision(stop_reason=self.continuation_stop_reason),
                FakeMeta(),
            )
        raise AssertionError(f"unexpected schema: {schema}")


def _runtime_state(settings: AppSettings) -> dict[str, object]:
    input_state = build_simulation_input_state(
        run_id="runtime-run",
        scenario_text="runtime branching scenario",
        scenario_controls={"num_cast": 2, "allow_additional_cast": True},
        settings=settings,
    )
    state = expand_input_state_to_workflow_state(
        input_state=input_state,
        settings=settings,
    )
    state["planning_analysis"] = {
        "brief_summary": "공개 압박과 비공개 조율이 겹친다.",
        "premise": "표면적 입장보다 실제 정렬 방향이 중요하다.",
        "time_scope": {"start": "초기 대면 직후", "end": "핵심 선택 직전"},
        "public_context": ["공개 신호가 판세를 흔든다."],
        "private_context": ["비공개 조율이 실제 선택을 움직인다."],
        "key_pressures": ["시간 압박"],
        "progression_plan": {
            "max_rounds": settings.runtime.max_rounds,
            "allowed_elapsed_units": ["minute", "hour"],
            "default_elapsed_unit": "minute",
            "pacing_guidance": ["직접 반응은 짧게 본다."],
            "selection_reason": "짧은 직접 반응이 중심이다.",
        },
    }
    state["plan"] = {
        "interpretation": {
            "premise": "표면적 입장보다 실제 정렬 방향이 중요하다.",
            "key_pressures": ["시간 압박"],
        },
        "situation": {
            "simulation_objective": "긴장 추적",
            "world_summary": "짧은 직접 조율이 핵심이다.",
            "initial_tensions": ["즉시 반응 압력"],
            "channel_guidance": {
                "public": "공개 신호에 쓴다.",
                "private": "비공개 조율에 쓴다.",
                "group": "소규모 반응 묶음에 쓴다.",
            },
            "current_constraints": ["시간이 짧다."],
        },
        "action_catalog": {
            "actions": [
                {
                    "action_type": "speech",
                    "label": "직접 발화",
                    "description": "직접 말로 방향을 조정한다.",
                    "supported_visibility": ["public", "private", "group"],
                    "requires_target": False,
                    "supports_utterance": True,
                }
            ],
            "selection_guidance": ["짧고 직접적인 행동을 우선 본다."],
        },
        "coordination_frame": {
            "focus_selection_rules": ["직접 반응 압력이 높은 actor를 우선 본다."],
            "background_motion_rules": ["직접 추적하지 않은 actor는 배경 update로만 남긴다."],
            "focus_archetypes": ["직접 압박"],
            "attention_shift_rules": ["조용했던 actor도 압력이 올라가면 끌어올린다."],
            "budget_guidance": ["한 round에는 소수 actor만 직접 호출한다."],
        },
        "major_events": [],
        "progression_plan": {
            "max_rounds": settings.runtime.max_rounds,
            "allowed_elapsed_units": ["minute", "hour"],
            "default_elapsed_unit": "minute",
            "pacing_guidance": ["직접 반응은 짧게 본다."],
            "selection_reason": "짧은 직접 반응이 중심이다.",
        },
    }
    state["actors"] = [
        {
            "cast_id": "alpha",
            "display_name": "Alpha",
            "role": "선도자",
            "group_name": "A",
            "public_profile": "공개적으로는 강경하다.",
            "private_goal": "먼저 재검토를 밀어붙인다.",
            "speaking_style": "짧고 단호하다.",
            "avatar_seed": "alpha-seed",
            "baseline_attention_tier": "lead",
            "story_function": "직접 압박 축",
            "preferred_action_types": ["speech"],
            "action_bias_notes": ["먼저 발화한다."],
        },
        {
            "cast_id": "beta",
            "display_name": "Beta",
            "role": "조정자",
            "group_name": "B",
            "public_profile": "공개적으로는 신중하다.",
            "private_goal": "즉시 결정을 늦춘다.",
            "speaking_style": "짧고 신중하다.",
            "avatar_seed": "beta-seed",
            "baseline_attention_tier": "driver",
            "story_function": "응답 조정 축",
            "preferred_action_types": ["speech"],
            "action_bias_notes": ["바로 확답하지 않는다."],
        },
    ]
    return state


def test_runtime_subgraph_stops_before_next_round_on_no_progress() -> None:
    settings = _settings(max_rounds=3)
    router = RuntimeGraphRouter(continuation_stop_reason="no_progress")
    store = FakeStore()
    context = WorkflowRuntimeContext(
        settings=settings,
        store=store,  # type: ignore[arg-type]
        llms=router,  # type: ignore[arg-type]
        logger=logging.getLogger("simula.test.runtime_graph"),
        llm_usage_tracker=LLMUsageTracker(),
    )

    result = asyncio.run(RUNTIME_SUBGRAPH.ainvoke(_runtime_state(settings), context=context))

    assert result["stop_reason"] == "no_progress"
    assert result["round_index"] == 1
    assert router.calls.get("RoundDirective", 0) == 1
    assert router.calls.get("ActorActionShell", 0) == 2
    assert router.calls.get("ActorActionNarrative", 0) == 2
    assert router.calls.get("RoundResolution", 0) == 1
    assert router.calls.get("RoundContinuationDecision", 0) == 1
    assert len(store.round_artifacts) == 1


def test_runtime_subgraph_finishes_immediately_on_simulation_done() -> None:
    settings = _settings(max_rounds=3)
    router = RuntimeGraphRouter(resolution_stop_reason="simulation_done")
    store = FakeStore()
    context = WorkflowRuntimeContext(
        settings=settings,
        store=store,  # type: ignore[arg-type]
        llms=router,  # type: ignore[arg-type]
        logger=logging.getLogger("simula.test.runtime_graph"),
        llm_usage_tracker=LLMUsageTracker(),
    )

    result = asyncio.run(RUNTIME_SUBGRAPH.ainvoke(_runtime_state(settings), context=context))

    assert result["stop_reason"] == "simulation_done"
    assert result["round_index"] == 1
    assert router.calls.get("RoundDirective", 0) == 1
    assert router.calls.get("ActorActionShell", 0) == 2
    assert router.calls.get("ActorActionNarrative", 0) == 2
    assert router.calls.get("RoundResolution", 0) == 1
    assert router.calls.get("RoundContinuationDecision", 0) == 0
    assert len(store.round_artifacts) == 1


def test_executor_returns_successful_run_result(monkeypatch) -> None:
    captured: dict[str, object] = {}
    llm_stream_sink = None

    class FakeLLMService:
        def __init__(self) -> None:
            self.logger = logging.getLogger("simula.test.llm")

        def configure_run_logging(self, *, run_id, stream_event_sink):  # noqa: ANN001
            nonlocal llm_stream_sink
            captured["configured_run_id"] = run_id
            llm_stream_sink = stream_event_sink

    class FakeApp:
        async def astream(self, state, **kwargs):  # noqa: ANN001
            captured["state"] = state
            if llm_stream_sink is not None:
                llm_stream_sink(
                    {
                        "event": "llm_call",
                        "event_key": "llm_call:1",
                        "run_id": state["run_id"],
                        "sequence": 1,
                        "role": "planner",
                        "call_kind": "structured",
                        "log_context": {"scope": "planning-analysis"},
                        "prompt": "prompt",
                        "raw_response": '{"brief_summary":"요약"}',
                        "duration_seconds": 0.12,
                        "ttft_seconds": 0.03,
                        "input_tokens": 10,
                        "output_tokens": 20,
                        "total_tokens": 30,
                    }
                )
            yield (
                "custom",
                {
                    "stream": "simulation_log",
                    "entry": {
                        "event": "plan_finalized",
                        "event_key": "plan_finalized",
                        "run_id": state["run_id"],
                        "plan": {"hello": "world"},
                    },
                },
            )
            yield (
                "values",
                {
                    "run_id": state["run_id"],
                    "final_report": {"run_id": state["run_id"]},
                    "final_report_markdown": "# 시뮬레이션 결과",
                    "simulation_log_jsonl": "\n".join(
                        [
                            json.dumps(
                                {
                                    "index": 1,
                                    "event": "simulation_started",
                                    "event_key": "simulation_started",
                                    "run_id": state["run_id"],
                                    "scenario": state["scenario"],
                                    "max_rounds": state["max_rounds"],
                                    "rng_seed": state["rng_seed"],
                                },
                                ensure_ascii=False,
                            ),
                            json.dumps(
                                {
                                    "index": 2,
                                    "event": "plan_finalized",
                                    "event_key": "plan_finalized",
                                    "run_id": state["run_id"],
                                    "plan": {"hello": "world"},
                                },
                                ensure_ascii=False,
                            ),
                            json.dumps(
                                {
                                    "index": 3,
                                    "event": "llm_usage_summary",
                                    "event_key": "llm_usage_summary",
                                    "run_id": state["run_id"],
                                    "llm_usage_summary": {
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
                                },
                                ensure_ascii=False,
                            ),
                        ]
                    ),
                    "stop_reason": "",
                    "errors": [],
                },
            )

    class FakeStore:
        def __init__(self) -> None:
            self._run_id = "20260413.1"
            self.statuses: list[tuple[str, str, str | None]] = []

        def next_run_id(self) -> str:
            return self._run_id

        def save_run_started(self, **kwargs):  # noqa: ANN003
            return None

        def mark_run_status(self, run_id, status, error_text=None):  # noqa: ANN001
            self.statuses.append((run_id, status, error_text))

        def close(self) -> None:
            return None

    fake_store = FakeStore()
    monkeypatch.setattr(executor_module, "create_app_store", lambda *args, **kwargs: fake_store)
    monkeypatch.setattr(
        executor_module,
        "build_model_router",
        lambda settings, usage_tracker: FakeLLMService(),  # noqa: ARG005
    )
    monkeypatch.setattr(executor_module, "SIMULATION_WORKFLOW", FakeApp())

    class _NoCheckpointer:
        async def __aenter__(self):
            return None

        async def __aexit__(self, exc_type, exc, tb):  # noqa: ANN001
            return None

    monkeypatch.setattr(
        executor_module,
        "create_async_checkpointer_context",
        lambda settings: _NoCheckpointer(),
    )

    settings = _settings()
    executor = executor_module.SimulationExecutor(
        settings,
        scenario_controls={"num_cast": 2, "allow_additional_cast": True},
    )
    try:
        result = asyncio.run(executor.run_async("scenario"))
    finally:
        executor.close()

    assert result.success is True
    assert result.run_id == "20260413.1"
    assert result.final_report["run_id"] == "20260413.1"
    assert captured["state"]["scenario"] == "scenario"
    assert captured["state"]["scenario_controls"] == {
        "num_cast": 2,
        "allow_additional_cast": True,
    }
    assert captured["configured_run_id"] == "20260413.1"
    log_path = Path(settings.storage.output_dir) / result.run_id / "simulation.log.jsonl"
    assert log_path.exists()
    lines = [line for line in log_path.read_text(encoding="utf-8").splitlines() if line]
    assert len(lines) == 4
    assert json.loads(lines[0])["event"] == "simulation_started"
    assert json.loads(lines[1])["event"] == "llm_call"
    assert json.loads(lines[2])["event"] == "plan_finalized"
    assert json.loads(lines[3])["event"] == "llm_usage_summary"
    assert result.final_state["simulation_log_jsonl"] == log_path.read_text(
        encoding="utf-8"
    ).rstrip()
    assert fake_store.statuses[-1] == ("20260413.1", "completed", None)


def test_executor_handles_langgraph_v2_streampart_dicts(monkeypatch) -> None:
    captured: dict[str, object] = {}
    llm_stream_sink = None

    class FakeLLMService:
        logger = logging.getLogger("simula.test.llm")

        def configure_run_logging(self, *, run_id: str, stream_event_sink) -> None:  # noqa: ANN001
            nonlocal llm_stream_sink
            captured["configured_run_id"] = run_id
            llm_stream_sink = stream_event_sink

    class FakeApp:
        async def astream(self, state, **kwargs):  # noqa: ANN001
            captured["state"] = state
            if llm_stream_sink is not None:
                llm_stream_sink(
                    {
                        "event": "llm_call",
                        "event_key": "llm_call:1",
                        "run_id": state["run_id"],
                        "sequence": 1,
                        "role": "planner",
                        "call_kind": "structured",
                        "log_context": {"scope": "planning-analysis"},
                        "prompt": "prompt",
                        "raw_response": '{"brief_summary":"요약"}',
                        "duration_seconds": 0.12,
                        "ttft_seconds": 0.03,
                        "input_tokens": 10,
                        "output_tokens": 20,
                        "total_tokens": 30,
                    }
                )
            yield {
                "type": "custom",
                "ns": ("finalization",),
                "data": {
                    "stream": "simulation_log",
                    "entry": {
                        "event": "plan_finalized",
                        "event_key": "plan_finalized",
                        "run_id": state["run_id"],
                        "plan": {"hello": "world"},
                    },
                },
                "interrupts": (),
            }
            yield {
                "type": "values",
                "ns": (),
                "data": {
                    "run_id": state["run_id"],
                    "final_report": {"run_id": state["run_id"]},
                    "final_report_markdown": "# 시뮬레이션 결과\n\n요약",
                    "simulation_log_jsonl": "\n".join(
                        [
                            json.dumps(
                                {
                                    "index": 1,
                                    "event": "simulation_started",
                                    "event_key": "simulation_started",
                                    "run_id": state["run_id"],
                                    "scenario": state["scenario"],
                                    "max_rounds": state["max_rounds"],
                                    "rng_seed": state["rng_seed"],
                                },
                                ensure_ascii=False,
                            ),
                            json.dumps(
                                {
                                    "index": 2,
                                    "event": "plan_finalized",
                                    "event_key": "plan_finalized",
                                    "run_id": state["run_id"],
                                    "plan": {"hello": "world"},
                                },
                                ensure_ascii=False,
                            ),
                            json.dumps(
                                {
                                    "index": 3,
                                    "event": "llm_usage_summary",
                                    "event_key": "llm_usage_summary",
                                    "run_id": state["run_id"],
                                    "llm_usage_summary": {
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
                                },
                                ensure_ascii=False,
                            ),
                        ]
                    ),
                    "stop_reason": "",
                    "errors": [],
                },
                "interrupts": (),
            }

    class FakeStore:
        def __init__(self) -> None:
            self._run_id = "20260413.2"
            self.statuses: list[tuple[str, str, str | None]] = []

        def next_run_id(self) -> str:
            return self._run_id

        def save_run_started(self, **kwargs):  # noqa: ANN003
            return None

        def mark_run_status(self, run_id, status, error_text=None):  # noqa: ANN001
            self.statuses.append((run_id, status, error_text))

        def close(self) -> None:
            return None

    fake_store = FakeStore()
    monkeypatch.setattr(executor_module, "create_app_store", lambda *args, **kwargs: fake_store)
    monkeypatch.setattr(
        executor_module,
        "build_model_router",
        lambda settings, usage_tracker: FakeLLMService(),  # noqa: ARG005
    )
    monkeypatch.setattr(executor_module, "SIMULATION_WORKFLOW", FakeApp())

    class _NoCheckpointer:
        async def __aenter__(self):
            return None

        async def __aexit__(self, exc_type, exc, tb):  # noqa: ANN001
            return None

    monkeypatch.setattr(
        executor_module,
        "create_async_checkpointer_context",
        lambda settings: _NoCheckpointer(),
    )

    settings = _settings()
    executor = executor_module.SimulationExecutor(
        settings,
        scenario_controls={"num_cast": 2, "allow_additional_cast": True},
    )
    try:
        result = asyncio.run(executor.run_async("scenario"))
    finally:
        executor.close()

    assert result.success is True
    assert result.run_id == "20260413.2"
    assert result.final_report == {"run_id": "20260413.2"}
    assert result.final_state["final_report"] == {"run_id": "20260413.2"}
    assert result.final_state["final_report_markdown"] == "# 시뮬레이션 결과\n\n요약"
    assert captured["state"]["scenario"] == "scenario"
    assert captured["configured_run_id"] == "20260413.2"
    log_path = Path(settings.storage.output_dir) / result.run_id / "simulation.log.jsonl"
    assert log_path.exists()
    lines = [line for line in log_path.read_text(encoding="utf-8").splitlines() if line]
    assert len(lines) == 4
    assert json.loads(lines[0])["event"] == "simulation_started"
    assert json.loads(lines[1])["event"] == "llm_call"
    assert json.loads(lines[2])["event"] == "plan_finalized"
    assert json.loads(lines[3])["event"] == "llm_usage_summary"
    assert result.final_state["simulation_log_jsonl"] == log_path.read_text(
        encoding="utf-8"
    ).rstrip()
    assert fake_store.statuses[-1] == ("20260413.2", "completed", None)


def test_executor_logs_original_failure_traceback(monkeypatch, caplog) -> None:
    class FakeApp:
        async def astream(self, state, **kwargs):  # noqa: ANN001
            del kwargs
            yield (
                "custom",
                {
                    "stream": "simulation_log",
                    "entry": {
                        "event": "plan_finalized",
                        "event_key": "plan_finalized",
                        "run_id": state["run_id"],
                        "plan": {"hello": "world"},
                    },
                },
            )
            raise RuntimeError("boom")

    class FakeStore:
        def __init__(self) -> None:
            self._run_id = "20260413.2"
            self.statuses: list[tuple[str, str, str | None]] = []

        def next_run_id(self) -> str:
            return self._run_id

        def save_run_started(self, **kwargs):  # noqa: ANN003
            return None

        def mark_run_status(self, run_id, status, error_text=None):  # noqa: ANN001
            self.statuses.append((run_id, status, error_text))

        def close(self) -> None:
            return None

    fake_store = FakeStore()
    monkeypatch.setattr(executor_module, "create_app_store", lambda *args, **kwargs: fake_store)
    monkeypatch.setattr(
        executor_module,
        "build_model_router",
        lambda settings, usage_tracker: SimpleNamespace(  # noqa: ARG005
            logger=logging.getLogger("simula.test.llm")
        ),
    )
    monkeypatch.setattr(executor_module, "SIMULATION_WORKFLOW", FakeApp())

    class _NoCheckpointer:
        async def __aenter__(self):
            return None

        async def __aexit__(self, exc_type, exc, tb):  # noqa: ANN001
            return None

    monkeypatch.setattr(
        executor_module,
        "create_async_checkpointer_context",
        lambda settings: _NoCheckpointer(),
    )

    settings = _settings()
    executor = executor_module.SimulationExecutor(
        settings,
        scenario_controls={"num_cast": 2, "allow_additional_cast": True},
    )
    try:
        with caplog.at_level(logging.ERROR, logger="simula"):
            result = asyncio.run(executor.run_async("scenario"))
    finally:
        executor.close()

    assert result.success is False
    assert result.error == "boom"
    assert "run 실패" in caplog.text
    assert "RuntimeError: boom" in caplog.text
    log_path = Path(settings.storage.output_dir) / result.run_id / "simulation.log.jsonl"
    assert log_path.exists()
    lines = [line for line in log_path.read_text(encoding="utf-8").splitlines() if line]
    assert len(lines) == 2
    assert json.loads(lines[0])["event"] == "simulation_started"
    assert json.loads(lines[1])["event"] == "plan_finalized"
    assert fake_store.statuses[-1][0] == "20260413.2"
    assert fake_store.statuses[-1][1] == "failed"
