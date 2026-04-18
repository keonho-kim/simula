"""Purpose:
- Track run-scoped LLM usage metrics from actual transport calls.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from typing import Literal

from simula.shared.logging.llm import task_counter_key
from simula.domain.contracts import LLMUsageSummary

CallKind = Literal["structured", "text"]


@dataclass(slots=True)
class LLMUsageTracker:
    """Collect transport-call usage counters for one workflow run."""

    calls_by_role: Counter[str] = field(default_factory=Counter)
    calls_by_task: Counter[str] = field(default_factory=Counter)
    total_calls: int = 0
    structured_calls: int = 0
    text_calls: int = 0
    parse_failures: int = 0
    forced_defaults: int = 0
    _input_tokens_sum: int = 0
    _output_tokens_sum: int = 0
    _total_tokens_sum: int = 0
    _has_input_tokens: bool = False
    _has_output_tokens: bool = False
    _has_total_tokens: bool = False

    def record_transport_call(
        self,
        *,
        role: str,
        log_context: dict[str, object] | None,
        call_kind: CallKind,
        input_tokens: int | None,
        output_tokens: int | None,
        total_tokens: int | None,
    ) -> None:
        """Record one actual model request."""

        self.total_calls += 1
        self.calls_by_role[role] += 1
        self.calls_by_task[task_counter_key(role, log_context)] += 1
        if call_kind == "structured":
            self.structured_calls += 1
        else:
            self.text_calls += 1

        if input_tokens is not None:
            self._input_tokens_sum += input_tokens
            self._has_input_tokens = True
        if output_tokens is not None:
            self._output_tokens_sum += output_tokens
            self._has_output_tokens = True
        if total_tokens is not None:
            self._total_tokens_sum += total_tokens
            self._has_total_tokens = True

    def record_structured_outcome(
        self,
        *,
        parse_failures: int,
        forced_default: bool,
    ) -> None:
        """Record structured parse/default outcomes after orchestration completes."""

        self.parse_failures += parse_failures
        self.forced_defaults += int(forced_default)

    def snapshot(self) -> dict[str, object]:
        """Return a deterministic JSON-ready summary."""

        summary = LLMUsageSummary(
            total_calls=self.total_calls,
            calls_by_role={
                role: self.calls_by_role[role] for role in sorted(self.calls_by_role)
            },
            calls_by_task={
                task: self.calls_by_task[task] for task in sorted(self.calls_by_task)
            },
            structured_calls=self.structured_calls,
            text_calls=self.text_calls,
            parse_failures=self.parse_failures,
            forced_defaults=self.forced_defaults,
            input_tokens=(
                self._input_tokens_sum if self._has_input_tokens else None
            ),
            output_tokens=(
                self._output_tokens_sum if self._has_output_tokens else None
            ),
            total_tokens=(
                self._total_tokens_sum if self._has_total_tokens else None
            ),
        )
        return summary.model_dump(mode="json")
