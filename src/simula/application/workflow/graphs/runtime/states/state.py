"""Purpose:
- Define required runtime step fragments.
"""

from __future__ import annotations

from typing import Any, TypedDict


class ActorProposalTask(TypedDict):
    """Fan-out actor proposal payload."""

    actor: dict[str, Any]
    unread_activity_ids: list[str]
    visible_action_context: list[dict[str, object]]
    unread_backlog_digest: dict[str, object]
    visible_actors: list[dict[str, object]]
    focus_slice: dict[str, Any]
    runtime_guidance: dict[str, object]


class ActorProposalResult(TypedDict):
    """Fan-out actor proposal result."""

    actor_id: str
    unread_activity_ids: list[str]
    proposal: dict[str, Any]
    forced_idle: bool
    parse_failure_count: int
    latency_seconds: float
