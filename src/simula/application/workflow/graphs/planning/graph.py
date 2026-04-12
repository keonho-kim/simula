"""목적:
- planning 서브그래프 singleton을 제공한다.

설명:
- 시나리오 해석 파트, 상황 확정, 등장인물 roster 생성, 계획 저장 단계를 하나의 subgraph로 묶는다.

사용한 설계 패턴:
- 모듈 singleton subgraph 패턴
"""

from __future__ import annotations

from typing import Any, cast

from langgraph.graph import END, START, StateGraph

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.planning.nodes.persistence import persist_plan
from simula.application.workflow.graphs.planning.nodes.planner import (
    assemble_interpretation,
    build_action_catalog,
    build_coordination_frame,
    build_cast_roster,
    decide_runtime_progression,
    finalize_situation,
    interpret_core,
    interpret_pressure_points,
    interpret_time_scope,
    interpret_visibility_context,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)

_graph = StateGraph(
    state_schema=cast(Any, SimulationWorkflowState),
    context_schema=WorkflowRuntimeContext,
)
_graph.add_node("interpret_core", interpret_core)
_graph.add_node("decide_runtime_progression", decide_runtime_progression)
_graph.add_node("interpret_time_scope", interpret_time_scope)
_graph.add_node("interpret_visibility_context", interpret_visibility_context)
_graph.add_node("interpret_pressure_points", interpret_pressure_points)
_graph.add_node("assemble_interpretation", assemble_interpretation)
_graph.add_node("finalize_situation", finalize_situation)
_graph.add_node("build_action_catalog", build_action_catalog)
_graph.add_node("build_coordination_frame", build_coordination_frame)
_graph.add_node("build_cast_roster", build_cast_roster)
_graph.add_node("persist_plan", persist_plan)
_graph.add_edge(START, "interpret_core")
_graph.add_edge("interpret_core", "decide_runtime_progression")
_graph.add_edge("decide_runtime_progression", "interpret_time_scope")
_graph.add_edge("interpret_time_scope", "interpret_visibility_context")
_graph.add_edge("interpret_visibility_context", "interpret_pressure_points")
_graph.add_edge("interpret_pressure_points", "assemble_interpretation")
_graph.add_edge("assemble_interpretation", "finalize_situation")
_graph.add_edge("finalize_situation", "build_action_catalog")
_graph.add_edge("build_action_catalog", "build_coordination_frame")
_graph.add_edge("build_coordination_frame", "build_cast_roster")
_graph.add_edge("build_cast_roster", "persist_plan")
_graph.add_edge("persist_plan", END)

PLANNING_SUBGRAPH = _graph.compile(name="planning")
