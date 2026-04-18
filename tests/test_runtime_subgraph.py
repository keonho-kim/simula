"""Purpose:
- Verify runtime subgraph branching with compact doubles.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.runtime import RUNTIME_SUBGRAPH
from simula.application.workflow.graphs.simulation.states.initial_state import (
    build_simulation_input_state,
    expand_input_state_to_workflow_state,
)
from simula.domain.contracts import (
    ActorActionNarrative,
    ActorActionShell,
    ActorIntentSnapshot,
    BackgroundUpdate,
    MajorEventUpdate,
    RoundDirectiveFocusCore,
    RoundResolutionCore,
    RoundResolutionNarrativeBodies,
)
from simula.domain.contracts.shared import ContinuationStopReason
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

    async def ainvoke_object_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
        del role, prompt, kwargs
        self.calls[schema.__name__] = self.calls.get(schema.__name__, 0) + 1
        if schema is RoundDirectiveFocusCore:
            return (
                RoundDirectiveFocusCore(
                    focus_summary="Alpha의 직접 압박을 따라간다.",
                    reason="현재 직접 반응 압력이 가장 높다.",
                    focus_slices=[
                        {
                            "slice_id": "focus-1",
                            "title": "직접 압박",
                            "focus_cast_ids": ["alpha"],
                            "visibility": "private",
                            "stakes": "즉시 반응이 필요하다.",
                            "reason": "가장 빠른 상태 변화가 난다.",
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
                ),
                FakeMeta(),
            )
        if schema is ActorActionNarrative:
            return (
                ActorActionNarrative(
                    goal="Beta의 결정을 재검토로 이끈다.",
                    summary="Alpha가 재검토를 요구한다.",
                    detail="비공개로 다시 판단해야 한다고 압박한다.",
                    utterance="지금 결론 내리지 말고 다시 봅시다.",
                ),
                FakeMeta(),
            )
        if schema is RoundResolutionCore:
            return (
                RoundResolutionCore(
                    adopted_cast_ids=["alpha"],
                    time_advance={
                        "elapsed_unit": "minute",
                        "elapsed_amount": 30,
                        "reason": "짧은 직접 반응이 중심이다.",
                    },
                    world_state_summary="직접 압박이 유지되고 있다.",
                    stop_reason=self.resolution_stop_reason,
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
                        "current_pressures": [
                            "비공개 압박이 다음 선택을 좌우할 수 있다."
                        ],
                        "next_step_notes": [
                            "다음에는 결정을 미루지 못하게 더 직접적으로 묻는다."
                        ],
                    },
                ),
                FakeMeta(),
            )
        raise AssertionError(f"unexpected schema: {schema}")

    async def ainvoke_simple_with_meta(self, role, prompt, annotation, **kwargs):  # noqa: ANN001
        del role, prompt, kwargs
        name = str(annotation)
        self.calls[name] = self.calls.get(name, 0) + 1
        if annotation == list[BackgroundUpdate]:
            return (
                [
                    BackgroundUpdate(
                        round_index=1,
                        cast_id="beta",
                        summary="Beta는 아직 직접 응답을 아끼고 있다.",
                        pressure_level="medium",
                    )
                ],
                FakeMeta(),
            )
        if annotation == list[MajorEventUpdate]:
            return ([], FakeMeta())
        if annotation == list[ActorIntentSnapshot]:
            return (
                [
                    ActorIntentSnapshot(
                        cast_id="alpha",
                        goal="Beta의 결정을 늦춘다.",
                        target_cast_ids=["beta"],
                        confidence=0.8,
                        changed_from_previous=True,
                    ),
                    ActorIntentSnapshot(
                        cast_id="beta",
                        goal="상황을 더 본다.",
                        target_cast_ids=[],
                        confidence=0.5,
                        changed_from_previous=False,
                    ),
                ],
                FakeMeta(),
            )
        if annotation == ContinuationStopReason:
            return (self.continuation_stop_reason, FakeMeta())
        raise AssertionError(f"unexpected annotation: {annotation}")


def _runtime_state(settings: AppSettings) -> dict[str, object]:
    input_state = build_simulation_input_state(
        run_id="runtime-run",
        scenario_text="runtime branching scenario",
        scenario_controls={"num_cast": 2, "allow_additional_cast": True},
        settings=settings,
    )
    state = expand_input_state_to_workflow_state(
        input_state=input_state, settings=settings
    )
    state["planning_analysis"] = {
        "brief_summary": "공개 압박과 비공개 조율이 겹친다.",
        "premise": "표면적 입장보다 실제 정렬 방향이 중요하다.",
        "time_scope": {"start": "초기 대면 직후", "end": "핵심 선택 직전"},
        "key_pressures": ["시간 압박"],
        "progression_plan": {
            "max_rounds": settings.runtime.max_rounds,
            "allowed_elapsed_units": ["minute", "hour"],
            "default_elapsed_unit": "minute",
            "reason": "짧은 직접 반응이 중심이다.",
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
                }
            ],
        },
        "coordination_frame": {
            "focus_policy": "직접 반응 압력이 높은 actor를 우선 본다.",
            "background_policy": "직접 추적하지 않은 actor는 배경 update로만 남긴다.",
            "max_focus_actors": 3,
        },
        "major_events": [],
        "progression_plan": {
            "max_rounds": settings.runtime.max_rounds,
            "allowed_elapsed_units": ["minute", "hour"],
            "default_elapsed_unit": "minute",
            "reason": "짧은 직접 반응이 중심이다.",
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

    result = asyncio.run(
        RUNTIME_SUBGRAPH.ainvoke(_runtime_state(settings), context=context)
    )

    assert result["stop_reason"] == "no_progress"
    assert result["round_index"] == 1
    assert router.calls.get("RoundDirectiveFocusCore", 0) == 1
    assert router.calls.get(str(ContinuationStopReason), 0) == 1
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

    result = asyncio.run(
        RUNTIME_SUBGRAPH.ainvoke(_runtime_state(settings), context=context)
    )

    assert result["stop_reason"] == "simulation_done"
    assert result["round_index"] == 1
    assert router.calls.get("RoundDirectiveFocusCore", 0) == 1
    assert router.calls.get(str(ContinuationStopReason), 0) == 0
    assert len(store.round_artifacts) == 1
