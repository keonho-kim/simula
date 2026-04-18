"""Purpose:
- Provide the stable public entrypoints for connection-network rendering.
"""

from __future__ import annotations

import networkx as nx
import matplotlib.pyplot as plt

from simula.application.analysis.models import (
    ActorRecord,
    AdoptedActivityRecord,
    NetworkGrowthReport,
    PlannedActionRecord,
)
from simula.application.analysis.plotting.network_animation import (
    render_network_growth_video as _render_network_growth_video,
)
from simula.application.analysis.plotting.network_collision import (
    node_radius_pixels,
    resolve_node_collisions_pixel_space,
)
from simula.application.analysis.plotting.network_layout import (
    RenderLayout,
    build_layout_kwargs,
    compute_layout_positions,
    pixels_to_positions,
    positions_to_pixels,
    suggest_axis_limits,
)
from simula.application.analysis.plotting.network_render import (
    build_node_visual_style,
    create_figure,
    render_network_plot as _render_network_plot_impl,
)


def compute_render_layout(graph: nx.DiGraph) -> RenderLayout:
    """Compute one reusable layout with post-processed node collision removal."""

    if graph.number_of_nodes() == 0:
        return RenderLayout(positions={}, x_limits=(-1.0, 1.0), y_limits=(-1.0, 1.0))

    node_style = build_node_visual_style(graph)
    base_positions = compute_layout_positions(
        graph,
        layout_kwargs=build_layout_kwargs(graph, node_sizes=node_style.sizes),
    )
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
        bounded_pixels = resolve_node_collisions_pixel_space(
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
    planned_actions: list[PlannedActionRecord] | None = None,
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
        planned_actions=planned_actions,
        planned_max_rounds=planned_max_rounds,
        has_actors_finalized_event=has_actors_finalized_event,
        has_round_actions_adopted_event=has_round_actions_adopted_event,
    )

__all__ = [
    "RenderLayout",
    "compute_render_layout",
    "render_network_growth_video",
    "render_network_plot",
]
