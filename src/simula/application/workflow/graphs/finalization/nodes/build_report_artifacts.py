"""Purpose:
- Build the final report payload, simulation log, and report projection together.
"""

from __future__ import annotations

import json
from typing import cast

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.finalization.nodes.build_report_projection import (
    build_report_projection,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.application.workflow.utils.streaming import emit_custom_event
from simula.domain.log_events import build_final_report_event
from simula.domain.reporting import build_final_report, build_simulation_log_entries


def build_report_artifacts(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Build the final report artifacts in one code-only node."""

    llm_usage_summary = runtime.context.llm_usage_tracker.snapshot()
    final_report = build_final_report(
        cast(dict[str, object], state),
        llm_usage_summary=llm_usage_summary,
    )
    simulation_log_entries = build_simulation_log_entries(
        {
            **cast(dict[str, object], state),
            "final_report": final_report,
        },
        llm_usage_summary=llm_usage_summary,
    )
    projection_update = build_report_projection(
        cast(
            SimulationWorkflowState,
            {
                **cast(dict[str, object], state),
                "final_report": final_report,
            },
        )
    )
    emit_custom_event(
        build_final_report_event(
            run_id=str(state["run_id"]),
            final_report=final_report,
            stop_reason=state.get("stop_reason"),
        )
    )
    return {
        "final_report": final_report,
        "simulation_log_jsonl": "\n".join(
            json.dumps(entry, ensure_ascii=False) for entry in simulation_log_entries
        ),
        "report_projection_json": str(projection_update["report_projection_json"]),
        "llm_usage_summary": llm_usage_summary,
    }
