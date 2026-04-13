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
from simula.application.workflow.graphs.finalization.nodes.resolve_timeline_anchor import (
    resolve_timeline_anchor,
)
from simula.application.workflow.graphs.finalization.nodes.write_final_report_bundle import (
    write_final_report_bundle,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)

_graph = StateGraph(
    state_schema=cast(Any, SimulationWorkflowState),
    context_schema=WorkflowRuntimeContext,
)
_graph.add_node("resolve_timeline_anchor", resolve_timeline_anchor)
_graph.add_node("build_report_artifacts", build_report_artifacts)
_graph.add_node("write_final_report_bundle", write_final_report_bundle)
_graph.add_node("render_and_persist_final_report", render_and_persist_final_report)
_graph.add_edge(START, "resolve_timeline_anchor")
_graph.add_edge("resolve_timeline_anchor", "build_report_artifacts")
_graph.add_edge("build_report_artifacts", "write_final_report_bundle")
_graph.add_edge("write_final_report_bundle", "render_and_persist_final_report")
_graph.add_edge("render_and_persist_final_report", END)

FINALIZATION_SUBGRAPH = _graph.compile(name="finalization")
