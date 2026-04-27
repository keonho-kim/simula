"""Verify DEBUG LLM renderers show full parsed structured payloads."""

from __future__ import annotations

from simula.domain.contracts import (
    ActorCard,
    ActorRosterBundle,
    FinalReportDraft,
    SceneDelta,
)
from simula.domain.contracts.runtime import MajorEventUpdate
from simula.domain.contracts.shared import (
    RoundTimeAdvanceProposal,
)
from simula.infrastructure.llm.renderers import render_object_response


def test_actor_roster_bundle_debug_renderer_includes_actor_cards() -> None:
    rendered = render_object_response(
        role="generator",
        parsed=ActorRosterBundle(
            actors=[
                _actor_card("alpha", "Alpha"),
                _actor_card("beta", "Beta"),
            ]
        ),
        content="",
        log_context=None,
    )

    assert "ACTOR ROSTER BUNDLE DEBUG" in rendered
    assert "actors:" in rendered
    assert "display_name: Alpha" in rendered
    assert "private_goal: Force a board decision." in rendered
    assert "voice: Brief." in rendered
    assert "cast_ids:" not in rendered
    assert "avatar_seed:" not in rendered


def test_scene_delta_debug_renderer_includes_delta_details() -> None:
    rendered = render_object_response(
        role="coordinator",
        parsed=SceneDelta(
            selected_event_id="evt-board",
            scene_beats=[
                {
                    "beat_id": "B1",
                    "candidate_id": "C1",
                    "source_cast_id": "alpha",
                    "target_cast_ids": ["beta"],
                    "intent": "Force a board decision.",
                    "action_type": "speech",
                    "summary": "Alpha presses Beta.",
                    "detail": "Alpha demands that Beta stop delaying the vote.",
                    "utterance": "지금 표결해야 합니다.",
                    "reaction": "Beta has to respond under pressure.",
                    "emotional_tone": "urgent",
                    "event_effect": "The board decision pressure rises.",
                }
            ],
            intent_updates=[
                {
                    "cast_id": "alpha",
                    "goal": "Force a board decision.",
                    "target_cast_ids": ["beta"],
                    "confidence": 0.8,
                    "changed_from_previous": True,
                }
            ],
            event_updates=[
                MajorEventUpdate(
                    event_id="evt-board",
                    status="completed",
                    progress_summary="Board decision resolved.",
                    matched_activity_ids=["act-1"],
                )
            ],
            world_state_summary="Alpha forced the decision.",
            time_advance=RoundTimeAdvanceProposal(
                elapsed_unit="minute",
                elapsed_amount=30,
                reason="A short direct exchange.",
            ),
            stop_reason="simulation_done",
            debug_rationale="C1 completed the event.",
        ),
        content="",
        log_context=None,
    )

    assert "SCENE DELTA DEBUG" in rendered
    assert "scene_beats:" in rendered
    assert "utterance: 지금 표결해야 합니다." in rendered
    assert "event_effect: The board decision pressure rises." in rendered
    assert "intent_updates:" in rendered
    assert "event_updates:" in rendered
    assert "debug_rationale: C1 completed the event." in rendered
    assert "event_updates: 1" not in rendered


def test_final_report_draft_debug_renderer_includes_section_bodies() -> None:
    rendered = render_object_response(
        role="observer",
        parsed=FinalReportDraft(
            conclusion_section="### Final State\nThe board changed direction.",
            actor_dynamics_section="### Dynamics\nAlpha pressured Beta.",
            major_events_section="- Board decision completed.",
        ),
        content="",
        log_context=None,
    )

    assert "FINAL REPORT DRAFT DEBUG" in rendered
    assert "conclusion_section: ### Final State" in rendered
    assert "actor_dynamics_section: ### Dynamics" in rendered
    assert "major_events_section: - Board decision completed." in rendered
    assert "conclusion_chars:" not in rendered


def _actor_card(cast_id: str, display_name: str) -> ActorCard:
    return ActorCard(
        cast_id=cast_id,
        display_name=display_name,
        role="Director",
        narrative_profile="Board decision pressure.",
        private_goal="Force a board decision.",
        voice="Brief.",
        preferred_action_types=["speech"],
    )
