"""Purpose:
- Provide the compact runtime subgraph singleton.
"""

from __future__ import annotations

from typing import Any, cast

from langgraph.graph import END, START, StateGraph
from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.coordinator.nodes.assess_round_continuation import (
    assess_round_continuation,
)
from simula.application.workflow.graphs.coordinator.nodes.resolve_round import (
    resolve_round,
)
from simula.application.workflow.graphs.coordinator.nodes.build_round_directive import (
    build_round_directive,
)
from simula.application.workflow.graphs.coordinator.nodes.prepare_focus_candidates import (
    prepare_focus_candidates,
)
from simula.application.workflow.graphs.runtime.nodes.actor_turn import (
    build_actor_proposal_task,
    dispatch_selected_actor_proposals,
    generate_actor_proposal,
    reduce_actor_proposals,
)
from simula.application.workflow.graphs.runtime.nodes.lifecycle import (
    initialize_runtime_state,
    route_after_continuation_check,
    route_after_resolution,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)


def prepare_actor_proposal_queue(
    state: SimulationWorkflowState,
) -> dict[str, object]:
    """직렬 runtime 경로용 actor proposal queue를 준비한다."""

    return {
        "pending_actor_cast_ids": list(state.get("selected_cast_ids", [])),
    }


def route_actor_proposal_queue(state: SimulationWorkflowState) -> str:
    """직렬 actor proposal queue 다음 단계를 고른다."""

    if list(state.get("pending_actor_cast_ids", [])):
        return "generate_actor_proposal_serial"
    return "resolve_round"


async def generate_actor_proposal_serial(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """한 명의 actor proposal을 순차 처리한다."""

    pending_cast_ids = list(state.get("pending_actor_cast_ids", []))
    if not pending_cast_ids:
        return {}

    cast_id = str(pending_cast_ids[0])
    task_payload = build_actor_proposal_task(
        state=state,
        cast_id=cast_id,
    )
    result = await generate_actor_proposal(
        cast(
            SimulationWorkflowState,
            {
                **state,
                "actor_proposal_task": task_payload,
            },
        ),
        runtime,
    )
    return {
        "pending_actor_cast_ids": pending_cast_ids[1:],
        **result,
    }


def _build_parallel_runtime_graph() -> StateGraph:
    graph = StateGraph(
        state_schema=cast(Any, SimulationWorkflowState),
        context_schema=WorkflowRuntimeContext,
    )
    graph.add_node("initialize_runtime_state", initialize_runtime_state)
    graph.add_node("assess_round_continuation", assess_round_continuation)
    graph.add_node("prepare_round", prepare_focus_candidates)
    graph.add_node("plan_round", build_round_directive)
    graph.add_node("generate_actor_proposal", generate_actor_proposal)
    graph.add_node("reduce_actor_proposals", reduce_actor_proposals)
    graph.add_node("resolve_round", resolve_round)
    graph.add_edge(START, "initialize_runtime_state")
    graph.add_edge("initialize_runtime_state", "assess_round_continuation")
    graph.add_conditional_edges(
        "assess_round_continuation",
        route_after_continuation_check,
        {
            "prepare_round": "prepare_round",
            "complete": END,
        },
    )
    graph.add_edge("prepare_round", "plan_round")
    graph.add_conditional_edges("plan_round", dispatch_selected_actor_proposals)
    graph.add_edge("generate_actor_proposal", "reduce_actor_proposals")
    graph.add_edge("reduce_actor_proposals", "resolve_round")
    graph.add_conditional_edges(
        "resolve_round",
        route_after_resolution,
        {
            "continuation_check": "assess_round_continuation",
            "complete": END,
        },
    )
    return graph


def _build_serial_runtime_graph() -> StateGraph:
    graph = StateGraph(
        state_schema=cast(Any, SimulationWorkflowState),
        context_schema=WorkflowRuntimeContext,
    )
    graph.add_node("initialize_runtime_state", initialize_runtime_state)
    graph.add_node("assess_round_continuation", assess_round_continuation)
    graph.add_node("prepare_round", prepare_focus_candidates)
    graph.add_node("plan_round", build_round_directive)
    graph.add_node("prepare_actor_proposal_queue", prepare_actor_proposal_queue)
    graph.add_node("generate_actor_proposal_serial", generate_actor_proposal_serial)
    graph.add_node("resolve_round", resolve_round)
    graph.add_edge(START, "initialize_runtime_state")
    graph.add_edge("initialize_runtime_state", "assess_round_continuation")
    graph.add_conditional_edges(
        "assess_round_continuation",
        route_after_continuation_check,
        {
            "prepare_round": "prepare_round",
            "complete": END,
        },
    )
    graph.add_edge("prepare_round", "plan_round")
    graph.add_edge("plan_round", "prepare_actor_proposal_queue")
    graph.add_conditional_edges(
        "prepare_actor_proposal_queue",
        route_actor_proposal_queue,
        {
            "generate_actor_proposal_serial": "generate_actor_proposal_serial",
            "resolve_round": "resolve_round",
        },
    )
    graph.add_conditional_edges(
        "generate_actor_proposal_serial",
        route_actor_proposal_queue,
        {
            "generate_actor_proposal_serial": "generate_actor_proposal_serial",
            "resolve_round": "resolve_round",
        },
    )
    graph.add_conditional_edges(
        "resolve_round",
        route_after_resolution,
        {
            "continuation_check": "assess_round_continuation",
            "complete": END,
        },
    )
    return graph


RUNTIME_SUBGRAPH_GRAPH = _build_parallel_runtime_graph()
RUNTIME_SUBGRAPH_SERIAL_GRAPH = _build_serial_runtime_graph()
RUNTIME_SUBGRAPH = RUNTIME_SUBGRAPH_GRAPH.compile(name="runtime")
RUNTIME_SUBGRAPH_SERIAL = RUNTIME_SUBGRAPH_SERIAL_GRAPH.compile(name="runtime")
