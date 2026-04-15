"""Purpose:
- Aggregate cumulative token usage totals overall and by LLM role.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable

from simula.application.analysis.metrics.distributions import summarize_numeric_values
from simula.application.analysis.models import (
    LLMCallRecord,
    TokenUsageReport,
    TokenUsageRoleSummary,
)


def build_token_usage_report(
    llm_calls: list[LLMCallRecord],
) -> TokenUsageReport:
    """Build cumulative token usage totals overall and for each role."""

    by_role_calls: dict[str, list[LLMCallRecord]] = defaultdict(list)
    for record in llm_calls:
        by_role_calls[record.role].append(record)

    overall = _build_role_summary(role="overall", calls=llm_calls)
    by_role = {
        role: _build_role_summary(role=role, calls=records)
        for role, records in sorted(by_role_calls.items())
    }
    return TokenUsageReport(overall=overall, by_role=by_role)


def _build_role_summary(
    *,
    role: str,
    calls: list[LLMCallRecord],
) -> TokenUsageRoleSummary:
    return TokenUsageRoleSummary(
        role=role,
        call_count=len(calls),
        input_tokens_total=_sum_optional_int(record.input_tokens for record in calls),
        output_tokens_total=_sum_optional_int(record.output_tokens for record in calls),
        total_tokens_total=_sum_optional_int(record.total_tokens for record in calls),
        input_tokens_missing_count=sum(
            1 for record in calls if record.input_tokens is None
        ),
        output_tokens_missing_count=sum(
            1 for record in calls if record.output_tokens is None
        ),
        total_tokens_missing_count=sum(
            1 for record in calls if record.total_tokens is None
        ),
        input_tokens_stats=summarize_numeric_values(
            [float(record.input_tokens) for record in calls if record.input_tokens is not None]
        ),
        output_tokens_stats=summarize_numeric_values(
            [float(record.output_tokens) for record in calls if record.output_tokens is not None]
        ),
        total_tokens_stats=summarize_numeric_values(
            [float(record.total_tokens) for record in calls if record.total_tokens is not None]
        ),
    )


def _sum_optional_int(values: Iterable[int | None]) -> int:
    total = 0
    for value in values:
        if isinstance(value, int):
            total += value
    return total
