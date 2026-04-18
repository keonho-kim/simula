"""Verify default structured payload builders without testing prompt internals."""

from __future__ import annotations

import pytest
from pydantic import TypeAdapter
from pydantic import ValidationError

from simula.application.workflow.graphs.coordinator.nodes.assess_round_continuation import (
    _build_default_round_continuation_default,
)
from simula.application.workflow.graphs.coordinator.nodes.build_round_directive import (
    _build_default_round_directive_payload,
)
from simula.application.workflow.graphs.coordinator.nodes.resolve_round import (
    _build_default_round_resolution_payload,
)
from simula.application.workflow.graphs.runtime.nodes.actor_turn import (
    _build_default_action_proposal,
)
from simula.domain.contracts import (
    ActorActionProposal,
    RoundDirective,
    RoundResolution,
)
from simula.domain.contracts.shared import ContinuationStopReason


def test_round_continuation_default_payload_matches_schema() -> None:
    adapter = TypeAdapter(ContinuationStopReason)
    assert adapter.validate_python(_build_default_round_continuation_default()) == ""


def test_round_directive_default_payload_matches_schema() -> None:
    RoundDirective.model_validate(
        _build_default_round_directive_payload(
            state={
                "round_index": 2,
                "focus_candidates": [
                    {"cast_id": "a"},
                    {"cast_id": "b"},
                    {"cast_id": "c"},
                ],
            },
            max_focus_slices=2,
            max_actor_calls=3,
        )
    )


def test_actor_action_proposal_default_payload_matches_schema() -> None:
    ActorActionProposal.model_validate(
        _build_default_action_proposal(
            actor={"cast_id": "alpha", "display_name": "Alpha"},
            visible_actors=[{"cast_id": "beta", "display_name": "Beta"}],
            runtime_guidance={
                "available_actions": [
                {
                    "action_type": "speech",
                    "supported_visibility": ["public", "private"],
                    "requires_target": False,
                }
            ],
            "goal_snapshot": {
                "goal": "Beta의 반응을 본다.",
                "target_cast_ids": ["beta"],
            },
            "actor_facing_scenario_digest": {
                "current_pressures": ["베타의 반응이 아직 열려 있다."],
                "next_step_notes": ["질문을 더 분명하게 던진다."],
                "world_state_summary": "직접 반응 전 압력이 남아 있다.",
            },
        },
    )
    )


def test_actor_action_proposal_default_payload_recovers_from_blank_intent_snapshot() -> None:
    payload = _build_default_action_proposal(
        actor={"cast_id": "alpha", "display_name": "Alpha"},
        visible_actors=[{"cast_id": "beta", "display_name": "Beta"}],
        runtime_guidance={
            "available_actions": [
                {
                    "action_type": "",
                    "supported_visibility": ["public"],
                    "requires_target": False,
                }
            ],
            "goal_snapshot": {
                "goal": "",
                "target_cast_ids": [],
            },
        },
    )

    assert payload["action_type"] == "observe"
    assert payload["goal"] == "현재 상황을 조금 더 파악한다."
    ActorActionProposal.model_validate(payload)


def test_actor_action_proposal_default_payload_prefers_private_for_solo_action() -> None:
    payload = _build_default_action_proposal(
        actor={"cast_id": "alpha", "display_name": "Alpha"},
        visible_actors=[],
        runtime_guidance={
            "available_actions": [
                {
                    "action_type": "inspect",
                    "supported_visibility": ["public", "private"],
                    "requires_target": False,
                }
            ],
            "goal_snapshot": {
                "goal": "혼자 상황을 더 본다.",
                "target_cast_ids": [],
            },
        },
    )

    assert payload["visibility"] == "private"
    assert payload["target_cast_ids"] == []
    ActorActionProposal.model_validate(payload)


def test_round_resolution_default_payload_matches_schema() -> None:
    RoundResolution.model_validate(
        _build_default_round_resolution_payload(
            {
                "round_index": 2,
                "selected_cast_ids": ["alpha"],
                "pending_actor_proposals": [
                    {
                        "cast_id": "alpha",
                        "forced_idle": False,
                        "proposal": {
                            "summary": "Alpha가 Beta에게 답을 요구한다.",
                        },
                    }
                ],
                "actor_intent_states": [
                    {
                        "cast_id": "alpha",
                        "goal": "Beta의 답을 요구한다.",
                        "target_cast_ids": ["beta"],
                        "confidence": 0.8,
                        "changed_from_previous": True,
                    }
                ],
                "actors": [
                    {
                        "cast_id": "alpha",
                        "display_name": "Alpha",
                        "private_goal": "답을 요구한다.",
                    }
                ],
                "world_state_summary": "직접 압박이 유지되고 있다.",
                "event_memory": {"events": []},
                "actor_facing_scenario_digest": {},
                "plan": {
                    "progression_plan": {
                        "max_rounds": 4,
                        "allowed_elapsed_units": ["minute", "hour"],
                        "default_elapsed_unit": "minute",
                        "reason": "짧은 직접 반응이 중심이다.",
                    }
                },
            },
            event_updates=[],
        )
    )


def test_round_resolution_rejects_duplicate_intent_state_cast_ids() -> None:
    payload = _build_default_round_resolution_payload(
        {
            "round_index": 2,
            "selected_cast_ids": ["alpha"],
            "pending_actor_proposals": [
                {
                    "cast_id": "alpha",
                    "forced_idle": False,
                    "proposal": {
                        "summary": "Alpha가 Beta에게 답을 요구한다.",
                    },
                }
            ],
                "actor_intent_states": [
                    {
                        "cast_id": "alpha",
                        "goal": "Beta의 답을 요구한다.",
                        "target_cast_ids": ["beta"],
                        "confidence": 0.8,
                        "changed_from_previous": True,
                    }
            ],
            "actors": [
                {
                    "cast_id": "alpha",
                    "display_name": "Alpha",
                    "private_goal": "답을 요구한다.",
                }
            ],
            "world_state_summary": "직접 압박이 유지되고 있다.",
            "event_memory": {"events": []},
            "actor_facing_scenario_digest": {},
                "plan": {
                    "progression_plan": {
                        "max_rounds": 4,
                        "allowed_elapsed_units": ["minute", "hour"],
                        "default_elapsed_unit": "minute",
                        "reason": "짧은 직접 반응이 중심이다.",
                    }
                },
        },
        event_updates=[],
    )
    payload["intent_states"].append(payload["intent_states"][0].copy())

    with pytest.raises(ValidationError, match="intent_states must use unique cast_id"):
        RoundResolution.model_validate(payload)
