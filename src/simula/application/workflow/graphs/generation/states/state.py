"""Purpose:
- Define required generation worker payloads.
"""

from __future__ import annotations

from typing import Any, TypedDict


class CastSlotSpec(TypedDict):
    """One actor-generation slot."""

    slot_index: int
    cast_item: dict[str, Any]
    cast_id: str
    display_name: str
    group_name: str


class GeneratedActorResult(TypedDict):
    """One actor-generation result."""

    slot_index: int
    cast_id: str
    display_name: str
    actor: dict[str, Any]
    latency_seconds: float
    parse_failure_count: int


def empty_cast_slot_spec() -> CastSlotSpec:
    """Return a shape-valid empty generation slot sentinel."""

    return {
        "slot_index": 0,
        "cast_item": {},
        "cast_id": "",
        "display_name": "",
        "group_name": "",
    }
