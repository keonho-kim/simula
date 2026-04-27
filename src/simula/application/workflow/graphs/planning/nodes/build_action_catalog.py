"""Build the scenario-wide action catalog."""

from __future__ import annotations

import json

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.planning.prompts.action_catalog_prompt import (
    ACTION_CATALOG_EXAMPLE,
    PROMPT as ACTION_CATALOG_PROMPT,
)
from simula.application.workflow.graphs.planning.utils.validation import (
    build_action_catalog_repair_context,
    validate_action_catalog_semantics,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import ActionCatalog
from simula.shared.logging.llm import build_llm_log_context
from simula.shared.prompts.output_schema_utils import object_prompt_bundle


async def build_action_catalog(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Build the scenario-wide action catalog."""

    planning_analysis_json = json.dumps(
        state["planning_analysis"],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    action_catalog_prompt = ACTION_CATALOG_PROMPT.format(
        scenario_text=state["scenario"],
        planning_analysis_json=planning_analysis_json,
        **object_prompt_bundle(example=ACTION_CATALOG_EXAMPLE),
    )
    action_catalog, _meta = (
        await runtime.context.llms.ainvoke_object_with_meta(
            "planner",
            action_catalog_prompt,
            ActionCatalog,
            failure_policy="fixer",
            semantic_validator=lambda parsed: validate_action_catalog_semantics(
                action_catalog=parsed.model_dump(mode="json")
            ),
            repair_context=build_action_catalog_repair_context(),
            log_context=build_llm_log_context(
                scope="planning-action-catalog",
                phase="planning",
                task_key="execution_plan_action_catalog",
                task_label="action catalog 정리",
                artifact_key="action_catalog",
                artifact_label="action_catalog",
                schema=ActionCatalog,
            ),
        )
    )
    return {"action_catalog": action_catalog.model_dump(mode="json")}
