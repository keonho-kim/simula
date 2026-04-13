"""Purpose:
- Build the final report payload, simulation log, and report projection together.
"""

from __future__ import annotations

import json
from typing import cast

from simula.application.workflow.graphs.finalization.nodes.build_report_projection import (
    build_report_projection,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.reporting import build_final_report, build_simulation_log_entries


def build_report_artifacts(
    state: SimulationWorkflowState,
) -> dict[str, object]:
    """Build the final report artifacts in one code-only node."""

    final_report = build_final_report(cast(dict[str, object], state))
    simulation_log_entries = build_simulation_log_entries(
        {
            **cast(dict[str, object], state),
            "final_report": final_report,
        }
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
    return {
        "final_report": final_report,
        "simulation_log_jsonl": "\n".join(
            json.dumps(entry, ensure_ascii=False) for entry in simulation_log_entries
        ),
        "report_projection_json": str(projection_update["report_projection_json"]),
    }
