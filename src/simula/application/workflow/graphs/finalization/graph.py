"""Purpose:
- Provide the compact finalization subgraph singleton.
"""

from __future__ import annotations

from typing import Any, cast

from langgraph.graph import END, START, StateGraph

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.finalization.nodes.build_report_artifacts import (
    build_report_artifacts,
)
from simula.application.workflow.graphs.finalization.nodes.render_and_persist_final_report import (
    render_and_persist_final_report,
)
from simula.application.workflow.graphs.finalization.nodes.write_final_report_draft import (
    write_final_report_draft,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)

def _build_finalization_graph() -> Any:
    graph = StateGraph(
        state_schema=cast(Any, SimulationWorkflowState),
        context_schema=WorkflowRuntimeContext,
    )
    graph.add_node("build_report_artifacts", build_report_artifacts)
    graph.add_node("write_final_report_draft", write_final_report_draft)
    graph.add_node("render_and_persist_final_report", render_and_persist_final_report)
    graph.add_edge(START, "build_report_artifacts")
    graph.add_edge("build_report_artifacts", "write_final_report_draft")
    graph.add_edge("write_final_report_draft", "render_and_persist_final_report")
    graph.add_edge("render_and_persist_final_report", END)
    return graph


FINALIZATION_SUBGRAPH_GRAPH = _build_finalization_graph()
FINALIZATION_SUBGRAPH_SERIAL_GRAPH = FINALIZATION_SUBGRAPH_GRAPH
FINALIZATION_SUBGRAPH = FINALIZATION_SUBGRAPH_GRAPH.compile(name="finalization")
FINALIZATION_SUBGRAPH_SERIAL = FINALIZATION_SUBGRAPH
