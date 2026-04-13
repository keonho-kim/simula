"""Purpose:
- Provide the compact planning subgraph singleton.
"""

from __future__ import annotations

from typing import Any, cast

from langgraph.graph import END, START, StateGraph

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.planning.nodes.planner import (
    build_execution_plan,
    build_planning_analysis,
    finalize_plan,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)

_graph = StateGraph(
    state_schema=cast(Any, SimulationWorkflowState),
    context_schema=WorkflowRuntimeContext,
)
_graph.add_node("build_planning_analysis", build_planning_analysis)
_graph.add_node("build_execution_plan", build_execution_plan)
_graph.add_node("finalize_plan", finalize_plan)
_graph.add_edge(START, "build_planning_analysis")
_graph.add_edge("build_planning_analysis", "build_execution_plan")
_graph.add_edge("build_execution_plan", "finalize_plan")
_graph.add_edge("finalize_plan", END)

PLANNING_SUBGRAPH = _graph.compile(name="planning")
