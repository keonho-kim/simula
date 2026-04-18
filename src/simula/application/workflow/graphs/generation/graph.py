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
from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.generation.nodes.finalize import (
    finalize_generated_actors,
)
from simula.application.workflow.graphs.generation.nodes.preparation import (
    dispatch_actor_slots,
    prepare_actor_slots,
)
from simula.application.workflow.graphs.generation.nodes.slot_generation import (
    generate_actor_slot,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)

async def generate_actor_slot_serial(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """직렬 generation 경로에서 다음 actor slot을 하나 처리한다."""

    pending_slots = list(state.get("pending_cast_slots", []))
    if not pending_slots:
        return {}
    slot = pending_slots[0]
    result = await generate_actor_slot(
        cast(
            SimulationWorkflowState,
            {
                **state,
                "cast_slot": slot,
            },
        ),
        runtime,
    )
    return {
        "pending_cast_slots": pending_slots[1:],
        **result,
    }


def route_actor_slot_queue(state: SimulationWorkflowState) -> str:
    """직렬 generation slot queue 다음 단계를 고른다."""

    if list(state.get("pending_cast_slots", [])):
        return "generate_actor_slot_serial"
    return "finalize_generated_actors"


def _build_parallel_generation_graph() -> StateGraph:
    graph = StateGraph(
        state_schema=cast(Any, SimulationWorkflowState),
        context_schema=WorkflowRuntimeContext,
    )
    graph.add_node("prepare_actor_slots", prepare_actor_slots)
    graph.add_node("generate_actor_slot", generate_actor_slot)
    graph.add_node("finalize_generated_actors", finalize_generated_actors)
    graph.add_edge(START, "prepare_actor_slots")
    graph.add_conditional_edges("prepare_actor_slots", dispatch_actor_slots)
    graph.add_edge("generate_actor_slot", "finalize_generated_actors")
    graph.add_edge("finalize_generated_actors", END)
    return graph


def _build_serial_generation_graph() -> StateGraph:
    graph = StateGraph(
        state_schema=cast(Any, SimulationWorkflowState),
        context_schema=WorkflowRuntimeContext,
    )
    graph.add_node("prepare_actor_slots", prepare_actor_slots)
    graph.add_node("generate_actor_slot_serial", generate_actor_slot_serial)
    graph.add_node("finalize_generated_actors", finalize_generated_actors)
    graph.add_edge(START, "prepare_actor_slots")
    graph.add_conditional_edges(
        "prepare_actor_slots",
        route_actor_slot_queue,
        {
            "generate_actor_slot_serial": "generate_actor_slot_serial",
            "finalize_generated_actors": "finalize_generated_actors",
        },
    )
    graph.add_conditional_edges(
        "generate_actor_slot_serial",
        route_actor_slot_queue,
        {
            "generate_actor_slot_serial": "generate_actor_slot_serial",
            "finalize_generated_actors": "finalize_generated_actors",
        },
    )
    graph.add_edge("finalize_generated_actors", END)
    return graph


GENERATION_SUBGRAPH_GRAPH = _build_parallel_generation_graph()
GENERATION_SUBGRAPH_SERIAL_GRAPH = _build_serial_generation_graph()
GENERATION_SUBGRAPH = GENERATION_SUBGRAPH_GRAPH.compile(name="generation")
GENERATION_SUBGRAPH_SERIAL = GENERATION_SUBGRAPH_SERIAL_GRAPH.compile(name="generation")
