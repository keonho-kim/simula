"""Purpose:
- Render growth and concentration plots for the analyzed network.
"""

from __future__ import annotations

from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
from matplotlib.ticker import PercentFormatter

from simula.application.analysis.models import NetworkGrowthReport, NetworkReport
from simula.application.analysis.plotting.fonts import configure_korean_font

_CONCENTRATION_ITEM_LIMIT = 20


def render_network_growth_metrics_plot(
    *,
    run_id: str,
    growth_report: NetworkGrowthReport,
    output_path: Path,
) -> None:
    """Render a 3x2 plot showing how the network grows over rounds."""

    output_path.parent.mkdir(parents=True, exist_ok=True)
    label_font = configure_korean_font()
    figure, axes = plt.subplots(3, 2, figsize=(13, 11))
    flat_axes = list(axes.flat)

    try:
        if not growth_report.rows:
            _render_empty_axes(
                figure=figure,
                axes=flat_axes,
                title=f"{run_id} 연결 흐름",
                message=growth_report.empty_reason or "표시할 성장 지표가 없습니다.",
            )
        else:
            rounds = [item.round_index for item in growth_report.rows]
            _plot_series(
                axis=flat_axes[0],
                rounds=rounds,
                values=[item.participating_actor_count for item in growth_report.rows],
                title="참여 행위자 수",
                color="#1f77b4",
            )
            _plot_series(
                axis=flat_axes[1],
                rounds=rounds,
                values=[item.edge_count for item in growth_report.rows],
                title="연결 수",
                color="#ff7f0e",
            )
            _plot_series(
                axis=flat_axes[2],
                rounds=rounds,
                values=[_none_to_nan(item.density) for item in growth_report.rows],
                title="밀도",
                color="#2ca02c",
                percent=True,
            )
            _plot_series(
                axis=flat_axes[3],
                rounds=rounds,
                values=[
                    _none_to_nan(item.average_path_depth)
                    for item in growth_report.rows
                ],
                title="평균 경로 깊이",
                color="#9467bd",
            )
            _plot_series(
                axis=flat_axes[4],
                rounds=rounds,
                values=[_none_to_nan(item.edge_growth_rate) for item in growth_report.rows],
                title="엣지 성장률",
                color="#8c564b",
            )
            _plot_series(
                axis=flat_axes[5],
                rounds=rounds,
                values=[
                    _none_to_nan(item.top20_interaction_share)
                    for item in growth_report.rows
                ],
                title="상위 20% actor 점유율",
                color="#d62728",
                percent=True,
            )
            for axis in flat_axes:
                axis.set_xlabel("라운드", fontfamily=label_font)
            figure.suptitle(f"{run_id} 연결 흐름", fontfamily=label_font)

        figure.tight_layout()
        figure.savefig(output_path, dpi=160)
    finally:
        plt.close(figure)


def render_network_concentration_plot(
    *,
    run_id: str,
    report: NetworkReport,
    output_path: Path,
) -> None:
    """Render actor and edge concentration bars using categorical labels."""

    output_path.parent.mkdir(parents=True, exist_ok=True)
    label_font = configure_korean_font()
    figure, axes = plt.subplots(2, 1, figsize=(14, 10))

    try:
        actor_items = _build_actor_concentration_items(report)
        edge_items = _build_edge_concentration_items(report)

        _plot_concentration_panel(
            axis=axes[0],
            labels=[item[0] for item in actor_items],
            weights=[item[1] for item in actor_items],
            title="행위자별 직접 연결 수",
            category_label="행위자",
            bar_color="#4c78a8",
        )
        _plot_concentration_panel(
            axis=axes[1],
            labels=[item[0] for item in edge_items],
            weights=[item[1] for item in edge_items],
            title="연결별 누적 횟수",
            category_label="연결",
            bar_color="#59a14f",
        )
        figure.suptitle(f"{run_id} 연결이 어디에 몰렸는지", fontfamily=label_font)
        figure.tight_layout()
        figure.savefig(output_path, dpi=160)
    finally:
        plt.close(figure)


def _plot_series(
    *,
    axis: plt.Axes,
    rounds: list[int],
    values: list[float | int],
    title: str,
    color: str,
    percent: bool = False,
) -> None:
    axis.plot(rounds, values, color=color, marker="o", linewidth=2.0, markersize=5.0)
    axis.set_title(title)
    axis.grid(alpha=0.2)
    axis.set_xticks(rounds)
    if percent:
        finite_values = [
            float(value)
            for value in values
            if np.isfinite(float(value))
        ]
        top = max(1.0, max(finite_values, default=0.0) * 1.1)
        axis.set_ylim(bottom=0.0, top=top)
        axis.yaxis.set_major_formatter(PercentFormatter(xmax=1.0))


def _plot_concentration_panel(
    *,
    axis: plt.Axes,
    labels: list[str],
    weights: list[float],
    title: str,
    category_label: str,
    bar_color: str,
) -> None:
    axis.set_title(title)
    if not weights:
        axis.text(0.5, 0.5, "표시할 값이 없습니다.", ha="center", va="center")
        axis.set_axis_off()
        return

    positions = np.arange(len(weights))
    axis.bar(positions, weights, color=bar_color, alpha=0.8)
    axis.set_xticks(positions)
    axis.set_xticklabels(labels, rotation=35, ha="right")
    axis.set_xlabel(category_label)
    axis.set_ylabel("횟수")
    axis.grid(alpha=0.2, axis="y")


def _build_actor_concentration_items(
    report: NetworkReport,
) -> list[tuple[str, float]]:
    return sorted(
        [
            (item.display_name, float(item.total_weight))
            for item in report.nodes
            if item.total_weight > 0
        ],
        key=lambda item: (-item[1], item[0]),
    )[:_CONCENTRATION_ITEM_LIMIT]


def _build_edge_concentration_items(
    report: NetworkReport,
) -> list[tuple[str, float]]:
    return sorted(
        [
            (
                _truncate_label(
                    f"{item.source_display_name} -> {item.target_display_name}"
                ),
                float(item.total_weight),
            )
            for item in report.edges
            if item.total_weight > 0
        ],
        key=lambda item: (-item[1], item[0]),
    )[:_CONCENTRATION_ITEM_LIMIT]


def _truncate_label(label: str, *, limit: int = 28) -> str:
    compact = " ".join(label.split())
    if len(compact) <= limit:
        return compact
    return compact[: limit - 1].rstrip() + "…"


def _render_empty_axes(
    *,
    figure: plt.Figure,
    axes: list[plt.Axes],
    title: str,
    message: str,
) -> None:
    for axis in axes:
        axis.set_axis_off()
    axes[0].text(0.5, 0.5, message, ha="center", va="center", transform=axes[0].transAxes)
    figure.suptitle(title)


def _none_to_nan(value: float | None) -> float:
    if value is None:
        return float("nan")
    return float(value)


__all__ = [
    "_CONCENTRATION_ITEM_LIMIT",
    "_build_actor_concentration_items",
    "_build_edge_concentration_items",
    "render_network_concentration_plot",
    "render_network_growth_metrics_plot",
]
