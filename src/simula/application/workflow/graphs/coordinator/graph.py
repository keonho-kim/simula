"""목적:
- coordinator 서브그래프 singleton을 제공한다.

설명:
- 후보 압축, focus 계획, 배경 요약, actor proposal fan-out, 채택 정리를 하나의 subgraph로 묶는다.

사용한 설계 패턴:
- subgraph singleton 패턴
"""

from __future__ import annotations

from typing import Any, cast

from langgraph.graph import END, START, StateGraph

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.coordinator.nodes.adjudicate_step_focus import (
    adjudicate_step_focus,
)
from simula.application.workflow.graphs.coordinator.nodes.build_step_focus_plan import (
    build_step_focus_plan,
)
from simula.application.workflow.graphs.coordinator.nodes.prepare_focus_candidates import (
    prepare_focus_candidates,
)
from simula.application.workflow.graphs.coordinator.nodes.summarize_background_updates import (
    summarize_background_updates,
)
from simula.application.workflow.graphs.runtime.nodes.actor_turn import (
    dispatch_selected_actor_proposals,
    generate_actor_proposal,
    reduce_actor_proposals,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)

_graph = StateGraph(
    state_schema=cast(Any, SimulationWorkflowState),
    context_schema=WorkflowRuntimeContext,
)
_graph.add_node("prepare_focus_candidates", prepare_focus_candidates)
_graph.add_node("build_step_focus_plan", build_step_focus_plan)
_graph.add_node("summarize_background_updates", summarize_background_updates)
_graph.add_node("generate_actor_proposal", generate_actor_proposal)
_graph.add_node("reduce_actor_proposals", reduce_actor_proposals)
_graph.add_node("adjudicate_step_focus", adjudicate_step_focus)
_graph.add_edge(START, "prepare_focus_candidates")
_graph.add_edge("prepare_focus_candidates", "build_step_focus_plan")
_graph.add_edge("build_step_focus_plan", "summarize_background_updates")
_graph.add_conditional_edges(
    "summarize_background_updates",
    dispatch_selected_actor_proposals,
)
_graph.add_edge("generate_actor_proposal", "reduce_actor_proposals")
_graph.add_edge("reduce_actor_proposals", "adjudicate_step_focus")
_graph.add_edge("adjudicate_step_focus", END)

COORDINATOR_SUBGRAPH = _graph.compile(name="coordinator")
