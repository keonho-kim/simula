"""Purpose:
- Define planning fan-out worker payloads.
"""

from __future__ import annotations

from typing import Any, TypedDict


class PlanCastChunkSpec(TypedDict):
    """One cast-roster chunk assignment for parallel planning."""

    chunk_index: int
    cast_outline_items: list[dict[str, Any]]


class GeneratedPlanCastResult(TypedDict):
    """One completed cast-roster chunk result."""

    chunk_index: int
    cast_items: list[dict[str, Any]]
    parse_failure_count: int


def empty_plan_cast_chunk_spec() -> PlanCastChunkSpec:
    """Return a shape-valid empty planning chunk sentinel."""

    return {
        "chunk_index": 0,
        "cast_outline_items": [],
    }
