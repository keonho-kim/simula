"""Purpose:
- Provide stable custom stream emission helpers for workflow nodes.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import cast

from langgraph.config import get_stream_writer


def emit_custom_event(entry: dict[str, object]) -> None:
    """Emit one custom stream event when a writer is available."""

    try:
        writer = cast(Callable[[object], None], get_stream_writer())
    except RuntimeError:
        return
    writer(
        {
            "stream": "simulation_log",
            "entry": entry,
        }
    )
