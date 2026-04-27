"""목적:
- generation 서브그래프 singleton을 제공한다.

설명:
- actor slot 준비, 병렬 생성, 결과 확정, 저장 단계를 하나의 subgraph로 묶는다.

사용한 설계 패턴:
- fan-out/fan-in subgraph singleton 패턴
"""

from __future__ import annotations

from typing import Any, cast

from langgraph.graph import END, START, StateGraph

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.generation.nodes.finalize_actor_roster import (
    finalize_actor_roster,
)
from simula.application.workflow.graphs.generation.nodes.generate_actor_roster_chunk import (
    generate_actor_roster_chunk,
    generate_actor_roster_chunk_serial,
)
from simula.application.workflow.graphs.generation.nodes.prepare_actor_roster_chunks import (
    prepare_actor_roster_chunks,
)
from simula.application.workflow.graphs.generation.utils.roster import (
    dispatch_actor_roster_chunks,
    route_actor_roster_chunk_queue,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)


def _build_parallel_generation_graph() -> Any:
    graph = StateGraph(
        state_schema=cast(Any, SimulationWorkflowState),
        context_schema=WorkflowRuntimeContext,
    )
    graph.add_node("prepare_actor_roster_chunks", prepare_actor_roster_chunks)
    graph.add_node("generate_actor_roster_chunk", generate_actor_roster_chunk)
    graph.add_node("finalize_actor_roster", finalize_actor_roster)
    graph.add_edge(START, "prepare_actor_roster_chunks")
    graph.add_conditional_edges(
        "prepare_actor_roster_chunks",
        dispatch_actor_roster_chunks,
    )
    graph.add_edge("generate_actor_roster_chunk", "finalize_actor_roster")
    graph.add_edge("finalize_actor_roster", END)
    return graph


def _build_serial_generation_graph() -> Any:
    graph = StateGraph(
        state_schema=cast(Any, SimulationWorkflowState),
        context_schema=WorkflowRuntimeContext,
    )
    graph.add_node("prepare_actor_roster_chunks", prepare_actor_roster_chunks)
    graph.add_node("generate_actor_roster_chunk_serial", generate_actor_roster_chunk_serial)
    graph.add_node("finalize_actor_roster", finalize_actor_roster)
    graph.add_edge(START, "prepare_actor_roster_chunks")
    graph.add_conditional_edges(
        "prepare_actor_roster_chunks",
        route_actor_roster_chunk_queue,
        {
            "generate_actor_roster_chunk_serial": "generate_actor_roster_chunk_serial",
            "finalize_actor_roster": "finalize_actor_roster",
        },
    )
    graph.add_conditional_edges(
        "generate_actor_roster_chunk_serial",
        route_actor_roster_chunk_queue,
        {
            "generate_actor_roster_chunk_serial": "generate_actor_roster_chunk_serial",
            "finalize_actor_roster": "finalize_actor_roster",
        },
    )
    graph.add_edge("finalize_actor_roster", END)
    return graph


GENERATION_SUBGRAPH_GRAPH = _build_parallel_generation_graph()
GENERATION_SUBGRAPH_SERIAL_GRAPH = _build_serial_generation_graph()
GENERATION_SUBGRAPH = GENERATION_SUBGRAPH_GRAPH.compile(name="generation")
GENERATION_SUBGRAPH_SERIAL = GENERATION_SUBGRAPH_SERIAL_GRAPH.compile(name="generation")
