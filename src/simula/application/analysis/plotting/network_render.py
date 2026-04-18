"""Purpose:
- Render static network PNG frames and expose visual helper functions.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
import networkx as nx
import numpy as np

from simula.application.analysis.plotting.fonts import configure_korean_font
from simula.application.analysis.plotting.network_collision import node_radius_pixels
from simula.application.analysis.plotting.network_layout import (
    RenderLayout,
    positions_to_pixels,
)

_PLOT_FIGSIZE = (13, 9)
_PLOT_DPI = 160

_NODE_BASE_SIZE = 800.0
_NODE_SIZE_RANGE = 2_000.0
_NODE_BASE_BORDER_WIDTH = 1.0
_NODE_BORDER_WIDTH_RANGE = 1.6

_EDGE_BASE_WIDTH = 1.0
_EDGE_WIDTH_RANGE = 3.0
_EDGE_LABEL_MIN_ACTION_COUNT = 1
_EDGE_LABEL_SPARSE_LIMIT = 10
_EDGE_LABEL_LIMIT = 8
_EDGE_LABEL_OFFSET_PX = 18.0
_NODE_LABEL_OFFSET_PX = 18.0

_NODE_CMAP = plt.colormaps["Blues"]
_EDGE_CMAP = plt.colormaps["viridis"]
_NODE_LABEL_BBOX = {
    "facecolor": "white",
    "edgecolor": "none",
    "alpha": 0.72,
    "boxstyle": "round,pad=0.24",
}
_EDGE_LABEL_BBOX = {
    "facecolor": "white",
    "edgecolor": "none",
    "alpha": 0.68,
    "boxstyle": "round,pad=0.16",
}


@dataclass(frozen=True)
class NodeVisualStyle:
    """Visual attributes for network nodes."""

    sizes: list[float]
    colors: list[float]
    border_widths: list[float]


@dataclass(frozen=True)
class EdgeVisualStyle:
    """Visual attributes for network edges."""

    widths: list[float]
    colors: list[float]


def create_figure() -> tuple[plt.Figure, plt.Axes]:
    """Create a standard network figure."""

    configure_korean_font()
    figure, axis = plt.subplots(figsize=_PLOT_FIGSIZE)
    return figure, axis


def prepare_axis(
    axis: plt.Axes,
    *,
    x_limits: tuple[float, float],
    y_limits: tuple[float, float],
) -> None:
    """Apply fixed bounds and equal aspect for one network axis."""

    axis.set_xlim(*x_limits)
    axis.set_ylim(*y_limits)
    axis.set_aspect("equal")


def render_network_plot(
    graph: nx.DiGraph,
    *,
    title: str,
    output_path: Path,
    layout: RenderLayout,
) -> None:
    """Render one directed actor connection graph."""

    output_path.parent.mkdir(parents=True, exist_ok=True)
    figure, axis = create_figure()
    try:
        if graph.number_of_nodes() == 0:
            axis.text(
                0.5,
                0.5,
                "행위자 노드가 없습니다.",
                ha="center",
                va="center",
                transform=axis.transAxes,
            )
            axis.set_axis_off()
        else:
            render_graph_on_axis(
                graph=graph,
                axis=axis,
                layout=layout,
            )
        axis.set_title(title, fontfamily=configure_korean_font())
        figure.tight_layout()
        figure.savefig(output_path, dpi=_PLOT_DPI)
    finally:
        plt.close(figure)


def render_graph_on_axis(
    *,
    graph: nx.DiGraph,
    axis: plt.Axes,
    layout: RenderLayout,
) -> None:
    """Render one graph frame onto an existing axis."""

    label_font = configure_korean_font()
    prepare_axis(axis, x_limits=layout.x_limits, y_limits=layout.y_limits)
    positions = layout.positions
    node_style = build_node_visual_style(graph)
    edge_style = build_edge_visual_style(graph)
    node_order = list(graph.nodes())

    if graph.number_of_edges() > 0:
        _draw_edges(
            graph=graph,
            axis=axis,
            positions=positions,
            node_style=node_style,
            edge_style=edge_style,
        )

    nx.draw_networkx_nodes(
        graph,
        positions,
        nodelist=node_order,
        node_size=node_style.sizes,
        node_color=node_style.colors,
        cmap=_NODE_CMAP,
        vmin=0.0,
        vmax=1.0,
        linewidths=node_style.border_widths,
        edgecolors="#16324F",
        alpha=0.92,
        ax=axis,
    )

    if graph.number_of_edges() == 0:
        axis.text(
            0.98,
            0.03,
            "연결 엣지가 생성되지 않았습니다.",
            ha="right",
            va="bottom",
            transform=axis.transAxes,
            fontsize=9,
            fontfamily=label_font,
        )

    _draw_node_labels(
        graph=graph,
        axis=axis,
        positions=positions,
        node_style=node_style,
        label_font=label_font,
    )
    _draw_edge_labels(
        graph=graph,
        axis=axis,
        positions=positions,
        label_font=label_font,
    )
    axis.set_axis_off()


def build_node_visual_style(graph: nx.DiGraph) -> NodeVisualStyle:
    """Map influence and activity metrics to node size and color."""

    influence_scores: list[float] = []
    brokerage_scores: list[float] = []
    activity_scores: list[float] = []

    for _, attrs in graph.nodes(data=True):
        influence_scores.append(
            metric_value(
                attrs,
                "pagerank",
                "authority_score",
                "hub_score",
                "out_degree_centrality",
                "in_degree_centrality",
            )
        )
        brokerage_scores.append(
            metric_value(
                attrs,
                "betweenness_centrality",
                "effective_size",
                "counterpart_count",
            )
        )
        activity_scores.append(
            metric_value(
                attrs,
                "total_weight",
                "sent_relations",
                "received_relations",
            )
        )

    influence_norm = normalize_metric(influence_scores)
    brokerage_norm = normalize_metric(brokerage_scores)
    activity_norm = normalize_metric(activity_scores)

    emphasis = 0.55 * influence_norm + 0.25 * brokerage_norm + 0.20 * activity_norm
    color_strength = (
        0.50 * influence_norm + 0.25 * brokerage_norm + 0.25 * activity_norm
    )

    return NodeVisualStyle(
        sizes=(_NODE_BASE_SIZE + _NODE_SIZE_RANGE * emphasis).tolist(),
        colors=(0.24 + 0.58 * color_strength).tolist(),
        border_widths=(
            _NODE_BASE_BORDER_WIDTH + _NODE_BORDER_WIDTH_RANGE * brokerage_norm
        ).tolist(),
    )


def build_edge_visual_style(graph: nx.DiGraph) -> EdgeVisualStyle:
    """Map edge weights to line width and color intensity."""

    strengths = build_edge_strengths(graph)
    edge_strength_values = np.asarray(
        [strengths[(source, target)] for source, target in graph.edges()],
        dtype=float,
    )

    return EdgeVisualStyle(
        widths=(_EDGE_BASE_WIDTH + _EDGE_WIDTH_RANGE * edge_strength_values).tolist(),
        colors=(0.20 + 0.75 * edge_strength_values).tolist(),
    )


def build_edge_label_text(graph: nx.DiGraph) -> dict[tuple[str, str], str]:
    """Build labels for sparse graphs and top labels for dense graphs."""

    candidates: list[tuple[str, str, int, float]] = []
    for source, target, attrs in graph.edges(data=True):
        interaction_count = int(max(metric_value(attrs, "action_count"), 0.0))
        if interaction_count < _EDGE_LABEL_MIN_ACTION_COUNT:
            continue
        candidates.append(
            (
                source,
                target,
                interaction_count,
                metric_value(attrs, "total_weight"),
            )
        )
    candidates.sort(key=lambda item: (-item[2], -item[3], item[0], item[1]))
    limit = (
        len(candidates)
        if len(candidates) <= _EDGE_LABEL_SPARSE_LIMIT
        else _EDGE_LABEL_LIMIT
    )
    return {
        (source, target): f"{interaction_count}회"
        for source, target, interaction_count, _ in candidates[:limit]
    }


def build_edge_strengths(graph: nx.DiGraph) -> dict[tuple[str, str], float]:
    """Normalize edge weights into 0-1 connection strengths."""

    if graph.number_of_edges() == 0:
        return {}

    weights = {
        (source, target): max(metric_value(attrs, "total_weight"), 0.0)
        for source, target, attrs in graph.edges(data=True)
    }
    maximum_weight = max(weights.values(), default=0.0)
    if maximum_weight <= 0.0:
        return {edge: 0.0 for edge in weights}
    return {edge: weight / maximum_weight for edge, weight in weights.items()}


def draw_frame_overlay(
    *,
    axis: plt.Axes,
    round_index: int,
    participating_actor_count: int,
    edge_count: int,
    top1_actor_share: float | None,
) -> None:
    """Draw a small stats overlay used in the growth GIF."""

    text = (
        f"Round {round_index}\n"
        f"참여 행위자 {participating_actor_count}명\n"
        f"연결 {edge_count}개\n"
        f"상위 1명 점유율 {_format_percent(top1_actor_share)}"
    )
    axis.text(
        0.02,
        0.98,
        text,
        ha="left",
        va="top",
        transform=axis.transAxes,
        fontsize=10,
        bbox=_NODE_LABEL_BBOX,
    )


def edge_connection_radius(index: int) -> float:
    """Return a stable curvature radius for one edge index."""

    pattern = [0.18, -0.18, 0.10, -0.10, 0.26, -0.26, 0.06, -0.06]
    return pattern[index % len(pattern)]


def edge_connectionstyle(index: int) -> str:
    """Return a Matplotlib connectionstyle string for one edge index."""

    return f"arc3,rad={edge_connection_radius(index):.2f}"


def metric_value(attrs: dict[str, object], *keys: str) -> float:
    """Return the first usable non-negative metric value."""

    for key in keys:
        raw_value = attrs.get(key)
        if raw_value is None or not isinstance(raw_value, int | float | str):
            continue
        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            continue
        if not np.isfinite(value):
            continue
        return max(value, 0.0)
    return 0.0


def normalize_metric(values: list[float]) -> np.ndarray:
    """Normalize one metric list to the 0-1 range."""

    if not values:
        return np.asarray([], dtype=float)

    array = np.asarray(values, dtype=float)
    array = np.nan_to_num(array, nan=0.0, posinf=0.0, neginf=0.0)
    minimum = float(np.min(array))
    maximum = float(np.max(array))

    if np.isclose(minimum, maximum):
        fill_value = 0.5 if maximum > 0 else 0.0
        return np.full_like(array, fill_value)

    return (array - minimum) / (maximum - minimum)


def _draw_edges(
    *,
    graph: nx.DiGraph,
    axis: plt.Axes,
    positions: dict[str, np.ndarray],
    node_style: NodeVisualStyle,
    edge_style: EdgeVisualStyle,
) -> None:
    node_order = list(graph.nodes())
    edge_list = list(graph.edges())
    for index, edge in enumerate(edge_list):
        nx.draw_networkx_edges(
            graph,
            positions,
            edgelist=[edge],
            width=[edge_style.widths[index]],
            edge_color=[edge_style.colors[index]],
            edge_cmap=_EDGE_CMAP,
            edge_vmin=0.0,
            edge_vmax=1.0,
            alpha=0.82,
            arrows=True,
            arrowstyle="-|>",
            arrowsize=20,
            connectionstyle=edge_connectionstyle(index),
            min_source_margin=10,
            min_target_margin=10,
            node_size=node_style.sizes,
            nodelist=node_order,
            ax=axis,
        )


def _draw_node_labels(
    *,
    graph: nx.DiGraph,
    axis: plt.Axes,
    positions: dict[str, np.ndarray],
    node_style: NodeVisualStyle,
    label_font: str,
) -> None:
    if not positions:
        return
    node_order = list(graph.nodes())
    pixel_positions = positions_to_pixels(axis, positions)
    centroid = np.mean(np.asarray(list(pixel_positions.values()), dtype=float), axis=0)
    for index, node in enumerate(node_order):
        text = str(graph.nodes[node].get("display_name", node))
        radius_px = node_radius_pixels(
            size=node_style.sizes[index],
            border_width=node_style.border_widths[index],
            dpi=axis.figure.dpi,
        )
        direction = pixel_positions[node] - centroid
        if np.allclose(direction, 0.0):
            direction = np.asarray([0.0, 1.0], dtype=float)
        direction = direction / max(float(np.linalg.norm(direction)), 1e-6)
        label_px = pixel_positions[node] + direction * (
            radius_px + _NODE_LABEL_OFFSET_PX
        )
        label_xy = axis.transData.inverted().transform(label_px)
        axis.text(
            float(label_xy[0]),
            float(label_xy[1]),
            text,
            ha="center",
            va="center",
            fontsize=10,
            fontfamily=label_font,
            color="#102A43",
            bbox=_NODE_LABEL_BBOX,
            zorder=20,
        )


def _draw_edge_labels(
    *,
    graph: nx.DiGraph,
    axis: plt.Axes,
    positions: dict[str, np.ndarray],
    label_font: str,
) -> None:
    edge_labels = build_edge_label_text(graph)
    if not edge_labels:
        return

    pixel_positions = positions_to_pixels(axis, positions)
    edge_index = {edge: index for index, edge in enumerate(graph.edges())}
    for edge, text in edge_labels.items():
        source, target = edge
        start = pixel_positions[source]
        end = pixel_positions[target]
        midpoint = (start + end) / 2.0
        direction = end - start
        distance = max(float(np.linalg.norm(direction)), 1e-6)
        tangent = direction / distance
        normal = np.asarray([-tangent[1], tangent[0]], dtype=float)
        curvature = edge_connection_radius(edge_index[edge])
        label_px = midpoint + normal * np.sign(curvature or 1.0) * (
            _EDGE_LABEL_OFFSET_PX + abs(curvature) * 30.0
        )
        label_xy = axis.transData.inverted().transform(label_px)
        axis.text(
            float(label_xy[0]),
            float(label_xy[1]),
            text,
            ha="center",
            va="center",
            fontsize=8,
            fontfamily=label_font,
            color="#243B53",
            bbox=_EDGE_LABEL_BBOX,
            zorder=15,
        )


def _format_percent(value: float | None) -> str:
    if value is None:
        return "-"
    return f"{value * 100:.1f}%"


__all__ = [
    "EdgeVisualStyle",
    "NodeVisualStyle",
    "build_edge_label_text",
    "build_edge_strengths",
    "build_edge_visual_style",
    "build_node_visual_style",
    "create_figure",
    "draw_frame_overlay",
    "edge_connection_radius",
    "edge_connectionstyle",
    "metric_value",
    "normalize_metric",
    "prepare_axis",
    "render_graph_on_axis",
    "render_network_plot",
]
