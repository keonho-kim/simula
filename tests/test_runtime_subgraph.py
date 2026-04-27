"""Purpose:
- Verify the current scene-tick runtime graph.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.runtime import RUNTIME_SUBGRAPH
from simula.application.workflow.graphs.runtime.graph import RUNTIME_SUBGRAPH_GRAPH
from simula.application.workflow.graphs.runtime.utils.agent_state import (
    build_initial_actor_agent_states,
)
from simula.application.workflow.graphs.runtime.utils.candidates import (
    build_action_candidates,
)
from simula.application.workflow.graphs.runtime.utils.planning import (
    build_simulation_plan,
)
from simula.application.workflow.graphs.runtime.utils.scene_delta import (
    scene_delta_validator,
)
from simula.application.workflow.graphs.runtime.utils.scene_logging import (
    actor_name_by_id,
    render_candidates_for_log,
    render_scene_beats_for_log,
)
from simula.application.workflow.graphs.runtime.utils.scene_selection import (
    select_next_event,
    select_scene_actors,
)
from simula.application.workflow.graphs.simulation.states.initial_state import (
    build_simulation_input_state,
    expand_input_state_to_workflow_state,
)
from simula.domain.contracts import SceneDelta
from simula.domain.event_memory import build_event_memory
from simula.infrastructure.config.models import (
    AppSettings,
    ModelConfig,
    ModelRouterConfig,
    OpenAIProviderConfig,
    RuntimeConfig,
    StorageConfig,
)
from simula.infrastructure.llm.usage import LLMUsageTracker
from simula.shared.io.run_jsonl import RunJsonlAppender


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


class SceneDeltaRouter:
    """Router double for the current runtime contract."""

    def __init__(self, *, malformed_first: bool = False) -> None:
        self.malformed_first = malformed_first
        self.calls: dict[str, int] = {}

    async def ainvoke_object_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
        del role, prompt
        self.calls[schema.__name__] = self.calls.get(schema.__name__, 0) + 1
        if schema is not SceneDelta:
            raise AssertionError(f"unexpected schema: {schema}")
        if self.malformed_first:
            default_payload = kwargs["default_payload"]
            return (
                SceneDelta.model_validate(default_payload),
                FakeMeta(parse_failure_count=1, forced_default=True),
            )
        return (
            SceneDelta(
                selected_event_id="evt-board",
                scene_beats=[
                    {
                        "beat_id": "B1",
                        "candidate_id": "C1",
                        "source_cast_id": "alpha",
                        "target_cast_ids": ["beta"],
                        "intent": "Force a direct board decision before delay hardens.",
                        "action_type": "speech",
                        "summary": "Alpha demands an immediate board decision.",
                        "detail": "Alpha cuts through the hesitation and frames delay as the riskiest option.",
                        "utterance": "지금 결정을 미루면 선택지가 사라집니다.",
                        "reaction": "Beta is forced to answer the demand in front of the board.",
                        "emotional_tone": "urgent",
                        "event_effect": "The board decision pressure becomes explicit.",
                    }
                ],
                intent_updates=[
                    {
                        "cast_id": "alpha",
                        "goal": "Force a direct board decision.",
                        "target_cast_ids": ["beta"],
                        "confidence": 0.8,
                        "changed_from_previous": True,
                    }
                ],
                event_updates=[
                    {
                        "event_id": "evt-board",
                        "status": "completed",
                        "progress_summary": "The board decision moved through a direct action.",
                        "matched_activity_ids": [],
                    }
                ],
                world_state_summary="Alpha pushed the board decision forward.",
                time_advance={
                    "elapsed_unit": "minute",
                    "elapsed_amount": 30,
                    "reason": "The scene is a short direct exchange.",
                },
                stop_reason="",
                debug_rationale="C1 directly matches the selected event.",
            ),
            FakeMeta(),
        )


def _settings(
    *,
    max_rounds: int = 1,
    output_dir: str = "./output",
    max_scene_actors: int = 3,
    max_scene_candidates: int = 6,
    max_scene_beats: int = 3,
) -> AppSettings:
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
        runtime=RuntimeConfig(
            max_rounds=max_rounds,
            max_scene_actors=max_scene_actors,
            max_scene_candidates=max_scene_candidates,
            max_scene_beats=max_scene_beats,
            enable_checkpointing=False,
        ),
        storage=StorageConfig(output_dir=output_dir),
    )


def _plan(settings: AppSettings) -> dict[str, Any]:
    return {
        "interpretation": {
            "premise": "A board decision is under pressure.",
            "key_pressures": ["time pressure"],
        },
        "situation": {
            "simulation_objective": "Track the board decision.",
            "world_summary": "A short board exchange is decisive.",
            "initial_tensions": ["immediate board pressure"],
            "channel_guidance": {
                "public": "Use for open signals.",
                "private": "Use for direct pressure.",
                "group": "Use for a small group exchange.",
            },
            "current_constraints": ["Time is short."],
        },
        "action_catalog": {
            "actions": [
                {
                    "action_type": "speech",
                    "label": "Direct speech",
                    "description": "Move the scene through a direct statement.",
                    "supported_visibility": ["public", "private", "group"],
                    "requires_target": False,
                }
            ],
        },
        "coordination_frame": {
            "focus_policy": "Prefer actors under direct event pressure.",
            "background_policy": "Keep others in compact background state.",
            "max_focus_actors": 3,
        },
        "major_events": [
            {
                "event_id": "evt-board",
                "title": "Board decision",
                "summary": "The board must decide whether to continue.",
                "participant_cast_ids": ["alpha", "beta"],
                "earliest_round": 1,
                "latest_round": settings.runtime.max_rounds,
                "completion_action_types": ["speech"],
                "completion_signals": ["decision"],
                "must_resolve": True,
            }
        ],
        "progression_plan": {
            "max_rounds": settings.runtime.max_rounds,
            "allowed_elapsed_units": ["minute", "hour"],
            "default_elapsed_unit": "minute",
            "reason": "Short exchanges drive the scenario.",
        },
    }


def _actors() -> list[dict[str, Any]]:
    return [
        {
            "cast_id": "alpha",
            "display_name": "Alpha",
            "role": "Founder",
            "narrative_profile": "Decision pressure.",
            "private_goal": "Force a direct board decision.",
            "voice": "Short and firm.",
            "preferred_action_types": ["speech"],
        },
        {
            "cast_id": "beta",
            "display_name": "Beta",
            "role": "Director",
            "narrative_profile": "Response pressure.",
            "private_goal": "Delay the decision.",
            "voice": "Measured.",
            "preferred_action_types": ["speech"],
        },
    ]


def _extra_actor(cast_id: str) -> dict[str, Any]:
    return {
        "cast_id": cast_id,
        "display_name": cast_id.title(),
        "role": "Observer",
        "narrative_profile": "Additional pressure.",
        "private_goal": "Shape the decision.",
        "voice": "Brief.",
        "preferred_action_types": ["speech"],
    }


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
        "brief_summary": "A board pressure test.",
        "premise": "The board decision is time-sensitive.",
        "time_scope": {"start": "start", "end": "decision"},
        "key_pressures": ["time pressure"],
        "progression_plan": _plan(settings)["progression_plan"],
    }
    state["plan"] = _plan(settings)
    state["actors"] = _actors()
    return state


def test_simulation_plan_uses_stable_unique_symbols() -> None:
    settings = _settings(max_rounds=2)
    simulation_plan = build_simulation_plan(
        plan=_plan(settings),
        actors=_actors(),
        max_rounds=settings.runtime.max_rounds,
        max_recipients_per_message=2,
        max_scene_actors=settings.runtime.max_scene_actors,
        max_scene_candidates=settings.runtime.max_scene_candidates,
        max_scene_beats=settings.runtime.max_scene_beats,
    )

    assert simulation_plan.symbol_table.actors == {"alpha": "A1", "beta": "A2"}
    assert simulation_plan.symbol_table.events == {"evt-board": "E1"}
    assert simulation_plan.symbol_table.actions == {"speech": "T1"}
    assert simulation_plan.actor_policies[0].allowed_action_types == ["speech"]
    assert simulation_plan.actor_policies[0].current_intent == (
        "Force a direct board decision."
    )
    assert simulation_plan.actor_policies[0].pressure_level == 2


def test_runtime_graph_exposes_split_scene_nodes() -> None:
    assert set(RUNTIME_SUBGRAPH_GRAPH.nodes) == {
        "initialize_runtime_state",
        "select_scene_event",
        "build_scene_candidates",
        "invoke_scene_delta",
        "apply_scene_delta",
    }


def test_initial_actor_agent_states_are_created_from_policies() -> None:
    settings = _settings(max_rounds=2)
    simulation_plan = build_simulation_plan(
        plan=_plan(settings),
        actors=_actors(),
        max_rounds=settings.runtime.max_rounds,
        max_recipients_per_message=2,
        max_scene_actors=settings.runtime.max_scene_actors,
        max_scene_candidates=settings.runtime.max_scene_candidates,
        max_scene_beats=settings.runtime.max_scene_beats,
    )

    states = build_initial_actor_agent_states(
        actors=_actors(),
        simulation_plan=simulation_plan,
    )

    assert states[0]["cast_id"] == "alpha"
    assert states[0]["current_intent"] == "Force a direct board decision."
    assert states[0]["pressure_level"] == 2
    assert states[0]["hidden_information"] == ["Force a direct board decision."]


def test_scene_delta_requires_scene_beats() -> None:
    with pytest.raises(ValueError, match="scene_beats"):
        SceneDelta(
            selected_event_id="evt-board",
            scene_beats=[],
            intent_updates=[],
            event_updates=[],
            world_state_summary="The scene has no action.",
            time_advance={
                "elapsed_unit": "minute",
                "elapsed_amount": 1,
                "reason": "No action.",
            },
            stop_reason="",
            debug_rationale="Invalid empty scene beat list.",
        )


def testscene_delta_validator_rejects_unknown_beat_candidate() -> None:
    validator = scene_delta_validator(
        selected_event_id="evt-board",
        scene_actor_ids=["alpha"],
        candidate_ids=["C1"],
        candidates=[
            {
                "candidate_id": "C1",
                "source_cast_id": "alpha",
                "target_cast_ids": [],
                "action_type": "speech",
            }
        ],
        max_scene_beats=3,
    )
    delta = SceneDelta(
        selected_event_id="evt-board",
        scene_beats=[
            {
                "beat_id": "B1",
                "candidate_id": "C99",
                "source_cast_id": "alpha",
                "target_cast_ids": [],
                "intent": "Force a decision.",
                "action_type": "speech",
                "summary": "Alpha speaks.",
                "detail": "Alpha asks for a decision.",
                "utterance": "결정합시다.",
                "reaction": "The room turns toward Alpha.",
                "emotional_tone": "urgent",
                "event_effect": "Decision pressure rises.",
            }
        ],
        intent_updates=[],
        event_updates=[],
        world_state_summary="Alpha raises pressure.",
        time_advance={
            "elapsed_unit": "minute",
            "elapsed_amount": 1,
            "reason": "One beat passed.",
        },
        stop_reason="",
        debug_rationale="Invalid candidate id for validation.",
    )

    assert validator(delta) == ["unknown scene beat candidate_id: C99"]


def test_scene_debug_log_renderers_use_display_names_and_skip_empty_utterance() -> None:
    scene_actors = [
        {"cast_id": "alpha", "display_name": "Alpha Founder"},
        {"cast_id": "beta", "display_name": "Beta Director"},
    ]
    actor_names = actor_name_by_id(scene_actors)
    candidates = [
        {
            "candidate_id": "C1",
            "source_cast_id": "alpha",
            "target_cast_ids": ["beta"],
            "action_type": "speech",
        }
    ]
    beats = [
        {
            "beat_id": "B1",
            "candidate_id": "C1",
            "source_cast_id": "alpha",
            "target_cast_ids": ["beta"],
            "intent": "Force the decision before the board loses confidence.",
            "action_type": "speech",
            "summary": "Alpha presses Beta for an immediate answer.",
            "utterance": "",
            "reaction": "Beta has to answer in front of the board.",
            "event_effect": "The board decision pressure rises.",
        }
    ]

    candidate_log = render_candidates_for_log(candidates, actor_names)
    beat_log = render_scene_beats_for_log(
        beats,
        actor_name_by_id=actor_names,
        candidate_by_id={"C1": candidates[0]},
    )

    assert "C1 | Alpha Founder | speech -> Beta Director" in candidate_log
    assert "위험:" in candidate_log
    assert "예상효과:" in candidate_log
    assert "B1/C1 | Alpha Founder -> Beta Director | speech" in beat_log
    assert "의도: Force the decision" in beat_log
    assert "행동: Alpha presses Beta" in beat_log
    assert "반응: Beta has to answer" in beat_log
    assert "효과: The board decision pressure rises." in beat_log
    assert "발화:" not in beat_log
    assert "symbols={" not in candidate_log


def test_scene_kernel_selects_event_and_builds_candidates() -> None:
    settings = _settings(max_rounds=2)
    simulation_plan = build_simulation_plan(
        plan=_plan(settings),
        actors=_actors(),
        max_rounds=settings.runtime.max_rounds,
        max_recipients_per_message=2,
        max_scene_actors=settings.runtime.max_scene_actors,
        max_scene_candidates=settings.runtime.max_scene_candidates,
        max_scene_beats=settings.runtime.max_scene_beats,
    )
    event_memory = build_event_memory(_plan(settings)["major_events"])

    event = select_next_event(
        simulation_plan=simulation_plan,
        event_memory=event_memory,
        current_round_index=1,
    )
    assert event is not None
    scene_actors = select_scene_actors(
        event=event,
        actors=_actors(),
        simulation_plan=simulation_plan,
    )
    candidates = build_action_candidates(
        event=event,
        scene_actors=scene_actors,
        simulation_plan=simulation_plan,
        max_recipients_per_message=2,
    )

    assert [actor["cast_id"] for actor in scene_actors] == ["alpha", "beta"]
    assert candidates[0]["candidate_id"] == "C1"
    assert candidates[0]["source_cast_id"] == "alpha"
    assert candidates[0]["action_type"] == "speech"
    assert candidates[0]["intent"] == "Force a direct board decision."
    assert candidates[0]["stakes"].startswith("pressure=")
    assert candidates[0]["expected_effect"]
    assert candidates[0]["risk"]
    assert candidates[0]["target_reason"]


def test_scene_kernel_uses_configured_actor_and_candidate_caps() -> None:
    settings = _settings(
        max_rounds=2,
        max_scene_actors=2,
        max_scene_candidates=1,
    )
    actors = [*_actors(), _extra_actor("gamma")]
    plan = _plan(settings)
    plan["major_events"][0]["participant_cast_ids"] = ["alpha", "beta", "gamma"]
    simulation_plan = build_simulation_plan(
        plan=plan,
        actors=actors,
        max_rounds=settings.runtime.max_rounds,
        max_recipients_per_message=2,
        max_scene_actors=settings.runtime.max_scene_actors,
        max_scene_candidates=settings.runtime.max_scene_candidates,
        max_scene_beats=settings.runtime.max_scene_beats,
    )
    event_memory = build_event_memory(plan["major_events"])
    event = select_next_event(
        simulation_plan=simulation_plan,
        event_memory=event_memory,
        current_round_index=1,
    )
    assert event is not None

    scene_actors = select_scene_actors(
        event=event,
        actors=actors,
        simulation_plan=simulation_plan,
    )
    candidates = build_action_candidates(
        event=event,
        scene_actors=scene_actors,
        simulation_plan=simulation_plan,
        max_recipients_per_message=2,
    )

    assert [actor["cast_id"] for actor in scene_actors] == ["alpha", "beta"]
    assert [candidate["candidate_id"] for candidate in candidates] == ["C1"]


def test_scene_candidate_initiative_order_is_seeded_and_reproducible() -> None:
    settings = _settings(
        max_rounds=2,
        max_scene_actors=3,
        max_scene_candidates=3,
    )
    actors = [*_actors(), _extra_actor("gamma")]
    plan = _plan(settings)
    plan["major_events"][0]["participant_cast_ids"] = ["alpha", "beta", "gamma"]
    simulation_plan = build_simulation_plan(
        plan=plan,
        actors=actors,
        max_rounds=settings.runtime.max_rounds,
        max_recipients_per_message=2,
        max_scene_actors=settings.runtime.max_scene_actors,
        max_scene_candidates=settings.runtime.max_scene_candidates,
        max_scene_beats=settings.runtime.max_scene_beats,
    )
    event_memory = build_event_memory(plan["major_events"])
    event = select_next_event(
        simulation_plan=simulation_plan,
        event_memory=event_memory,
        current_round_index=1,
    )
    assert event is not None
    scene_actors = select_scene_actors(
        event=event,
        actors=actors,
        simulation_plan=simulation_plan,
    )

    seed_3_a = build_action_candidates(
        event=event,
        scene_actors=scene_actors,
        simulation_plan=simulation_plan,
        max_recipients_per_message=2,
        current_round_index=1,
        rng_seed=3,
    )
    seed_3_b = build_action_candidates(
        event=event,
        scene_actors=scene_actors,
        simulation_plan=simulation_plan,
        max_recipients_per_message=2,
        current_round_index=1,
        rng_seed=3,
    )
    seed_4 = build_action_candidates(
        event=event,
        scene_actors=scene_actors,
        simulation_plan=simulation_plan,
        max_recipients_per_message=2,
        current_round_index=1,
        rng_seed=4,
    )

    assert [item["source_cast_id"] for item in seed_3_a] == [
        item["source_cast_id"] for item in seed_3_b
    ]
    assert [item["source_cast_id"] for item in seed_3_a] != [
        item["source_cast_id"] for item in seed_4
    ]


def test_runtime_subgraph_calls_single_scene_delta_per_tick() -> None:
    settings = _settings(max_rounds=1)
    router = SceneDeltaRouter()
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
    assert result["scene_llm_call_count"] == 1
    assert router.calls == {"SceneDelta": 1}
    assert len(store.round_artifacts) == 1
    activity = store.round_artifacts[0]["activities"][0]
    assert activity["source_cast_id"] == "alpha"
    assert activity["beat_id"] == "B1"
    assert activity["goal"] == "Force a direct board decision before delay hardens."
    assert activity["summary"] == "Alpha demands an immediate board decision."
    assert activity["utterance"] == "지금 결정을 미루면 선택지가 사라집니다."
    assert activity["reaction"] == "Beta is forced to answer the demand in front of the board."
    assert activity["event_effect"] == "The board decision pressure becomes explicit."
    assert result["actor_agent_states"][0]["cast_id"] == "alpha"
    assert result["actor_agent_states"][0]["current_intent"] == "Force a direct board decision."
    assert result["actor_agent_states"][0]["recent_memory"]
    assert result["agent_memory_history"][0]["agent_updates"]


def test_runtime_scene_events_include_jsonl_event_keys(tmp_path: Path) -> None:
    settings = _settings(max_rounds=1, output_dir=str(tmp_path))
    router = SceneDeltaRouter()
    context = WorkflowRuntimeContext(
        settings=settings,
        store=FakeStore(),  # type: ignore[arg-type]
        llms=router,  # type: ignore[arg-type]
        logger=logging.getLogger("simula.test.runtime_graph"),
        llm_usage_tracker=LLMUsageTracker(),
        run_jsonl_appender=RunJsonlAppender(
            output_dir=settings.storage.output_dir,
            run_id="runtime-run",
        ),
    )

    asyncio.run(RUNTIME_SUBGRAPH.ainvoke(_runtime_state(settings), context=context))

    lines = [
        json.loads(line)
        for line in context.run_jsonl_appender.path.read_text(
            encoding="utf-8"
        ).splitlines()
        if line
    ]
    scene_events = [entry for entry in lines if str(entry.get("event", "")).startswith("scene_")]
    assert {entry["event"] for entry in scene_events} == {
        "scene_tick_started",
        "scene_candidates_built",
        "scene_delta_applied",
        "scene_event_memory_updated",
        "scene_debug_trace",
    }
    assert all(entry.get("event_key") for entry in scene_events)
    assert "scene_tick_started:1" in {entry["event_key"] for entry in scene_events}


def test_runtime_subgraph_uses_explicit_default_for_malformed_delta() -> None:
    settings = _settings(max_rounds=1, max_scene_beats=1)
    router = SceneDeltaRouter(malformed_first=True)
    context = WorkflowRuntimeContext(
        settings=settings,
        store=FakeStore(),  # type: ignore[arg-type]
        llms=router,  # type: ignore[arg-type]
        logger=logging.getLogger("simula.test.runtime_graph"),
        llm_usage_tracker=LLMUsageTracker(),
    )

    result = asyncio.run(
        RUNTIME_SUBGRAPH.ainvoke(_runtime_state(settings), context=context)
    )

    assert result["forced_idles"] == 1
    assert result["parse_failures"] == 1
    assert "scene tick 1 defaulted" in result["errors"]
    assert result["scene_tick_history"][0]["default_used"] is True
    assert len(result["latest_round_activities"]) == 1
