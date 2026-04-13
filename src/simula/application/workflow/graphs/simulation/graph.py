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
from simula.application.workflow.graphs.finalization.graph import (
    FINALIZATION_SUBGRAPH,
)
from simula.application.workflow.graphs.generation.graph import GENERATION_SUBGRAPH
from simula.application.workflow.graphs.planning.graph import PLANNING_SUBGRAPH
from simula.application.workflow.graphs.runtime.graph import RUNTIME_SUBGRAPH
from simula.application.workflow.graphs.simulation.nodes.hydration import (
    hydrate_initial_state,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationInputState,
    SimulationOutputState,
    SimulationWorkflowState,
)

SIMULATION_WORKFLOW_GRAPH = StateGraph(
    state_schema=cast(Any, SimulationWorkflowState),
    context_schema=WorkflowRuntimeContext,
    input_schema=cast(Any, SimulationInputState),
    output_schema=cast(Any, SimulationOutputState),
)
SIMULATION_WORKFLOW_GRAPH.add_node("hydrate_initial_state", hydrate_initial_state)
SIMULATION_WORKFLOW_GRAPH.add_node("planning", PLANNING_SUBGRAPH)
SIMULATION_WORKFLOW_GRAPH.add_node("generation", GENERATION_SUBGRAPH)
SIMULATION_WORKFLOW_GRAPH.add_node("runtime", RUNTIME_SUBGRAPH)
SIMULATION_WORKFLOW_GRAPH.add_node("finalization", FINALIZATION_SUBGRAPH)
SIMULATION_WORKFLOW_GRAPH.add_edge(START, "hydrate_initial_state")
SIMULATION_WORKFLOW_GRAPH.add_edge("hydrate_initial_state", "planning")
SIMULATION_WORKFLOW_GRAPH.add_edge("planning", "generation")
SIMULATION_WORKFLOW_GRAPH.add_edge("generation", "runtime")
SIMULATION_WORKFLOW_GRAPH.add_edge("runtime", "finalization")
SIMULATION_WORKFLOW_GRAPH.add_edge("finalization", END)

SIMULATION_WORKFLOW = SIMULATION_WORKFLOW_GRAPH.compile(name="simula")
