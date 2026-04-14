"""Purpose:
- Compute token and latency distributions for analyzer artifacts.
"""

from __future__ import annotations

from collections import defaultdict
from typing import cast

import numpy as np

from simula.application.analysis.models import (
    DistributionReport,
    LLMCallRecord,
    MetricDistribution,
    NumericSummary,
)

METRIC_NAMES = (
    "input_tokens",
    "output_tokens",
    "ttft_seconds",
    "duration_seconds",
)


def build_distribution_report(
    llm_calls: list[LLMCallRecord],
) -> DistributionReport:
    """Build overall and per-role distributions for supported metrics."""

    by_role_calls: dict[str, list[LLMCallRecord]] = defaultdict(list)
    for record in llm_calls:
        by_role_calls[record.role].append(record)

    overall = {
        metric: build_metric_distribution(llm_calls, metric=metric)
        for metric in METRIC_NAMES
    }
    by_role = {
        role: {
            metric: build_metric_distribution(records, metric=metric)
            for metric in METRIC_NAMES
        }
        for role, records in sorted(by_role_calls.items())
    }
    return DistributionReport(overall=overall, by_role=by_role)


def build_metric_distribution(
    records: list[LLMCallRecord],
    *,
    metric: str,
) -> MetricDistribution:
    """Build one serializable distribution summary."""

    raw_values = [_metric_value(record, metric=metric) for record in records]
    values = [value for value in raw_values if value is not None]
    numeric_values = np.asarray(values, dtype=float)
    histogram_counts, histogram_edges = _build_histogram(numeric_values)
    kde_x, kde_y, kde_skipped_reason = _build_kde(numeric_values)
    summary = summarize_numeric_values(values)
    return MetricDistribution(
        metric=metric,
        record_count=len(records),
        sample_count=len(values),
        missing_count=len(records) - len(values),
        min_value=summary.min_value,
        max_value=summary.max_value,
        mean_value=summary.mean_value,
        median_value=summary.median_value,
        p95_value=summary.p95_value,
        p99_value=summary.p99_value,
        histogram_bin_edges=histogram_edges,
        histogram_counts=histogram_counts,
        kde_x=kde_x,
        kde_y=kde_y,
        kde_skipped_reason=kde_skipped_reason,
    )


def summarize_numeric_values(values: list[float]) -> NumericSummary:
    """Return basic numeric summary statistics."""

    if not values:
        return NumericSummary(
            count=0,
            min_value=None,
            max_value=None,
            mean_value=None,
            median_value=None,
            p95_value=None,
            p99_value=None,
        )

    numeric_values = np.asarray(values, dtype=float)
    return NumericSummary(
        count=len(values),
        min_value=float(np.min(numeric_values)),
        max_value=float(np.max(numeric_values)),
        mean_value=float(np.mean(numeric_values)),
        median_value=float(np.median(numeric_values)),
        p95_value=float(np.percentile(numeric_values, 95)),
        p99_value=float(np.percentile(numeric_values, 99)),
    )


def _metric_value(record: LLMCallRecord, *, metric: str) -> float | None:
    value = getattr(record, metric, None)
    if value is None:
        return None
    return float(value)


def _build_histogram(values: np.ndarray) -> tuple[list[int], list[float]]:
    if values.size == 0:
        return [], []
    bin_count = min(30, max(1, int(np.ceil(np.sqrt(values.size)))))
    counts, edges = np.histogram(values, bins=bin_count)
    return [int(item) for item in counts.tolist()], [float(item) for item in edges.tolist()]


def _build_kde(values: np.ndarray) -> tuple[list[float], list[float], str | None]:
    if values.size < 2:
        return [], [], "KDE requires at least two valid values."
    if float(np.max(values)) == float(np.min(values)):
        return [], [], "KDE requires non-constant values."

    std = float(np.std(values, ddof=1))
    if std <= 0:
        return [], [], "KDE bandwidth is zero."
    bandwidth = 1.06 * std * (values.size ** (-1.0 / 5.0))
    if bandwidth <= 0:
        return [], [], "KDE bandwidth is zero."

    grid = np.linspace(float(np.min(values)), float(np.max(values)), 200)
    scaled = (grid[:, None] - values[None, :]) / bandwidth
    density = np.mean(
        np.exp(-0.5 * np.square(scaled))
        / (bandwidth * np.sqrt(2.0 * np.pi)),
        axis=1,
    )
    return (
        [float(item) for item in cast(list[float], grid.tolist())],
        [float(item) for item in cast(list[float], density.tolist())],
        None,
    )
