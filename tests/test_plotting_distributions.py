"""Purpose:
- Verify distribution plot axis spacing for time metrics.
"""

from __future__ import annotations

import matplotlib.pyplot as plt
from matplotlib.ticker import MultipleLocator

from simula.application.analysis.models import MetricDistribution
from simula.application.analysis.plotting.distributions import _render_distribution_axis


def test_render_distribution_axis_uses_quarter_second_ticks_for_ttft() -> None:
    distribution = MetricDistribution(
        metric="ttft_seconds",
        record_count=3,
        sample_count=3,
        missing_count=0,
        min_value=0.1,
        max_value=0.6,
        mean_value=0.3,
        median_value=0.2,
        p90_value=0.5,
        p95_value=0.55,
        p99_value=0.59,
        histogram_bin_edges=[0.1, 0.35, 0.6],
        histogram_counts=[2, 1],
        kde_x=[0.1, 0.2, 0.3],
        kde_y=[1.0, 0.7, 0.4],
    )
    figure, axis = plt.subplots()
    try:
        _render_distribution_axis(axis=axis, distribution=distribution)

        locator = axis.xaxis.get_major_locator()
        assert isinstance(locator, MultipleLocator)
        tick_values = locator.tick_values(*axis.get_xlim())
        assert tick_values[1] - tick_values[0] == 0.25
        xlim = axis.get_xlim()
        assert xlim == (0.0, 0.75)
    finally:
        plt.close(figure)


def test_render_distribution_axis_does_not_force_quarter_second_ticks_for_tokens() -> (
    None
):
    distribution = MetricDistribution(
        metric="input_tokens",
        record_count=3,
        sample_count=3,
        missing_count=0,
        min_value=10.0,
        max_value=50.0,
        mean_value=25.0,
        median_value=20.0,
        p90_value=45.0,
        p95_value=47.5,
        p99_value=49.5,
        histogram_bin_edges=[10.0, 30.0, 50.0],
        histogram_counts=[2, 1],
        kde_x=[10.0, 20.0, 30.0],
        kde_y=[0.1, 0.08, 0.05],
    )
    figure, axis = plt.subplots()
    try:
        _render_distribution_axis(axis=axis, distribution=distribution)

        locator = axis.xaxis.get_major_locator()
        if isinstance(locator, MultipleLocator):
            tick_values = locator.tick_values(*axis.get_xlim())
            assert tick_values[1] - tick_values[0] != 0.25
    finally:
        plt.close(figure)


def test_render_distribution_axis_uses_wider_ticks_for_wide_duration_range() -> None:
    distribution = MetricDistribution(
        metric="duration_seconds",
        record_count=4,
        sample_count=4,
        missing_count=0,
        min_value=0.3,
        max_value=57.2,
        mean_value=16.0,
        median_value=4.0,
        p90_value=45.0,
        p95_value=50.0,
        p99_value=56.0,
        histogram_bin_edges=[0.3, 10.0, 20.0, 40.0, 57.2],
        histogram_counts=[2, 1, 0, 1],
    )
    figure, axis = plt.subplots()
    try:
        _render_distribution_axis(axis=axis, distribution=distribution)

        locator = axis.xaxis.get_major_locator()
        assert isinstance(locator, MultipleLocator)
        tick_values = locator.tick_values(*axis.get_xlim())
        assert tick_values[1] - tick_values[0] == 10.0
        xlim = axis.get_xlim()
        assert xlim == (0.0, 60.0)
    finally:
        plt.close(figure)
