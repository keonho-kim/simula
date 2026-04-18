"""Simulation graph package."""

from __future__ import annotations

from importlib import import_module
from typing import Any

__all__ = [
    "SIMULATION_WORKFLOW",
    "SIMULATION_WORKFLOW_GRAPH",
    "SIMULATION_WORKFLOW_PARALLEL",
    "SIMULATION_WORKFLOW_GRAPH_PARALLEL",
]


def __getattr__(name: str) -> Any:
    if name in {
        "SIMULATION_WORKFLOW",
        "SIMULATION_WORKFLOW_GRAPH",
        "SIMULATION_WORKFLOW_PARALLEL",
        "SIMULATION_WORKFLOW_GRAPH_PARALLEL",
    }:
        return getattr(
            import_module("simula.application.workflow.graphs.simulation.graph"),
            name,
        )
    raise AttributeError(name)
