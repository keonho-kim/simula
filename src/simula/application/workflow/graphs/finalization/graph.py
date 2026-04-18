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
from simula.application.workflow.graphs.finalization.nodes.write_final_report_sections import (
    write_actor_dynamics_section,
    write_conclusion_section,
    write_major_events_section,
    write_timeline_section,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)

def _build_parallel_finalization_graph() -> StateGraph:
    graph = StateGraph(
        state_schema=cast(Any, SimulationWorkflowState),
        context_schema=WorkflowRuntimeContext,
    )
    graph.add_node("resolve_timeline_anchor", resolve_timeline_anchor)
    graph.add_node("build_report_artifacts", build_report_artifacts)
    graph.add_node("write_conclusion_section", write_conclusion_section)
    graph.add_node("write_timeline_section", write_timeline_section)
    graph.add_node("write_actor_dynamics_section", write_actor_dynamics_section)
    graph.add_node("write_major_events_section", write_major_events_section)
    graph.add_node("render_and_persist_final_report", render_and_persist_final_report)
    graph.add_edge(START, "resolve_timeline_anchor")
    graph.add_edge("resolve_timeline_anchor", "build_report_artifacts")
    graph.add_edge("build_report_artifacts", "write_conclusion_section")
    graph.add_edge("build_report_artifacts", "write_timeline_section")
    graph.add_edge("build_report_artifacts", "write_actor_dynamics_section")
    graph.add_edge("build_report_artifacts", "write_major_events_section")
    graph.add_edge(
        [
            "write_conclusion_section",
            "write_timeline_section",
            "write_actor_dynamics_section",
            "write_major_events_section",
        ],
        "render_and_persist_final_report",
    )
    graph.add_edge("render_and_persist_final_report", END)
    return graph


def _build_serial_finalization_graph() -> StateGraph:
    graph = StateGraph(
        state_schema=cast(Any, SimulationWorkflowState),
        context_schema=WorkflowRuntimeContext,
    )
    graph.add_node("resolve_timeline_anchor", resolve_timeline_anchor)
    graph.add_node("build_report_artifacts", build_report_artifacts)
    graph.add_node("write_conclusion_section", write_conclusion_section)
    graph.add_node("write_timeline_section", write_timeline_section)
    graph.add_node("write_actor_dynamics_section", write_actor_dynamics_section)
    graph.add_node("write_major_events_section", write_major_events_section)
    graph.add_node("render_and_persist_final_report", render_and_persist_final_report)
    graph.add_edge(START, "resolve_timeline_anchor")
    graph.add_edge("resolve_timeline_anchor", "build_report_artifacts")
    graph.add_edge("build_report_artifacts", "write_conclusion_section")
    graph.add_edge("write_conclusion_section", "write_timeline_section")
    graph.add_edge("write_timeline_section", "write_actor_dynamics_section")
    graph.add_edge("write_actor_dynamics_section", "write_major_events_section")
    graph.add_edge("write_major_events_section", "render_and_persist_final_report")
    graph.add_edge("render_and_persist_final_report", END)
    return graph


FINALIZATION_SUBGRAPH_GRAPH = _build_parallel_finalization_graph()
FINALIZATION_SUBGRAPH_SERIAL_GRAPH = _build_serial_finalization_graph()
FINALIZATION_SUBGRAPH = FINALIZATION_SUBGRAPH_GRAPH.compile(name="finalization")
FINALIZATION_SUBGRAPH_SERIAL = FINALIZATION_SUBGRAPH_SERIAL_GRAPH.compile(name="finalization")
