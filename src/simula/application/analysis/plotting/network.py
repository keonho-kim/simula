"""Purpose:
- Render the actor relationship graph as a static PNG.
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

_LAYOUT_SEED = 42
_LAYOUT_MAX_ITER = 300
_LAYOUT_JITTER_TOLERANCE = 0.7
_LAYOUT_SCALING_RATIO = 30
_LAYOUT_GRAVITY = 10
_LAYOUT_NODE_SIZE_MIN = 6.0
_LAYOUT_NODE_SIZE_DIVISOR = 14.0

_NODE_BASE_SIZE = 800.0
_NODE_SIZE_RANGE = 2_400.0
_NODE_BASE_BORDER_WIDTH = 1.0
_NODE_BORDER_WIDTH_RANGE = 1.6

_EDGE_BASE_WIDTH = 1.0
_EDGE_WIDTH_RANGE = 3.0

_NODE_CMAP = plt.colormaps["Blues"]
_EDGE_CMAP = plt.colormaps["viridis"]
_TRANSPARENT_LABEL_BBOX = {
    "facecolor": "none",
    "edgecolor": "none",
    "alpha": 0.0,
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


def render_network_plot(
    graph: nx.DiGraph,
    *,
    title: str,
    output_path: Path,
) -> None:
    """Render one directed actor relationship graph."""

    output_path.parent.mkdir(parents=True, exist_ok=True)
    label_font = configure_korean_font()
    figure, axis = plt.subplots(figsize=(13, 9))
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
            positions = _compute_layout_positions(graph)
            labels = {
                node: str(graph.nodes[node].get("display_name", node))
                for node in graph.nodes()
            }
            node_style = _build_node_visual_style(graph)
            node_order = list(graph.nodes())

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
                margins=0.18,
                ax=axis,
            )
            nx.draw_networkx_labels(
                graph,
                positions,
                labels=labels,
                font_size=10,
                font_color="#102A43",
                font_family=label_font,
                bbox=_TRANSPARENT_LABEL_BBOX,
                ax=axis,
            )

            if graph.number_of_edges() == 0:
                axis.text(
                    0.98,
                    0.03,
                    "관계 엣지가 생성되지 않았습니다.",
                    ha="right",
                    va="bottom",
                    transform=axis.transAxes,
                    fontsize=9,
                )
            else:
                edge_style = _build_edge_visual_style(graph)
                edge_labels = _build_edge_label_text(graph)
                nx.draw_networkx_edges(
                    graph,
                    positions,
                    width=edge_style.widths,
                    edge_color=edge_style.colors,
                    edge_cmap=_EDGE_CMAP,
                    edge_vmin=0.0,
                    edge_vmax=1.0,
                    alpha=0.82,
                    arrows=True,
                    arrowstyle="-|>",
                    arrowsize=20,
                    connectionstyle="arc3,rad=0.12",
                    min_source_margin=10,
                    min_target_margin=10,
                    node_size=node_style.sizes,
                    nodelist=node_order,
                    ax=axis,
                )
                nx.draw_networkx_edge_labels(
                    graph,
                    positions,
                    edge_labels=edge_labels,
                    label_pos=0.52,
                    font_size=8,
                    font_color="#243B53",
                    font_family=label_font,
                    rotate=False,
                    bbox=_TRANSPARENT_LABEL_BBOX,
                    node_size=node_style.sizes,
                    nodelist=node_order,
                    connectionstyle="arc3,rad=0.12",
                    ax=axis,
                )

            axis.margins(0.18)
            axis.set_axis_off()

        axis.set_title(title)
        figure.tight_layout()
        figure.savefig(output_path, dpi=160)
    finally:
        plt.close(figure)


def _build_layout_kwargs(graph: nx.DiGraph) -> dict[str, object]:
    """Return ForceAtlas2 settings for network rendering."""

    node_style = _build_node_visual_style(graph)
    node_sizes = {
        node: max(np.sqrt(size) / _LAYOUT_NODE_SIZE_DIVISOR, _LAYOUT_NODE_SIZE_MIN)
        for node, size in zip(graph.nodes(), node_style.sizes, strict=True)
    }
    return {
        "max_iter": _LAYOUT_MAX_ITER,
        "jitter_tolerance": _LAYOUT_JITTER_TOLERANCE,
        "scaling_ratio": _LAYOUT_SCALING_RATIO,
        "gravity": _LAYOUT_GRAVITY,
        "distributed_action": True,
        "strong_gravity": False,
        "node_size": node_sizes,
        "weight": "total_weight" if graph.number_of_edges() > 0 else None,
        "seed": _LAYOUT_SEED,
    }


def _compute_layout_positions(graph: nx.DiGraph) -> dict[str, np.ndarray]:
    """Compute ForceAtlas2 positions and normalize them for Matplotlib rendering."""

    if graph.number_of_nodes() <= 1:
        return {
            node: np.zeros(2, dtype=float)
            for node in graph.nodes()
        }

    raw_positions = nx.forceatlas2_layout(
        graph,
        **_build_layout_kwargs(graph),
    )
    return _normalize_layout_positions(raw_positions)


def _normalize_layout_positions(
    positions: dict[str, tuple[float, float] | np.ndarray],
) -> dict[str, np.ndarray]:
    """Scale layout coordinates to a centered Matplotlib-friendly range."""

    if not positions:
        return {}

    nodes = list(positions)
    coordinates = np.asarray([positions[node] for node in nodes], dtype=float)
    minimum = np.min(coordinates, axis=0)
    maximum = np.max(coordinates, axis=0)
    center = (minimum + maximum) / 2.0
    extent = float(np.max(maximum - minimum))

    if np.isclose(extent, 0.0):
        normalized = np.zeros_like(coordinates)
    else:
        normalized = ((coordinates - center) / extent) * 2.0

    return {
        node: normalized[index]
        for index, node in enumerate(nodes)
    }


def _build_node_visual_style(graph: nx.DiGraph) -> NodeVisualStyle:
    """Map influence and activity metrics to node size and color."""

    influence_scores: list[float] = []
    brokerage_scores: list[float] = []
    activity_scores: list[float] = []

    for _, attrs in graph.nodes(data=True):
        influence_scores.append(
            _metric_value(
                attrs,
                "pagerank",
                "authority_score",
                "hub_score",
                "out_degree_centrality",
                "in_degree_centrality",
            )
        )
        brokerage_scores.append(
            _metric_value(
                attrs,
                "betweenness_centrality",
                "effective_size",
                "counterpart_count",
            )
        )
        activity_scores.append(
            _metric_value(
                attrs,
                "total_weight",
                "sent_relations",
                "received_relations",
            )
        )

    influence_norm = _normalize_metric(influence_scores)
    brokerage_norm = _normalize_metric(brokerage_scores)
    activity_norm = _normalize_metric(activity_scores)

    emphasis = (
        0.55 * influence_norm
        + 0.25 * brokerage_norm
        + 0.20 * activity_norm
    )
    color_strength = (
        0.50 * influence_norm
        + 0.25 * brokerage_norm
        + 0.25 * activity_norm
    )

    return NodeVisualStyle(
        sizes=(_NODE_BASE_SIZE + _NODE_SIZE_RANGE * emphasis).tolist(),
        colors=(0.24 + 0.58 * color_strength).tolist(),
        border_widths=(
            _NODE_BASE_BORDER_WIDTH + _NODE_BORDER_WIDTH_RANGE * brokerage_norm
        ).tolist(),
    )


def _build_edge_visual_style(graph: nx.DiGraph) -> EdgeVisualStyle:
    """Map edge weights to line width and color intensity."""

    weights = [
        max(_metric_value(attrs, "total_weight"), 1.0)
        for _, _, attrs in graph.edges(data=True)
    ]
    weight_norm = _normalize_metric(weights)

    return EdgeVisualStyle(
        widths=(_EDGE_BASE_WIDTH + _EDGE_WIDTH_RANGE * weight_norm).tolist(),
        colors=(0.20 + 0.75 * weight_norm).tolist(),
    )


def _build_edge_label_text(graph: nx.DiGraph) -> dict[tuple[str, str], str]:
    """Build concise edge labels from aggregated activity summaries."""

    labels: dict[tuple[str, str], str] = {}
    for source, target, attrs in graph.edges(data=True):
        total_weight = int(max(_metric_value(attrs, "total_weight"), 0.0))
        preview = str(attrs.get("label_preview", "")).strip()
        variant_count = int(max(_metric_value(attrs, "label_variant_count"), 0.0))

        if preview:
            preview = preview.replace('_', ' ').upper()
            if variant_count > 1:
                labels[(source, target)] = (
                    f"{total_weight}회: {preview} 외 {variant_count - 1}가지 행동"
                )
            else:
                labels[(source, target)] = f"{total_weight}회: {preview}"
        else:
            labels[(source, target)] = f"{total_weight}회"
    return labels


def _metric_value(attrs: dict[str, object], *keys: str) -> float:
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


def _normalize_metric(values: list[float]) -> np.ndarray:
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
