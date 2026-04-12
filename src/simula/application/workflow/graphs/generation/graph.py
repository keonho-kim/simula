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
from simula.application.workflow.graphs.generation.nodes.finalize import (
    finalize_generated_actors,
)
from simula.application.workflow.graphs.generation.nodes.persistence import (
    persist_generated_actors,
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

_graph = StateGraph(
    state_schema=cast(Any, SimulationWorkflowState),
    context_schema=WorkflowRuntimeContext,
)
_graph.add_node("prepare_actor_slots", prepare_actor_slots)
_graph.add_node("generate_actor_slot", generate_actor_slot)
_graph.add_node("finalize_generated_actors", finalize_generated_actors)
_graph.add_node("persist_generated_actors", persist_generated_actors)
_graph.add_edge(START, "prepare_actor_slots")
_graph.add_conditional_edges("prepare_actor_slots", dispatch_actor_slots)
_graph.add_edge("generate_actor_slot", "finalize_generated_actors")
_graph.add_edge("finalize_generated_actors", "persist_generated_actors")
_graph.add_edge("persist_generated_actors", END)

GENERATION_SUBGRAPH = _graph.compile(name="generation")
