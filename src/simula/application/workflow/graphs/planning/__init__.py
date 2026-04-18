"""Planning graph package."""

from __future__ import annotations

from importlib import import_module
from typing import Any

__all__ = ["PLANNING_SUBGRAPH", "PLANNING_SUBGRAPH_SERIAL"]


def __getattr__(name: str) -> Any:
    if name in {"PLANNING_SUBGRAPH", "PLANNING_SUBGRAPH_SERIAL"}:
        return getattr(
            import_module("simula.application.workflow.graphs.planning.graph"),
            name,
        )
    raise AttributeError(name)
