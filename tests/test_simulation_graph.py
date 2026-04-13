"""Purpose:
- Verify compact-input hydration and root graph execution.
"""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from types import SimpleNamespace

from simula.application.services import executor as executor_module
from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.simulation.graph import SIMULATION_WORKFLOW_GRAPH
from simula.application.workflow.graphs.simulation.nodes.hydration import (
    hydrate_initial_state,
)
from simula.application.workflow.graphs.simulation.states.initial_state import (
    build_simulation_input_state,
    expand_input_state_to_workflow_state,
)
from simula.domain.contracts import (
    ActorActionProposal,
    ActorCard,
    ExecutionPlanBundle,
    FinalReportSections,
    PlanningAnalysis,
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
        if schema is ExecutionPlanBundle:
            return (
                ExecutionPlanBundle(
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
                    cast_roster={
                        "items": [
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
                    },
                ),
                FakeMeta(),
            )
        if schema is ActorCard:
            if "cast-alpha" in prompt:
                return (
                    ActorCard(
                        cast_id="cast-alpha",
                        actor_id="alpha",
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
                    actor_id="beta",
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
                    selected_actor_ids=["alpha"],
                    deferred_actor_ids=["beta"],
                    focus_slices=[
                        {
                            "slice_id": "focus-1",
                            "title": "직접 압박",
                            "focus_actor_ids": ["alpha"],
                            "visibility": "private",
                            "stakes": "즉시 반응이 필요하다.",
                            "selection_reason": "가장 빠른 상태 변화가 난다.",
                        }
                    ],
                    background_updates=[
                        {
                            "round_index": 1,
                            "actor_id": "beta",
                            "summary": "Beta는 직접 호출되지는 않았지만 반응 압력이 올라간다.",
                            "pressure_level": "medium",
                            "future_hook": "다음 단계에서 직접 응답할 수 있다.",
                        }
                    ],
                ),
                FakeMeta(),
            )
        if schema is ActorActionProposal:
            return (
                ActorActionProposal(
                    action_type="speech",
                    intent="Beta가 재검토를 피하지 못하게 만든다.",
                    intent_target_actor_ids=["beta"],
                    action_summary="Alpha가 비공개로 재검토를 요구한다.",
                    action_detail="지금 바로 결론을 내지 말고 리스크를 다시 보자고 압박한다.",
                    utterance="지금 결론 내리지 말고 리스크를 다시 봅시다.",
                    visibility="private",
                    target_actor_ids=["beta"],
                    thread_id="review-thread",
                ),
                FakeMeta(),
            )
        if schema is RoundResolution:
            return (
                RoundResolution(
                    adopted_actor_ids=["alpha"],
                    updated_intent_states=[
                        {
                            "actor_id": "alpha",
                            "current_intent": "Beta의 결정을 늦춘다.",
                            "thought": "지금 압박해야 다음 선택을 자신에게 유리하게 돌릴 수 있다고 본다.",
                            "target_actor_ids": ["beta"],
                            "supporting_action_type": "speech",
                            "confidence": 0.8,
                            "changed_from_previous": True,
                        },
                        {
                            "actor_id": "beta",
                            "current_intent": "상황을 더 본다.",
                            "thought": "즉시 답하면 밀릴 수 있어 시간을 더 벌고 싶다.",
                            "target_actor_ids": [],
                            "supporting_action_type": "initial_state",
                            "confidence": 0.5,
                            "changed_from_previous": False,
                        },
                    ],
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
        if schema is FinalReportSections:
            return (
                FinalReportSections(
                    conclusion_section="### 최종 상태\n- Alpha의 직접 압박이 결정을 늦췄다.\n### 핵심 이유\n- 마지막 비공개 조율이 흐름을 지배했다.",
                    actor_results_rows="| Alpha | 재검토 관철 | Beta | 우세 | 마지막 압박을 주도했다 |\n| Beta | 판단 유보 | Alpha | 열세 | 즉시 결론을 내지 못했다 |",
                    timeline_section="- 2027-06-18 03:50 | 마무리 단계 | Alpha가 재검토를 요구했다 | Beta의 즉시 결정을 늦췄다.",
                    actor_dynamics_section="### 현재 구도\nAlpha가 직접 압박을 주도하고 Beta가 방어적으로 반응한다.\n### 관계 변화\n후반으로 갈수록 비공개 조율이 공개 신호보다 중요해졌다.",
                    major_events_section="- Alpha가 비공개 재검토를 강하게 요구했다.\n- Beta가 즉시 결정을 미뤘다.",
                ),
                FakeMeta(),
            )
        raise AssertionError(f"unexpected schema: {schema}")


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


def _settings() -> AppSettings:
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
        runtime=RuntimeConfig(max_rounds=1, enable_checkpointing=False),
        storage=StorageConfig(),
    )


def test_root_graph_keeps_compact_stage_order() -> None:
    assert "hydrate_initial_state" in SIMULATION_WORKFLOW_GRAPH.nodes
    assert "planning" in SIMULATION_WORKFLOW_GRAPH.nodes
    assert "generation" in SIMULATION_WORKFLOW_GRAPH.nodes
    assert "runtime" in SIMULATION_WORKFLOW_GRAPH.nodes
    assert "finalization" in SIMULATION_WORKFLOW_GRAPH.nodes


def test_build_simulation_input_state_is_compact() -> None:
    settings = _settings()

    input_state = build_simulation_input_state(
        run_id="run-1",
        scenario_text="scenario",
        scenario_controls={"num_cast": 2, "allow_additional_cast": True},
        settings=settings,
    )

    assert set(input_state) == {
        "run_id",
        "scenario",
        "scenario_controls",
        "max_rounds",
        "rng_seed",
    }
    assert input_state["max_rounds"] == 1


def test_expand_input_state_to_workflow_state_fills_required_defaults() -> None:
    settings = _settings()
    input_state = build_simulation_input_state(
        run_id="run-1",
        scenario_text="scenario",
        scenario_controls={"num_cast": 2, "allow_additional_cast": True},
        settings=settings,
    )

    state = expand_input_state_to_workflow_state(
        input_state=input_state,
        settings=settings,
    )

    assert state["run_id"] == "run-1"
    assert state["checkpoint_enabled"] is False
    assert state["planning_latency_seconds"] == 0.0
    assert state["plan"] == {}
    assert state["scenario_controls"]["num_cast"] == 2
    assert state["scenario_controls"]["allow_additional_cast"] is True
    assert state["round_focus_plan"] == {}
    assert state["final_report_sections"] == {}
def test_hydrate_initial_state_expands_compact_input_for_root_graph() -> None:
    settings = _settings()
    store = FakeStore()
    context = WorkflowRuntimeContext(
        settings=settings,
        store=store,  # type: ignore[arg-type]
        llms=FakeRouter(),  # type: ignore[arg-type]
        logger=logging.getLogger("simula.test.graph"),
        llm_usage_tracker=LLMUsageTracker(),
    )
    input_state = build_simulation_input_state(
        run_id="run-graph",
        scenario_text="2027-06-18 03:20에 시작하는 테스트 시나리오",
        scenario_controls={"num_cast": 2, "allow_additional_cast": True},
        settings=settings,
    )
    hydrated = hydrate_initial_state(
        input_state,
        type("RuntimeWrap", (), {"context": context})(),
    )

    assert hydrated["run_id"] == "run-graph"
    assert hydrated["planning_latency_seconds"] == 0.0
    assert hydrated["round_focus_plan"] == {}
    assert hydrated["final_report_markdown"] == ""


def test_executor_uses_compact_input_state(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeApp:
        async def ainvoke(self, state, **kwargs):  # noqa: ANN001
            captured["state"] = state
            captured["kwargs"] = kwargs
            captured["context_logger_name"] = kwargs["context"].logger.name
            captured["llm_logger_name"] = kwargs["context"].llms.logger.name
            return {
                "run_id": state["run_id"],
                "final_report": {"run_id": state["run_id"]},
                "final_report_markdown": "# 시뮬레이션 결과",
                "simulation_log_jsonl": "{}",
                "stop_reason": "",
                "errors": [],
            }

    class FakeStore:
        def __init__(self) -> None:
            self._run_id = "20260413.1"

        def next_run_id(self) -> str:
            return self._run_id

        def save_run_started(self, **kwargs):  # noqa: ANN003
            return None

        def mark_run_status(self, *args, **kwargs):  # noqa: ANN002, ANN003
            return None

        def close(self) -> None:
            return None

    monkeypatch.setattr(executor_module, "create_app_store", lambda *args, **kwargs: FakeStore())
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
        result = asyncio.run(executor.run_async("scenario"))
    finally:
        executor.close()

    assert result.success is True
    assert captured["state"] == {
        "run_id": "20260413.1",
        "scenario": "scenario",
        "scenario_controls": {"num_cast": 2, "allow_additional_cast": True},
        "max_rounds": 1,
        "rng_seed": captured["state"]["rng_seed"],
    }
    assert captured["context_logger_name"] == "simula.workflow.run.20260413.1"
    assert captured["llm_logger_name"] == "simula.llm.run.20260413.1"


def test_executor_logs_original_failure_traceback(monkeypatch, caplog) -> None:
    class FakeApp:
        async def ainvoke(self, state, **kwargs):  # noqa: ANN001
            del state, kwargs
            raise RuntimeError("boom")

    class FakeStore:
        def __init__(self) -> None:
            self._run_id = "20260413.2"

        def next_run_id(self) -> str:
            return self._run_id

        def save_run_started(self, **kwargs):  # noqa: ANN003
            return None

        def mark_run_status(self, *args, **kwargs):  # noqa: ANN002, ANN003
            return None

        def close(self) -> None:
            return None

    monkeypatch.setattr(executor_module, "create_app_store", lambda *args, **kwargs: FakeStore())
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
