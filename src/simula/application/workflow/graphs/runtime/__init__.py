"""Runtime graph package."""

from __future__ import annotations

from importlib import import_module
from typing import Any

__all__ = ["RUNTIME_SUBGRAPH", "RUNTIME_SUBGRAPH_SERIAL"]


def __getattr__(name: str) -> Any:
    if name in {"RUNTIME_SUBGRAPH", "RUNTIME_SUBGRAPH_SERIAL"}:
        return getattr(
            import_module("simula.application.workflow.graphs.runtime.graph"),
            name,
        )
    raise AttributeError(name)
