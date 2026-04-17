"""Purpose:
- Verify runtime subgraph branching with compact doubles.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.runtime.graph import RUNTIME_SUBGRAPH
from simula.application.workflow.graphs.simulation.states.initial_state import (
    build_simulation_input_state,
    expand_input_state_to_workflow_state,
)
from simula.domain.contracts import (
    ActorActionNarrative,
    ActorActionShell,
    ActorIntentStateBatch,
    BackgroundUpdateBatch,
    MajorEventUpdateBatch,
    RoundContinuationDecision,
    RoundDirectiveFocusCore,
    RoundResolutionCore,
    RoundResolutionNarrativeBodies,
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


class FakeStore:
    """Minimal store double for runtime subgraph execution."""

    def __init__(self) -> None:
        self.round_artifacts: list[dict[str, object]] = []

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


def _settings(*, max_rounds: int = 1, output_dir: str = "./output") -> AppSettings:
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
        storage=StorageConfig(output_dir=output_dir),
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
        if schema is RoundDirectiveFocusCore:
            return (
                RoundDirectiveFocusCore(
                    focus_summary="Alpha의 직접 압박을 따라간다.",
                    selection_reason="현재 직접 반응 압력이 가장 높다.",
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
                ),
                FakeMeta(),
            )
        if schema is BackgroundUpdateBatch:
            return (
                BackgroundUpdateBatch(
                    background_updates=[
                        {
                            "round_index": 1,
                            "cast_id": "beta",
                            "summary": "Beta는 아직 직접 응답을 아끼고 있다.",
                            "pressure_level": "medium",
                            "future_hook": "다음 round에 직접 응답할 수 있다.",
                        }
                    ]
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
        if schema is RoundResolutionCore:
            return (
                RoundResolutionCore(
                    adopted_cast_ids=["alpha"],
                    round_time_advance={
                        "elapsed_unit": "minute",
                        "elapsed_amount": 30,
                        "selection_reason": "짧은 직접 반응이 중심이다.",
                        "signals": ["직접 압박"],
                    },
                    world_state_summary="직접 압박이 유지되고 있다.",
                    stop_reason=self.resolution_stop_reason,
                ),
                FakeMeta(),
            )
        if schema is MajorEventUpdateBatch:
            return (MajorEventUpdateBatch(event_updates=[]), FakeMeta())
        if schema is ActorIntentStateBatch:
            return (
                ActorIntentStateBatch(
                    actor_intent_states=[
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
                    ]
                ),
                FakeMeta(),
            )
        if schema is RoundResolutionNarrativeBodies:
            return (
                RoundResolutionNarrativeBodies(
                    observer_report={
                        "summary": "직접 압박이 이어졌다.",
                        "notable_events": ["Alpha가 재검토를 요구했다."],
                        "atmosphere": "긴장",
                        "momentum": "medium",
                    },
                    actor_facing_scenario_digest={
                        "relationship_map_summary": "Alpha가 압박을 주도하고 Beta가 방어적으로 반응한다.",
                        "current_pressures": ["비공개 압박이 다음 선택을 좌우할 수 있다."],
                        "talking_points": ["다음에는 결정을 미루지 못하게 더 직접적으로 묻는다."],
                        "avoid_repetition_notes": ["이미 한 요구를 같은 표현으로만 반복하지 않는다."],
                        "recommended_tone": "짧고 단호한 설득 톤",
                    },
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
    state = expand_input_state_to_workflow_state(input_state=input_state, settings=settings)
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
    assert router.calls.get("RoundDirectiveFocusCore", 0) == 1
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
    assert router.calls.get("RoundDirectiveFocusCore", 0) == 1
    assert router.calls.get("RoundContinuationDecision", 0) == 0
    assert len(store.round_artifacts) == 1
