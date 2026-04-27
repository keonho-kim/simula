"""Purpose:
- Build the final report payload and report projection together.
"""

from __future__ import annotations

from typing import cast

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.finalization.utils.report_artifacts import (
    timeline_anchor,
)
from simula.application.workflow.graphs.finalization.utils.report_projection import (
    build_report_projection,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.shared.io.streaming import record_simulation_log_event
from simula.domain.reporting.events import build_final_report_event
from simula.domain.reporting.reports import build_final_report


def build_report_artifacts(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Build the final report artifacts in one code-only node."""

    llm_usage_summary = runtime.context.llm_usage_tracker.snapshot()
    report_timeline_anchor = timeline_anchor(state)
    final_report = build_final_report(
        {
            **cast(dict[str, object], state),
            "report_timeline_anchor_json": report_timeline_anchor,
        },
        llm_usage_summary=llm_usage_summary,
    )
    projection_update = build_report_projection(
        cast(
            SimulationWorkflowState,
            {
                **cast(dict[str, object], state),
                "final_report": final_report,
                "report_timeline_anchor_json": report_timeline_anchor,
            },
        )
    )
    record_simulation_log_event(
        runtime.context,
        build_final_report_event(
            run_id=str(state["run_id"]),
            final_report=final_report,
            stop_reason=state.get("stop_reason"),
        )
    )
    return {
        "final_report": final_report,
        "report_timeline_anchor_json": report_timeline_anchor,
        "report_projection_json": str(projection_update["report_projection_json"]),
        "llm_usage_summary": llm_usage_summary,
    }
