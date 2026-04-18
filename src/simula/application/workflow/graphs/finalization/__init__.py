"""Finalization graph package."""

from __future__ import annotations

from importlib import import_module
from typing import Any

__all__ = ["FINALIZATION_SUBGRAPH", "FINALIZATION_SUBGRAPH_SERIAL"]


def __getattr__(name: str) -> Any:
    if name in {"FINALIZATION_SUBGRAPH", "FINALIZATION_SUBGRAPH_SERIAL"}:
        return getattr(
            import_module("simula.application.workflow.graphs.finalization.graph"),
            name,
        )
    raise AttributeError(name)
