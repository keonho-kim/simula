"""Build the required scenario analysis bundle."""

from __future__ import annotations

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.planning.prompts.planning_analysis_prompt import (
    PLANNING_ANALYSIS_EXAMPLE,
    PROMPT as PLANNING_ANALYSIS_PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import PlanningAnalysis
from simula.shared.logging.llm import build_llm_log_context
from simula.shared.prompts.output_schema_utils import object_prompt_bundle


async def build_planning_analysis(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Build the required scenario analysis bundle in one call."""

    prompt = PLANNING_ANALYSIS_PROMPT.format(
        scenario_text=state["scenario"],
        max_rounds=state["max_rounds"],
        **object_prompt_bundle(example=PLANNING_ANALYSIS_EXAMPLE),
    )
    analysis, meta = await runtime.context.llms.ainvoke_object_with_meta(
        "planner",
        prompt,
        PlanningAnalysis,
        log_context=build_llm_log_context(
            scope="planning-analysis",
            phase="planning",
            task_key="planning_analysis",
            task_label="계획 분석",
            artifact_key="planning_analysis",
            artifact_label="planning_analysis",
            schema=PlanningAnalysis,
        ),
    )
    return {
        "planning_analysis": analysis.model_dump(mode="json"),
        "planned_max_rounds": analysis.progression_plan.max_rounds,
        "planning_latency_seconds": float(state["planning_latency_seconds"])
        + meta.duration_seconds,
    }
