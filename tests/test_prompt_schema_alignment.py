"""Purpose:
- Verify prompt bundle output examples stay aligned with active structured schemas.
"""

from __future__ import annotations

import json
from types import UnionType
from typing import Any, Union, get_args, get_origin

from pydantic import BaseModel

from simula.application.workflow.graphs.coordinator.output_schema.bundles import (
    build_round_continuation_prompt_bundle,
    build_round_directive_prompt_bundle,
    build_round_resolution_prompt_bundle,
)
from simula.application.workflow.graphs.finalization.output_schema.bundles import (
    build_timeline_anchor_decision_prompt_bundle,
)
from simula.application.workflow.graphs.generation.output_schema.bundles import (
    build_actor_card_prompt_bundle,
)
from simula.application.workflow.graphs.planning.output_schema.bundles import (
    build_execution_plan_prompt_bundle,
    build_planning_analysis_prompt_bundle,
)
from simula.application.workflow.graphs.runtime.output_schema.bundles import (
    build_actor_action_proposal_prompt_bundle,
)
from simula.domain.contracts import (
    ActorActionProposal,
    ExecutionPlanBundle,
    GeneratedActorCardDraft,
    PlanningAnalysis,
    RoundContinuationDecision,
    RoundDirective,
    RoundResolution,
    TimelineAnchorDecision,
)


def test_planning_analysis_prompt_example_matches_schema_shape() -> None:
    _assert_example_matches_schema(
        build_planning_analysis_prompt_bundle()["output_example"],
        PlanningAnalysis,
    )


def test_execution_plan_prompt_example_matches_schema_shape() -> None:
    _assert_example_matches_schema(
        build_execution_plan_prompt_bundle(
            num_cast=4,
            allow_additional_cast=False,
        )["output_example"],
        ExecutionPlanBundle,
    )


def test_actor_card_prompt_example_matches_schema_shape() -> None:
    _assert_example_matches_schema(
        build_actor_card_prompt_bundle()["output_example"],
        GeneratedActorCardDraft,
    )


def test_actor_action_proposal_prompt_example_matches_schema_shape() -> None:
    _assert_example_matches_schema(
        build_actor_action_proposal_prompt_bundle()["output_example"],
        ActorActionProposal,
    )


def test_round_directive_prompt_example_matches_schema_shape() -> None:
    _assert_example_matches_schema(
        build_round_directive_prompt_bundle()["output_example"],
        RoundDirective,
    )


def test_round_continuation_prompt_example_matches_schema_shape() -> None:
    _assert_example_matches_schema(
        build_round_continuation_prompt_bundle()["output_example"],
        RoundContinuationDecision,
    )


def test_round_resolution_prompt_example_matches_schema_shape() -> None:
    _assert_example_matches_schema(
        build_round_resolution_prompt_bundle()["output_example"],
        RoundResolution,
    )


def test_timeline_anchor_prompt_example_matches_schema_shape() -> None:
    _assert_example_matches_schema(
        build_timeline_anchor_decision_prompt_bundle()["output_example"],
        TimelineAnchorDecision,
    )


def _assert_example_matches_schema(output_example: str, schema: type[BaseModel]) -> None:
    payload = json.loads(output_example)
    _assert_value_matches_annotation(payload, schema)


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
