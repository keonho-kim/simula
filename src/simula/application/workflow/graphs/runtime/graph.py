"""목적:
- runtime 서브그래프 singleton을 제공한다.

설명:
- step 초기화, actor proposal fan-out/fan-in, observer, 저장, 종료 분기를 하나의 subgraph로 묶는다.

사용한 설계 패턴:
- runtime loop subgraph singleton 패턴
"""

from __future__ import annotations

from typing import Any, cast

from langgraph.graph import END, START, StateGraph

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.coordinator.graph import (
    COORDINATOR_SUBGRAPH,
)
from simula.application.workflow.graphs.runtime.nodes.lifecycle import (
    initialize_runtime_state,
    route_after_stop,
)
from simula.application.workflow.graphs.runtime.nodes.observation import (
    observe_step,
    stop_step,
)
from simula.application.workflow.graphs.runtime.nodes.persistence import (
    persist_step_artifacts,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)

_graph = StateGraph(
    state_schema=cast(Any, SimulationWorkflowState),
    context_schema=WorkflowRuntimeContext,
)
_graph.add_node("initialize_runtime_state", initialize_runtime_state)
_graph.add_node("coordinator", COORDINATOR_SUBGRAPH)
_graph.add_node("observe_step", observe_step)
_graph.add_node("persist_step_artifacts", persist_step_artifacts)
_graph.add_node("stop_step", stop_step)
_graph.add_edge(START, "initialize_runtime_state")
_graph.add_edge("initialize_runtime_state", "coordinator")
_graph.add_edge("coordinator", "observe_step")
_graph.add_edge("persist_step_artifacts", "stop_step")
_graph.add_edge("observe_step", "persist_step_artifacts")
_graph.add_conditional_edges(
    "stop_step",
    route_after_stop,
    {
        "coordinator": "coordinator",
        "complete": END,
    },
)

RUNTIME_SUBGRAPH = _graph.compile(name="runtime")
