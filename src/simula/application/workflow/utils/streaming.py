"""Purpose:
- Provide stable custom stream emission helpers for workflow nodes.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import TYPE_CHECKING, cast

from langgraph.config import get_stream_writer

if TYPE_CHECKING:
    from simula.application.workflow.context import WorkflowRuntimeContext


def record_simulation_log_event(
    context: "WorkflowRuntimeContext",
    entry: dict[str, object],
) -> None:
    """Write one durable simulation-log event and mirror it to custom streaming."""

    if context.run_jsonl_appender is not None:
        context.run_jsonl_appender.append(entry)
    emit_custom_event(entry)


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
