"""Shared registry of active structured LLM prompt contracts."""

from __future__ import annotations

from dataclasses import dataclass

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


@dataclass(frozen=True, slots=True)
class StructuredPromptContract:
    """One active structured prompt contract."""

    name: str
    schema: type[BaseModel]
    output_example: str


ACTIVE_STRUCTURED_PROMPT_CONTRACTS: tuple[StructuredPromptContract, ...] = (
    StructuredPromptContract(
        name="planning_analysis",
        schema=PlanningAnalysis,
        output_example=build_planning_analysis_prompt_bundle()["output_example"],
    ),
    StructuredPromptContract(
        name="execution_plan",
        schema=ExecutionPlanBundle,
        output_example=build_execution_plan_prompt_bundle(
            num_cast=4,
            allow_additional_cast=False,
        )["output_example"],
    ),
    StructuredPromptContract(
        name="generated_actor_card_draft",
        schema=GeneratedActorCardDraft,
        output_example=build_actor_card_prompt_bundle()["output_example"],
    ),
    StructuredPromptContract(
        name="actor_action_proposal",
        schema=ActorActionProposal,
        output_example=build_actor_action_proposal_prompt_bundle()["output_example"],
    ),
    StructuredPromptContract(
        name="round_continuation",
        schema=RoundContinuationDecision,
        output_example=build_round_continuation_prompt_bundle()["output_example"],
    ),
    StructuredPromptContract(
        name="round_directive",
        schema=RoundDirective,
        output_example=build_round_directive_prompt_bundle()["output_example"],
    ),
    StructuredPromptContract(
        name="round_resolution",
        schema=RoundResolution,
        output_example=build_round_resolution_prompt_bundle()["output_example"],
    ),
    StructuredPromptContract(
        name="timeline_anchor_decision",
        schema=TimelineAnchorDecision,
        output_example=build_timeline_anchor_decision_prompt_bundle()["output_example"],
    ),
)


ACTIVE_STRUCTURED_PROMPT_CONTRACT_NAMES: tuple[str, ...] = tuple(
    item.name for item in ACTIVE_STRUCTURED_PROMPT_CONTRACTS
)
