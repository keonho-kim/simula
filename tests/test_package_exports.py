"""Verify canonical package exports remain importable after refactors."""

from __future__ import annotations

from simula.application.commands import execute_single_run
from simula.application.analysis.models import (
    NetworkReport,
    TokenUsageReport,
)
from simula.application.services import SimulationExecutor
from simula.application.workflow.fixer import repair_structured_json
from simula.application.workflow.graphs.finalization import FINALIZATION_SUBGRAPH
from simula.application.workflow.graphs.generation import GENERATION_SUBGRAPH
from simula.application.workflow.graphs.planning import PLANNING_SUBGRAPH
from simula.application.workflow.graphs.runtime import RUNTIME_SUBGRAPH
from simula.application.workflow.graphs.simulation import SIMULATION_WORKFLOW
from simula.shared.io import RunJsonlAppender
from simula.shared.logging import build_llm_log_context
from simula.domain import ActionCatalog, TimelineAnchorDecision
from simula.entrypoints import cli


def test_domain_exports_expose_canonical_contracts() -> None:
    assert ActionCatalog.__name__ == "ActionCatalog"
    assert TimelineAnchorDecision.__name__ == "TimelineAnchorDecision"


def test_entrypoint_modules_remain_packaged() -> None:
    assert callable(cli.main)


def test_analysis_model_exports_remain_stable() -> None:
    assert NetworkReport.__name__ == "NetworkReport"
    assert TokenUsageReport.__name__ == "TokenUsageReport"


def test_application_exports_remain_stable() -> None:
    assert callable(execute_single_run)
    assert SimulationExecutor.__name__ == "SimulationExecutor"
    assert callable(repair_structured_json)
    assert PLANNING_SUBGRAPH.name == "planning"
    assert GENERATION_SUBGRAPH.name == "generation"
    assert RUNTIME_SUBGRAPH.name == "runtime"
    assert FINALIZATION_SUBGRAPH.name == "finalization"
    assert SIMULATION_WORKFLOW.name == "simula"


def test_common_exports_remain_stable() -> None:
    assert callable(build_llm_log_context)
    assert RunJsonlAppender.__name__ == "RunJsonlAppender"
