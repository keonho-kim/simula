"""Purpose:
- Define required generation worker payloads.
"""

from __future__ import annotations

from typing import Any, TypedDict


class ActorRosterChunkSpec(TypedDict):
    """One bundled actor-generation chunk."""

    chunk_index: int
    cast_items: list[dict[str, Any]]


class GeneratedActorResult(TypedDict):
    """One actor-generation result."""

    slot_index: int
    cast_id: str
    display_name: str
    actor: dict[str, Any]
    latency_seconds: float
    parse_failure_count: int
