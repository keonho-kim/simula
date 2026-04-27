"""Verify the single-mode fast workflow subgraphs."""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass

import pytest

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.finalization import FINALIZATION_SUBGRAPH
from simula.application.workflow.graphs.generation import (
    GENERATION_SUBGRAPH,
    GENERATION_SUBGRAPH_SERIAL,
)
from simula.application.workflow.graphs.planning import PLANNING_SUBGRAPH
from simula.application.workflow.graphs.planning.graph import PLANNING_SUBGRAPH_SERIAL
from simula.application.workflow.graphs.simulation.states.initial_state import (
    build_simulation_input_state,
    expand_input_state_to_workflow_state,
)
from simula.domain.contracts import (
    ActionCatalog,
    ActorCard,
    ActorRosterBundle,
    CastRosterItem,
    CastRosterOutlineItem,
    CoordinationFrame,
    FinalReportDraft,
    MajorEventPlanItem,
    PlanningAnalysis,
    SituationBundle,
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
    fixer_used: bool = False


class FakeStore:
    def __init__(self) -> None:
        self.plans: list[dict[str, object]] = []
        self.actors: list[list[dict[str, object]]] = []
        self.final_reports: list[dict[str, object]] = []

    def save_plan(self, run_id: str, plan: dict[str, object]) -> None:
        del run_id
        self.plans.append(plan)

    def save_actors(self, run_id: str, actors: list[dict[str, object]]) -> None:
        del run_id
        self.actors.append(actors)

    def save_final_report(self, run_id: str, report: dict[str, object]) -> None:
        del run_id
        self.final_reports.append(report)


class FastPathRouter:
    def __init__(self) -> None:
        self.calls: dict[str, int] = {}
        self.call_order: list[str] = []
        self.major_event_latest_round = 2

    async def ainvoke_object_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
        del role
        self.calls[schema.__name__] = self.calls.get(schema.__name__, 0) + 1
        self.call_order.append(schema.__name__)
        if schema is PlanningAnalysis:
            return (_planning_analysis(), FakeMeta())
        if schema is SituationBundle:
            return (_situation(), FakeMeta())
        if schema is ActionCatalog:
            semantic_validator = kwargs["semantic_validator"]
            catalog = _action_catalog()
            assert semantic_validator(catalog) == []
            return (catalog, FakeMeta())
        if schema is CoordinationFrame:
            return (_coordination_frame(), FakeMeta())
        if schema is ActorRosterBundle:
            assigned_json = prompt.split("# Assigned cast items\n", maxsplit=1)[1]
            cast_ids = re.findall(r'"cast_id":"([^"]+)"', assigned_json)
            actors = [
                _actor(cast_id=cast_id, display_name=f"Actor {cast_id[1:]}")
                for cast_id in cast_ids
            ]
            return (ActorRosterBundle(actors=actors), FakeMeta())
        if schema is FinalReportDraft:
            return (
                FinalReportDraft(
                    conclusion_section="### 최종 상태\n- 결론이 정리됐다.\n### 핵심 판단 근거\n- 행동 흐름이 근거다.",
                    actor_dynamics_section="### 현재 구도\n- Alpha가 압박한다.\n### 관계 변화\n- Beta가 반응한다.",
                    major_events_section="- 주요 사건이 처리됐다.",
                ),
                FakeMeta(),
            )
        raise AssertionError(f"unexpected schema: {schema}")

    async def ainvoke_simple_with_meta(self, role, prompt, annotation, **kwargs):  # noqa: ANN001
        del role
        name = str(annotation)
        self.calls[name] = self.calls.get(name, 0) + 1
        self.call_order.append(name)
        if annotation == list[CastRosterOutlineItem]:
            return (
                [
                    CastRosterOutlineItem(
                        slot_index=1,
                        cast_id="c1",
                        display_name="Actor 1",
                    ),
                    CastRosterOutlineItem(
                        slot_index=2,
                        cast_id="c2",
                        display_name="Actor 2",
                    ),
                ],
                FakeMeta(),
            )
        if annotation == list[MajorEventPlanItem]:
            assert "Valid action types:" in prompt
            assert '"speech"' in prompt
            repair_context = kwargs["repair_context"]
            assert repair_context["valid_action_types"] == ["speech"]
            parsed = [
                MajorEventPlanItem(
                    event_id="e1",
                    title="Decision",
                    summary="The decision happens.",
                    participant_cast_ids=["c1", "c2"],
                    earliest_round=1,
                    latest_round=self.major_event_latest_round,
                    completion_action_types=["speech"],
                    completion_signals=["decision"],
                    must_resolve=True,
                )
            ]
            semantic_validator = kwargs["semantic_validator"]
            issues = semantic_validator(parsed)
            if self.major_event_latest_round <= 2:
                assert issues == []
            return (parsed, FakeMeta())
        if annotation == list[CastRosterItem]:
            assigned_json = prompt.split("Assigned outline JSON:\n", maxsplit=1)[1]
            cast_ids = re.findall(r'"cast_id":"([^"]+)"', assigned_json)
            return (
                [
                    CastRosterItem(
                        cast_id=cast_id,
                        display_name=f"Actor {cast_id[1:]}",
                        role_hint="Role",
                        group_name="G",
                        core_tension="Tension",
                    )
                    for cast_id in cast_ids
                ],
                FakeMeta(),
            )
        raise AssertionError(f"unexpected annotation: {annotation}")


def _settings(
    *,
    max_rounds: int = 2,
    actor_roster_chunk_size: int = 6,
) -> AppSettings:
    provider = OpenAIProviderConfig(api_key="test-key")
    model = ModelConfig(provider="openai", model="gpt-test", openai=provider)
    return AppSettings(
        models=ModelRouterConfig(
            planner=model,
            generator=model,
            coordinator=model,
            observer=model,
            fixer=model,
        ),
        runtime=RuntimeConfig(
            max_rounds=max_rounds,
            actor_roster_chunk_size=actor_roster_chunk_size,
            enable_checkpointing=False,
        ),
        storage=StorageConfig(output_dir="./output"),
    )


def _context(settings: AppSettings, router: FastPathRouter, store: FakeStore):
    return WorkflowRuntimeContext(
        settings=settings,
        store=store,  # type: ignore[arg-type]
        llms=router,  # type: ignore[arg-type]
        logger=logging.getLogger("simula.test.fast_path"),
        llm_usage_tracker=LLMUsageTracker(),
    )


def _initial_state(settings: AppSettings) -> dict[str, object]:
    input_state = build_simulation_input_state(
        run_id="fast-run",
        scenario_text="Alpha and Beta must decide at 2000-01-01 09:00.",
        scenario_controls={"num_cast": 2, "allow_additional_cast": False},
        settings=settings,
    )
    return expand_input_state_to_workflow_state(
        input_state=input_state,
        settings=settings,
    )


def test_planning_serial_subgraph_builds_field_bundles_in_order() -> None:
    settings = _settings()
    router = FastPathRouter()
    store = FakeStore()

    result = asyncio.run(
        PLANNING_SUBGRAPH_SERIAL.ainvoke(
            _initial_state(settings),
            context=_context(settings, router, store),
        )
    )

    assert router.call_order[:6] == [
        "PlanningAnalysis",
        "list[simula.domain.contracts.planning.CastRosterOutlineItem]",
        "SituationBundle",
        "ActionCatalog",
        "CoordinationFrame",
        "list[simula.domain.contracts.planning.MajorEventPlanItem]",
    ]
    assert result["plan"]["cast_roster"][0]["cast_id"] == "c1"
    assert result["planned_max_rounds"] == 2
    assert len(store.plans) == 1


def test_planning_parallel_subgraph_uses_split_contracts() -> None:
    settings = _settings()
    router = FastPathRouter()
    store = FakeStore()

    result = asyncio.run(
        PLANNING_SUBGRAPH.ainvoke(
            _initial_state(settings),
            context=_context(settings, router, store),
        )
    )

    assert router.calls["PlanningAnalysis"] == 1
    assert router.calls["SituationBundle"] == 1
    assert router.calls["ActionCatalog"] == 1
    assert router.calls["CoordinationFrame"] == 1
    assert (
        router.calls["list[simula.domain.contracts.planning.MajorEventPlanItem]"]
        == 1
    )
    assert result["plan"]["major_events"][0]["completion_action_types"] == ["speech"]


def test_planning_subgraph_rejects_events_outside_planned_rounds() -> None:
    settings = _settings(max_rounds=6)
    router = FastPathRouter()
    store = FakeStore()
    router.major_event_latest_round = 4

    with pytest.raises(ValueError, match="planned max round 2"):
        asyncio.run(
            PLANNING_SUBGRAPH_SERIAL.ainvoke(
                _initial_state(settings),
                context=_context(settings, router, store),
            )
        )


def test_generation_serial_bundles_up_to_six_actors_in_one_call() -> None:
    settings = _settings()
    router = FastPathRouter()
    store = FakeStore()
    state = _state_with_plan(settings, cast_count=6)

    result = asyncio.run(
        GENERATION_SUBGRAPH_SERIAL.ainvoke(
            state,
            context=_context(settings, router, store),
        )
    )

    assert router.calls == {"ActorRosterBundle": 1}
    assert len(result["actors"]) == 6
    assert len(store.actors[0]) == 6


def test_generation_parallel_fans_out_actor_roster_chunks() -> None:
    settings = _settings()
    router = FastPathRouter()
    store = FakeStore()
    state = _state_with_plan(settings, cast_count=7)

    result = asyncio.run(
        GENERATION_SUBGRAPH.ainvoke(
            state,
            context=_context(settings, router, store),
        )
    )

    assert router.calls == {"ActorRosterBundle": 2}
    assert [actor["cast_id"] for actor in result["actors"]] == [
        "c1",
        "c2",
        "c3",
        "c4",
        "c5",
        "c6",
        "c7",
    ]


def test_generation_uses_configured_actor_roster_chunk_size() -> None:
    settings = _settings(actor_roster_chunk_size=4)
    router = FastPathRouter()
    store = FakeStore()
    state = _state_with_plan(settings, cast_count=5)

    result = asyncio.run(
        GENERATION_SUBGRAPH_SERIAL.ainvoke(
            state,
            context=_context(settings, router, store),
        )
    )

    assert router.calls == {"ActorRosterBundle": 2}
    assert len(result["actors"]) == 5


def test_finalization_subgraph_uses_single_report_draft_call() -> None:
    settings = _settings()
    router = FastPathRouter()
    store = FakeStore()
    state = _state_for_finalization(settings)

    result = asyncio.run(
        FINALIZATION_SUBGRAPH.ainvoke(
            state,
            context=_context(settings, router, store),
        )
    )

    assert router.calls == {"FinalReportDraft": 1}
    assert "## 시뮬레이션 결론" in result["final_report_markdown"]
    assert len(store.final_reports) == 1


def _planning_analysis() -> PlanningAnalysis:
    return PlanningAnalysis(
        brief_summary="Alpha and Beta decide quickly.",
        premise="A short decision pressure controls the scenario.",
        time_scope={"start": "start", "end": "decision"},
        key_pressures=["decision pressure"],
        progression_plan={
            "max_rounds": 2,
            "allowed_elapsed_units": ["minute", "hour"],
            "default_elapsed_unit": "minute",
            "reason": "Short exchanges matter.",
        },
    )


def _situation() -> SituationBundle:
    return SituationBundle(
        simulation_objective="Track the decision.",
        world_summary="A compact decision scene.",
        initial_tensions=["pressure"],
        channel_guidance={
            "public": "open",
            "private": "direct",
            "group": "small group",
        },
        current_constraints=["time"],
    )


def _action_catalog() -> ActionCatalog:
    return ActionCatalog(
        actions=[
            {
                "action_type": "speech",
                "label": "Speech",
                "description": "Speak directly.",
                "supported_visibility": ["public", "private", "group"],
                "requires_target": False,
            }
        ]
    )


def _coordination_frame() -> CoordinationFrame:
    return CoordinationFrame(
        focus_policy="Focus direct pressure.",
        background_policy="Keep background compact.",
        max_focus_actors=3,
    )


def _actor(*, cast_id: str, display_name: str) -> ActorCard:
    return ActorCard(
        cast_id=cast_id,
        display_name=display_name,
        role="Decision actor",
        narrative_profile="Decision pressure.",
        private_goal="Move the decision.",
        voice="Direct.",
        preferred_action_types=["speech"],
    )


def _state_with_plan(settings: AppSettings, *, cast_count: int) -> dict[str, object]:
    state = _initial_state(settings)
    state["plan"] = {
        "interpretation": {"premise": "Decision.", "key_pressures": ["pressure"]},
        "situation": {
            "simulation_objective": "Track.",
            "world_summary": "World.",
        },
        "action_catalog": {
            "actions": [
                {
                    "action_type": "speech",
                    "label": "Speech",
                    "description": "Speak.",
                    "supported_visibility": ["public", "private", "group"],
                    "requires_target": False,
                }
            ]
        },
        "coordination_frame": {"focus_policy": "Focus.", "background_policy": "Bg."},
        "cast_roster": [
            {
                "cast_id": f"c{index}",
                "display_name": f"Actor {index}",
                "role_hint": "Role",
                "group_name": "G",
                "core_tension": "Tension",
            }
            for index in range(1, cast_count + 1)
        ],
        "major_events": [],
    }
    return state


def _state_for_finalization(settings: AppSettings) -> dict[str, object]:
    state = _initial_state(settings)
    state["plan"] = _state_with_plan(settings, cast_count=2)["plan"]
    state["actors"] = [
        _actor(cast_id="c1", display_name="Actor 1").model_dump(mode="json"),
        _actor(cast_id="c2", display_name="Actor 2").model_dump(mode="json"),
    ]
    state["activities"] = [
        {
            "activity_id": "a1",
            "run_id": "fast-run",
            "round_index": 1,
            "source_cast_id": "c1",
            "visibility": "public",
            "target_cast_ids": ["c2"],
            "visibility_scope": ["all"],
            "action_type": "speech",
            "goal": "Move the decision.",
            "summary": "Actor 1 speaks.",
            "detail": "Actor 1 moves the decision.",
            "utterance": "",
            "thread_id": "",
            "created_at": "2000-01-01T09:00:00",
        }
    ]
    state["observer_reports"] = [
        {
            "round_index": 1,
            "summary": "The decision moved.",
            "notable_events": ["Actor 1 spoke."],
            "atmosphere": "focused",
            "momentum": "medium",
            "world_state_summary": "The decision moved.",
        }
    ]
    state["simulation_clock"] = {
        "total_elapsed_minutes": 30,
        "total_elapsed_label": "30분",
        "last_elapsed_minutes": 30,
        "last_elapsed_label": "30분",
        "last_advanced_round_index": 1,
    }
    state["round_time_history"] = [
        {
            "round_index": 1,
            "elapsed_label": "30분",
            "total_elapsed_minutes": 30,
            "total_elapsed_label": "30분",
        }
    ]
    state["round_index"] = 1
    state["world_state_summary"] = "The decision moved."
    return state
