"""Purpose:
- Provide the stable public entrypoints for connection-network rendering.
"""

from __future__ import annotations

import networkx as nx
import numpy as np
import matplotlib.pyplot as plt

from simula.application.analysis.models import ActorRecord, AdoptedActivityRecord, NetworkGrowthReport
from simula.application.analysis.plotting.network_animation import render_network_growth_video as _render_network_growth_video
from simula.application.analysis.plotting.network_collision import (
    resolve_node_collisions_pixel_space as _resolve_node_collisions_pixel_space,
)
from simula.application.analysis.plotting.network_collision import node_radius_pixels
from simula.application.analysis.plotting.network_layout import (
    RenderLayout,
    build_layout_kwargs as _build_layout_kwargs_impl,
    normalize_layout_positions,
    pixels_to_positions,
    positions_to_pixels,
    suggest_axis_limits,
)
from simula.application.analysis.plotting.network_render import (
    build_edge_label_text as _build_edge_label_text,
    build_edge_strengths as _build_edge_strengths,
    build_edge_visual_style as _build_edge_visual_style,
    build_node_visual_style as _build_node_visual_style,
    create_figure,
    render_network_plot as _render_network_plot_impl,
)


def compute_render_layout(graph: nx.DiGraph) -> RenderLayout:
    """Compute one reusable layout with post-processed node collision removal."""

    if graph.number_of_nodes() == 0:
        return RenderLayout(positions={}, x_limits=(-1.0, 1.0), y_limits=(-1.0, 1.0))

    base_positions = _compute_layout_positions(graph)
    node_style = _build_node_visual_style(graph)
    figure, axis = create_figure()
    try:
        x_limits, y_limits = suggest_axis_limits(base_positions)
        axis.set_xlim(*x_limits)
        axis.set_ylim(*y_limits)
        axis.set_aspect("equal")
        figure.canvas.draw()
        pixel_positions = positions_to_pixels(axis, base_positions)
        node_order = list(graph.nodes())
        radii_px = {
            node: node_radius_pixels(
                size=node_style.sizes[index],
                border_width=node_style.border_widths[index],
                dpi=figure.dpi,
            )
            for index, node in enumerate(node_order)
        }
        bounded_pixels = _resolve_node_collisions_pixel_space(
            pixel_positions=pixel_positions,
            radii_px=radii_px,
            padding_px=10.0,
            bounds_px=axis.get_window_extent(),
        )
        resolved_positions = pixels_to_positions(axis, bounded_pixels)
        return RenderLayout(
            positions=resolved_positions,
            x_limits=x_limits,
            y_limits=y_limits,
        )
    finally:
        plt.close(figure)


def render_network_plot(
    graph: nx.DiGraph,
    *,
    title: str,
    output_path,
    layout: RenderLayout | None = None,
) -> None:
    """Render one directed actor connection graph."""

    effective_layout = layout or compute_render_layout(graph)
    _render_network_plot_impl(
        graph,
        title=title,
        output_path=output_path,
        layout=effective_layout,
    )


def render_network_growth_video(
    *,
    run_id: str,
    title: str,
    output_path,
    layout: RenderLayout,
    actors_by_id: dict[str, ActorRecord],
    activities: list[AdoptedActivityRecord],
    growth_report: NetworkGrowthReport,
    planned_max_rounds: int = 0,
    has_actors_finalized_event: bool = True,
    has_round_actions_adopted_event: bool = True,
) -> None:
    """Render one cumulative growth MP4 using a fixed final layout."""

    del run_id
    _render_network_growth_video(
        title=title,
        output_path=output_path,
        layout=layout,
        actors_by_id=actors_by_id,
        activities=activities,
        growth_report=growth_report,
        planned_max_rounds=planned_max_rounds,
        has_actors_finalized_event=has_actors_finalized_event,
        has_round_actions_adopted_event=has_round_actions_adopted_event,
    )


def render_network_growth_gif(**kwargs) -> None:
    """Backward-compatible alias for the new MP4 renderer."""

    render_network_growth_video(**kwargs)


def _build_layout_kwargs(graph: nx.DiGraph) -> dict[str, object]:
    """Return ForceAtlas2 settings for network rendering."""

    return _build_layout_kwargs_impl(
        graph,
        node_sizes=_build_node_visual_style(graph).sizes,
    )


def _compute_layout_positions(graph: nx.DiGraph):
    """Compute normalized ForceAtlas2 positions for the given graph."""

    if graph.number_of_nodes() <= 1:
        return {
            node: np.zeros(2, dtype=float)
            for node in graph.nodes()
        }
    raw_positions = nx.forceatlas2_layout(
        graph,
        **_build_layout_kwargs(graph),
    )
    return normalize_layout_positions(raw_positions)


__all__ = [
    "RenderLayout",
    "_build_edge_label_text",
    "_build_edge_strengths",
    "_build_edge_visual_style",
    "_build_layout_kwargs",
    "_build_node_visual_style",
    "_compute_layout_positions",
    "_resolve_node_collisions_pixel_space",
    "compute_render_layout",
    "render_network_growth_gif",
    "render_network_growth_video",
    "render_network_plot",
]
