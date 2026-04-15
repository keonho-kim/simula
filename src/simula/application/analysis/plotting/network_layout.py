"""Purpose:
- Keep ForceAtlas2 layout and coordinate helpers isolated from rendering code.
"""

from __future__ import annotations

from dataclasses import dataclass

import networkx as nx
import numpy as np
from matplotlib.axes import Axes

_LAYOUT_SEED = 42
_LAYOUT_MAX_ITER = 300
_LAYOUT_JITTER_TOLERANCE = 0.7
_LAYOUT_SCALING_RATIO = 20
_LAYOUT_GRAVITY = 20
_LAYOUT_NODE_SIZE_MIN = 6.0
_LAYOUT_NODE_SIZE_DIVISOR = 14.0


@dataclass(frozen=True)
class RenderLayout:
    """Resolved positions and axis limits reused across frames."""

    positions: dict[str, np.ndarray]
    x_limits: tuple[float, float]
    y_limits: tuple[float, float]


def build_layout_kwargs(
    graph: nx.DiGraph,
    *,
    node_sizes: list[float],
) -> dict[str, object]:
    """Return ForceAtlas2 settings for network rendering."""

    node_size_map = {
        node: max(np.sqrt(size) / _LAYOUT_NODE_SIZE_DIVISOR, _LAYOUT_NODE_SIZE_MIN)
        for node, size in zip(graph.nodes(), node_sizes, strict=True)
    }
    return {
        "max_iter": _LAYOUT_MAX_ITER,
        "jitter_tolerance": _LAYOUT_JITTER_TOLERANCE,
        "scaling_ratio": _LAYOUT_SCALING_RATIO,
        "gravity": _LAYOUT_GRAVITY,
        "distributed_action": True,
        "strong_gravity": False,
        "node_size": node_size_map,
        "weight": "total_weight" if graph.number_of_edges() > 0 else None,
        "seed": _LAYOUT_SEED,
    }


def compute_layout_positions(
    graph: nx.DiGraph,
    *,
    layout_kwargs: dict[str, object],
) -> dict[str, np.ndarray]:
    """Compute ForceAtlas2 positions and normalize them for Matplotlib rendering."""

    if graph.number_of_nodes() <= 1:
        return {
            node: np.zeros(2, dtype=float)
            for node in graph.nodes()
        }

    raw_positions = nx.forceatlas2_layout(graph, **layout_kwargs)
    return normalize_layout_positions(raw_positions)


def normalize_layout_positions(
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


def suggest_axis_limits(
    positions: dict[str, np.ndarray],
) -> tuple[tuple[float, float], tuple[float, float]]:
    """Build stable axis limits around normalized positions."""

    if not positions:
        return (-1.0, 1.0), (-1.0, 1.0)
    coordinates = np.asarray(list(positions.values()), dtype=float)
    center = np.mean(coordinates, axis=0)
    max_distance = float(np.max(np.abs(coordinates - center)))
    half_span = max(max_distance + 0.55, 1.35)
    return (
        (float(center[0] - half_span), float(center[0] + half_span)),
        (float(center[1] - half_span), float(center[1] + half_span)),
    )


def positions_to_pixels(
    axis: Axes,
    positions: dict[str, np.ndarray],
) -> dict[str, np.ndarray]:
    """Convert data coordinates into display coordinates."""

    return {
        node: np.asarray(axis.transData.transform(position), dtype=float)
        for node, position in positions.items()
    }


def pixels_to_positions(
    axis: Axes,
    pixel_positions: dict[str, np.ndarray],
) -> dict[str, np.ndarray]:
    """Convert display coordinates back into data coordinates."""

    inverse = axis.transData.inverted()
    return {
        node: np.asarray(inverse.transform(position), dtype=float)
        for node, position in pixel_positions.items()
    }


__all__ = [
    "RenderLayout",
    "build_layout_kwargs",
    "compute_layout_positions",
    "normalize_layout_positions",
    "pixels_to_positions",
    "positions_to_pixels",
    "suggest_axis_limits",
]
