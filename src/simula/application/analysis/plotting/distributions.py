"""Purpose:
- Render histogram and KDE plots for analyzer distribution artifacts.
"""

from __future__ import annotations

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path

from simula.application.analysis.localization import metric_label
from simula.application.analysis.models import MetricDistribution
from simula.application.analysis.plotting.fonts import configure_korean_font


def render_distribution_plot(
    distribution: MetricDistribution,
    *,
    title: str,
    output_path: Path,
) -> None:
    """Render one histogram + KDE figure as PNG."""

    output_path.parent.mkdir(parents=True, exist_ok=True)
    configure_korean_font()
    figure, axis = plt.subplots(figsize=(10, 6))
    try:
        if not distribution.histogram_counts or not distribution.histogram_bin_edges:
            axis.text(
                0.5,
                0.5,
                "유효한 값이 없습니다.",
                ha="center",
                va="center",
                transform=axis.transAxes,
            )
            axis.set_axis_off()
        else:
            left_edges = np.asarray(distribution.histogram_bin_edges[:-1], dtype=float)
            right_edges = np.asarray(distribution.histogram_bin_edges[1:], dtype=float)
            widths = right_edges - left_edges
            counts = np.asarray(distribution.histogram_counts, dtype=float)
            if distribution.sample_count > 0:
                density_heights = counts / (
                    float(distribution.sample_count) * np.where(widths == 0, 1.0, widths)
                )
            else:
                density_heights = counts
            axis.bar(
                left_edges,
                density_heights,
                width=widths,
                align="edge",
                alpha=0.35,
                color="#4C78A8",
                edgecolor="#2F4B6C",
                label="히스토그램",
            )
            if distribution.kde_x and distribution.kde_y:
                axis.plot(
                    distribution.kde_x,
                    distribution.kde_y,
                    color="#E45756",
                    linewidth=2.0,
                    label="KDE",
                )
            elif distribution.kde_skipped_reason:
                axis.text(
                    0.98,
                    0.95,
                    distribution.kde_skipped_reason,
                    ha="right",
                    va="top",
                    fontsize=9,
                    transform=axis.transAxes,
                    bbox={"facecolor": "white", "edgecolor": "#BBBBBB", "alpha": 0.9},
                )
            axis.set_xlabel(metric_label(distribution.metric))
            axis.set_ylabel("밀도")
            axis.legend(loc="best")
            axis.grid(alpha=0.2)
        axis.set_title(title)
        figure.tight_layout()
        figure.savefig(output_path, dpi=160)
    finally:
        plt.close(figure)
