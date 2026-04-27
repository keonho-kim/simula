"""Build the situation bundle."""

from __future__ import annotations

import json

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.planning.prompts.situation_prompt import (
    PROMPT as SITUATION_PROMPT,
    SITUATION_EXAMPLE,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import SituationBundle
from simula.shared.logging.llm import build_llm_log_context
from simula.shared.prompts.output_schema_utils import object_prompt_bundle


async def build_situation(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Build the situation bundle for the execution plan."""

    planning_analysis_json = json.dumps(
        state["planning_analysis"],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    prompt = SITUATION_PROMPT.format(
        scenario_text=state["scenario"],
        planning_analysis_json=planning_analysis_json,
        **object_prompt_bundle(example=SITUATION_EXAMPLE),
    )
    situation, _meta = await runtime.context.llms.ainvoke_object_with_meta(
        "planner",
        prompt,
        SituationBundle,
        log_context=build_llm_log_context(
            scope="planning-situation",
            phase="planning",
            task_key="execution_plan_situation",
            task_label="상황 정리",
            artifact_key="situation",
            artifact_label="situation",
            schema=SituationBundle,
        ),
    )
    return {"situation": situation.model_dump(mode="json")}
