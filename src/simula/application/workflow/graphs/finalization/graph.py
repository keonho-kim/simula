"""목적:
- finalization 서브그래프 singleton을 제공한다.

설명:
- 최종 리포트 생성과 저장 단계를 하나의 subgraph로 묶는다.

사용한 설계 패턴:
- subgraph singleton 패턴
"""

from __future__ import annotations

from typing import Any, cast

from langgraph.graph import END, START, StateGraph

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.finalization.nodes.assemble_body_sections import (
    assemble_body_sections,
)
from simula.application.workflow.graphs.finalization.nodes.assemble_markdown_report import (
    assemble_markdown_report,
)
from simula.application.workflow.graphs.finalization.nodes.build_report_projection import (
    build_report_projection,
)
from simula.application.workflow.graphs.finalization.nodes.build_final_report_payload import (
    build_final_report_payload,
)
from simula.application.workflow.graphs.finalization.nodes.build_simulation_log import (
    build_simulation_log,
)
from simula.application.workflow.graphs.finalization.nodes.persist_final_report import (
    persist_final_report,
)
from simula.application.workflow.graphs.finalization.nodes.resolve_timeline_anchor import (
    resolve_timeline_anchor,
)
from simula.application.workflow.graphs.finalization.nodes.write_actor_dynamics_section import (
    write_actor_dynamics_section,
)
from simula.application.workflow.graphs.finalization.nodes.write_actor_final_results_section import (
    write_actor_final_results_section,
)
from simula.application.workflow.graphs.finalization.nodes.write_major_events_section import (
    write_major_events_section,
)
from simula.application.workflow.graphs.finalization.nodes.write_simulation_conclusion_section import (
    write_simulation_conclusion_section,
)
from simula.application.workflow.graphs.finalization.nodes.write_timeline_section import (
    write_timeline_section,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)

_graph = StateGraph(
    state_schema=cast(Any, SimulationWorkflowState),
    context_schema=WorkflowRuntimeContext,
)
_graph.add_node("build_final_report_payload", build_final_report_payload)
_graph.add_node("build_simulation_log", build_simulation_log)
_graph.add_node("resolve_timeline_anchor", resolve_timeline_anchor)
_graph.add_node("build_report_projection", build_report_projection)
_graph.add_node("write_timeline_section", write_timeline_section)
_graph.add_node("write_actor_dynamics_section", write_actor_dynamics_section)
_graph.add_node("write_major_events_section", write_major_events_section)
_graph.add_node("assemble_body_sections", assemble_body_sections)
_graph.add_node(
    "write_actor_final_results_section",
    write_actor_final_results_section,
)
_graph.add_node(
    "write_simulation_conclusion_section",
    write_simulation_conclusion_section,
)
_graph.add_node("assemble_markdown_report", assemble_markdown_report)
_graph.add_node("persist_final_report", persist_final_report)
_graph.add_edge(START, "build_final_report_payload")
_graph.add_edge("build_final_report_payload", "build_simulation_log")
_graph.add_edge("build_simulation_log", "resolve_timeline_anchor")
_graph.add_edge("resolve_timeline_anchor", "build_report_projection")
_graph.add_edge("build_report_projection", "write_timeline_section")
_graph.add_edge("build_report_projection", "write_actor_dynamics_section")
_graph.add_edge("build_report_projection", "write_major_events_section")
_graph.add_edge("write_timeline_section", "assemble_body_sections")
_graph.add_edge("write_actor_dynamics_section", "assemble_body_sections")
_graph.add_edge("write_major_events_section", "assemble_body_sections")
_graph.add_edge("assemble_body_sections", "write_actor_final_results_section")
_graph.add_edge(
    "write_actor_final_results_section",
    "write_simulation_conclusion_section",
)
_graph.add_edge("write_simulation_conclusion_section", "assemble_markdown_report")
_graph.add_edge("assemble_markdown_report", "persist_final_report")
_graph.add_edge("persist_final_report", END)

FINALIZATION_SUBGRAPH = _graph.compile(name="finalization")
