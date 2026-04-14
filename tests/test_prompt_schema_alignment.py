"""Verify active structured prompt contracts stay aligned with schemas and defaults."""

from __future__ import annotations

import json
from types import UnionType
from typing import Any, Union, get_args, get_origin

from pydantic import BaseModel

from simula.application.workflow.graphs.coordinator.nodes.assess_round_continuation import (
    _build_default_round_continuation_payload,
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
    RoundContinuationDecision,
    RoundDirective,
    RoundResolution,
)
from tests.prompt_contract_registry import (
    ACTIVE_STRUCTURED_PROMPT_CONTRACT_NAMES,
    ACTIVE_STRUCTURED_PROMPT_CONTRACTS,
)


def test_active_structured_prompt_contract_registry_is_complete() -> None:
    assert ACTIVE_STRUCTURED_PROMPT_CONTRACT_NAMES == (
        "planning_analysis",
        "execution_plan",
        "generated_actor_card_draft",
        "actor_action_proposal",
        "round_continuation",
        "round_directive",
        "round_resolution",
        "timeline_anchor_decision",
    )


def test_active_structured_prompt_examples_match_schema_shape() -> None:
    for contract in ACTIVE_STRUCTURED_PROMPT_CONTRACTS:
        payload = json.loads(contract.output_example)
        _assert_value_matches_annotation(payload, contract.schema)


def test_round_continuation_default_payload_matches_schema() -> None:
    RoundContinuationDecision.model_validate(_build_default_round_continuation_payload())


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
                        "supports_utterance": True,
                    }
                ],
                "current_intent_snapshot": {
                    "current_intent": "Beta의 반응을 본다.",
                    "thought": "지금은 신호를 더 읽어야 한다고 본다.",
                    "target_cast_ids": ["beta"],
                },
                "actor_facing_scenario_digest": {
                    "talking_points": ["질문을 더 분명하게 던진다."],
                    "avoid_repetition_notes": ["같은 표현만 반복하지 않는다."],
                },
            },
        )
    )


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
                            "action_summary": "Alpha가 Beta에게 답을 요구한다.",
                        },
                    }
                ],
                "actor_intent_states": [
                    {
                        "cast_id": "alpha",
                        "current_intent": "Beta의 답을 요구한다.",
                        "thought": "이번에는 반응을 분명히 받아야 한다고 본다.",
                        "target_cast_ids": ["beta"],
                        "supporting_action_type": "speech",
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
                        "pacing_guidance": ["짧게 본다."],
                        "selection_reason": "짧은 직접 반응이 중심이다.",
                    }
                },
            },
            event_updates=[],
        )
    )


def _assert_value_matches_annotation(value: Any, annotation: Any) -> None:
    annotation = _unwrap_optional_annotation(annotation)
    nested_model = _extract_base_model(annotation)
    if nested_model is not None:
        assert isinstance(value, dict)
        assert set(value.keys()) == set(nested_model.model_fields.keys())
        for field_name, field in nested_model.model_fields.items():
            _assert_value_matches_annotation(value[field_name], field.annotation)
        return

    origin = get_origin(annotation)
    args = get_args(annotation)

    if origin is list and args:
        assert isinstance(value, list)
        if value:
            _assert_value_matches_annotation(value[0], args[0])
        return

    if origin is dict and len(args) == 2:
        assert isinstance(value, dict)
        return


def _unwrap_optional_annotation(annotation: Any) -> Any:
    origin = get_origin(annotation)
    if origin not in (UnionType, Union):
        return annotation
    args = tuple(arg for arg in get_args(annotation) if arg is not type(None))
    if len(args) == 1:
        return args[0]
    return annotation


def _extract_base_model(annotation: Any) -> type[BaseModel] | None:
    if isinstance(annotation, type) and issubclass(annotation, BaseModel):
        return annotation
    return None
