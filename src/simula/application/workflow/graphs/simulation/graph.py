"""목적:
- simulation workflow singleton을 제공한다.

설명:
- planning, generation, runtime, finalization 서브그래프를 루트 workflow로 조립한다.

사용한 설계 패턴:
- root workflow singleton 패턴

연관된 다른 모듈/구조:
- simula.application.workflow.graphs.planning.graph
- simula.application.workflow.graphs.generation.graph
- simula.application.workflow.graphs.runtime.graph
- simula.application.workflow.graphs.finalization.graph
"""

from __future__ import annotations

from typing import Any, cast

from langgraph.graph import END, START, StateGraph

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.finalization import (
    FINALIZATION_SUBGRAPH,
    FINALIZATION_SUBGRAPH_SERIAL,
)
from simula.application.workflow.graphs.generation import (
    GENERATION_SUBGRAPH,
    GENERATION_SUBGRAPH_SERIAL,
)
from simula.application.workflow.graphs.planning import (
    PLANNING_SUBGRAPH,
    PLANNING_SUBGRAPH_SERIAL,
)
from simula.application.workflow.graphs.runtime import (
    RUNTIME_SUBGRAPH,
    RUNTIME_SUBGRAPH_SERIAL,
)
from simula.application.workflow.graphs.simulation.nodes.hydration import (
    hydrate_initial_state,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationInputState,
    SimulationOutputState,
    SimulationWorkflowState,
)


def _build_simulation_workflow_graph(
    *,
    planning_subgraph: Any,
    generation_subgraph: Any,
    runtime_subgraph: Any,
    finalization_subgraph: Any,
) -> StateGraph[Any, WorkflowRuntimeContext, Any, Any]:
    graph = StateGraph(
        state_schema=cast(Any, SimulationWorkflowState),
        context_schema=WorkflowRuntimeContext,
        input_schema=cast(Any, SimulationInputState),
        output_schema=cast(Any, SimulationOutputState),
    )
    graph.add_node("hydrate_initial_state", hydrate_initial_state)
    graph.add_node("planning", planning_subgraph)
    graph.add_node("generation", generation_subgraph)
    graph.add_node("runtime", runtime_subgraph)
    graph.add_node("finalization", finalization_subgraph)
    graph.add_edge(START, "hydrate_initial_state")
    graph.add_edge("hydrate_initial_state", "planning")
    graph.add_edge("planning", "generation")
    graph.add_edge("generation", "runtime")
    graph.add_edge("runtime", "finalization")
    graph.add_edge("finalization", END)
    return graph


SIMULATION_WORKFLOW_GRAPH = _build_simulation_workflow_graph(
    planning_subgraph=PLANNING_SUBGRAPH_SERIAL,
    generation_subgraph=GENERATION_SUBGRAPH_SERIAL,
    runtime_subgraph=RUNTIME_SUBGRAPH_SERIAL,
    finalization_subgraph=FINALIZATION_SUBGRAPH_SERIAL,
)
SIMULATION_WORKFLOW_GRAPH_PARALLEL = _build_simulation_workflow_graph(
    planning_subgraph=PLANNING_SUBGRAPH,
    generation_subgraph=GENERATION_SUBGRAPH,
    runtime_subgraph=RUNTIME_SUBGRAPH,
    finalization_subgraph=FINALIZATION_SUBGRAPH,
)

SIMULATION_WORKFLOW = SIMULATION_WORKFLOW_GRAPH.compile(name="simula")
SIMULATION_WORKFLOW_PARALLEL = SIMULATION_WORKFLOW_GRAPH_PARALLEL.compile(
    name="simula_parallel"
)
