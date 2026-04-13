"""Purpose:
- Define required generation worker payloads.
"""

from __future__ import annotations

from typing import Any, TypedDict


class CastSlotSpec(TypedDict):
    """One actor-generation slot."""

    slot_index: int
    cast_item: dict[str, Any]


class GeneratedActorResult(TypedDict):
    """One actor-generation result."""

    slot_index: int
    cast_id: str
    actor: dict[str, Any]
    latency_seconds: float
    parse_failure_count: int
