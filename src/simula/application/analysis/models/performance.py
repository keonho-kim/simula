"""Performance, token, and fixer analyzer models."""

from __future__ import annotations

from dataclasses import dataclass

from simula.application.analysis.localization import role_label
from simula.application.analysis.models.base import MetricDistribution, NumericSummary


@dataclass(slots=True)
class DistributionReport:
    """Top-level distribution bundle for artifact writing."""

    overall: dict[str, MetricDistribution]
    by_role: dict[str, dict[str, MetricDistribution]]


@dataclass(slots=True)
class PerformanceSummaryRow:
    """One input/output token bin row for performance percentiles."""

    input_tokens_bin_start: int
    input_tokens_bin_end: int
    output_tokens_bin_start: int
    output_tokens_bin_end: int
    call_count: int
    ttft_sample_count: int
    duration_sample_count: int
    ttft_p90: float | None
    ttft_p95: float | None
    ttft_p99: float | None
    duration_p90: float | None
    duration_p95: float | None
    duration_p99: float | None

    def to_row(self) -> dict[str, object]:
        return {
            "input_tokens_bin_start": self.input_tokens_bin_start,
            "input_tokens_bin_end": self.input_tokens_bin_end,
            "output_tokens_bin_start": self.output_tokens_bin_start,
            "output_tokens_bin_end": self.output_tokens_bin_end,
            "call_count": self.call_count,
            "ttft_sample_count": self.ttft_sample_count,
            "duration_sample_count": self.duration_sample_count,
            "ttft_p90": self.ttft_p90,
            "ttft_p95": self.ttft_p95,
            "ttft_p99": self.ttft_p99,
            "duration_p90": self.duration_p90,
            "duration_p95": self.duration_p95,
            "duration_p99": self.duration_p99,
        }


@dataclass(slots=True)
class PerformanceSummaryReport:
    """2D token-bin performance percentile summary."""

    rows: list[PerformanceSummaryRow]


@dataclass(slots=True)
class TokenUsageRoleSummary:
    """Aggregated token usage totals for one role."""

    role: str
    call_count: int
    input_tokens_total: int
    output_tokens_total: int
    total_tokens_total: int
    input_tokens_missing_count: int
    output_tokens_missing_count: int
    total_tokens_missing_count: int
    input_tokens_stats: NumericSummary
    output_tokens_stats: NumericSummary
    total_tokens_stats: NumericSummary

    def to_dict(self) -> dict[str, object]:
        return {
            "role": self.role,
            "role_label": role_label(self.role),
            "call_count": self.call_count,
            "input_tokens_total": self.input_tokens_total,
            "output_tokens_total": self.output_tokens_total,
            "total_tokens_total": self.total_tokens_total,
            "input_tokens_missing_count": self.input_tokens_missing_count,
            "output_tokens_missing_count": self.output_tokens_missing_count,
            "total_tokens_missing_count": self.total_tokens_missing_count,
            "input_tokens_stats": self.input_tokens_stats.to_dict(),
            "output_tokens_stats": self.output_tokens_stats.to_dict(),
            "total_tokens_stats": self.total_tokens_stats.to_dict(),
        }

    def to_row(self) -> dict[str, object]:
        return {
            "role": self.role,
            "role_label": role_label(self.role),
            "call_count": self.call_count,
            "input_tokens_total": self.input_tokens_total,
            "output_tokens_total": self.output_tokens_total,
            "total_tokens_total": self.total_tokens_total,
            "input_tokens_missing_count": self.input_tokens_missing_count,
            "output_tokens_missing_count": self.output_tokens_missing_count,
            "total_tokens_missing_count": self.total_tokens_missing_count,
            **self.input_tokens_stats.to_flat_dict(prefix="input_tokens"),
            **self.output_tokens_stats.to_flat_dict(prefix="output_tokens"),
            **self.total_tokens_stats.to_flat_dict(prefix="total_tokens"),
        }


@dataclass(slots=True)
class TokenUsageReport:
    """Serializable token usage bundle."""

    overall: TokenUsageRoleSummary
    by_role: dict[str, TokenUsageRoleSummary]

    def to_dict(self) -> dict[str, object]:
        return {
            "overall": self.overall.to_dict(),
            "by_role": {
                role: summary.to_dict()
                for role, summary in sorted(self.by_role.items())
            },
        }

    def summary_rows(self) -> list[dict[str, object]]:
        rows = [self.overall.to_row()]
        rows.extend(self.by_role[role].to_row() for role in sorted(self.by_role))
        return rows


@dataclass(slots=True)
class FixerAttemptRecord:
    """One fixer `llm_call` annotated with role attribution."""

    sequence: int
    attempt: int
    attributed_role: str
    schema_name: str
    ttft_seconds: float | None
    duration_seconds: float
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None

    def to_dict(self) -> dict[str, object]:
        return {
            "sequence": self.sequence,
            "attempt": self.attempt,
            "attributed_role": self.attributed_role,
            "attributed_role_label": role_label(self.attributed_role),
            "schema_name": self.schema_name,
            "ttft_seconds": self.ttft_seconds,
            "duration_seconds": self.duration_seconds,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
        }


@dataclass(slots=True)
class FixerSessionRecord:
    """One grouped fixer session starting from attempt 1."""

    session_index: int
    attributed_role: str
    schema_name: str
    attempt_count: int
    retry_count: int
    first_sequence: int
    last_sequence: int
    ttft_seconds: float | None
    duration_seconds: float
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None

    def to_dict(self) -> dict[str, object]:
        return {
            "session_index": self.session_index,
            "attributed_role": self.attributed_role,
            "attributed_role_label": role_label(self.attributed_role),
            "schema_name": self.schema_name,
            "attempt_count": self.attempt_count,
            "retry_count": self.retry_count,
            "first_sequence": self.first_sequence,
            "last_sequence": self.last_sequence,
            "ttft_seconds": self.ttft_seconds,
            "duration_seconds": self.duration_seconds,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.total_tokens,
        }


@dataclass(slots=True)
class FixerRoleSummary:
    """Aggregated fixer summary for one attributed role."""

    role: str
    fixer_call_count: int
    session_count: int
    retry_count: int
    ttft: NumericSummary
    duration: NumericSummary

    def to_dict(self) -> dict[str, object]:
        return {
            "role": self.role,
            "role_label": role_label(self.role),
            "fixer_call_count": self.fixer_call_count,
            "session_count": self.session_count,
            "retry_count": self.retry_count,
            "ttft": self.ttft.to_dict(),
            "duration": self.duration.to_dict(),
        }

    def to_row(self) -> dict[str, object]:
        return {
            "role": self.role,
            "role_label": role_label(self.role),
            "fixer_call_count": self.fixer_call_count,
            "session_count": self.session_count,
            "retry_count": self.retry_count,
            **self.ttft.to_flat_dict(prefix="ttft"),
            **self.duration.to_flat_dict(prefix="duration"),
        }


@dataclass(slots=True)
class FixerReport:
    """Serializable fixer analysis bundle."""

    attempts: list[FixerAttemptRecord]
    sessions: list[FixerSessionRecord]
    overall: FixerRoleSummary
    by_role: dict[str, FixerRoleSummary]

    def to_dict(self) -> dict[str, object]:
        return {
            "overall": self.overall.to_dict(),
            "by_role": {
                role: summary.to_dict() for role, summary in sorted(self.by_role.items())
            },
            "sessions": [session.to_dict() for session in self.sessions],
        }

    def summary_rows(self) -> list[dict[str, object]]:
        rows = [self.overall.to_row()]
        rows.extend(self.by_role[role].to_row() for role in sorted(self.by_role))
        return rows
