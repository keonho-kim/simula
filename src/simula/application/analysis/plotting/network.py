"""Purpose:
- Render the actor relationship graph as a static PNG.
"""

from __future__ import annotations

import matplotlib

matplotlib.use("Agg")

from pathlib import Path

import matplotlib.pyplot as plt
import networkx as nx
import numpy as np


def render_network_plot(
    graph: nx.DiGraph,
    *,
    title: str,
    output_path: Path,
) -> None:
    """Render one directed actor relationship graph."""

    output_path.parent.mkdir(parents=True, exist_ok=True)
    figure, axis = plt.subplots(figsize=(12, 8))
    try:
        if graph.number_of_nodes() == 0:
            axis.text(
                0.5,
                0.5,
                "No actor nodes available.",
                ha="center",
                va="center",
                transform=axis.transAxes,
            )
            axis.set_axis_off()
        elif graph.number_of_edges() == 0:
            positions = nx.spring_layout(graph, seed=42)
            labels = {
                node: str(graph.nodes[node].get("display_name", node))
                for node in graph.nodes()
            }
            node_sizes = [
                900 + 150 * max(int(graph.nodes[node].get("total_weight", 0)), 1)
                for node in graph.nodes()
            ]
            nx.draw_networkx_nodes(
                graph,
                positions,
                node_size=node_sizes,
                node_color="#4C78A8",
                alpha=0.9,
                ax=axis,
            )
            nx.draw_networkx_labels(graph, positions, labels=labels, font_size=10, ax=axis)
            axis.text(
                0.98,
                0.03,
                "No relationship edges were produced.",
                ha="right",
                va="bottom",
                transform=axis.transAxes,
                fontsize=9,
            )
            axis.set_axis_off()
        else:
            positions = nx.spring_layout(graph, seed=42, weight="total_weight")
            labels = {
                node: str(graph.nodes[node].get("display_name", node))
                for node in graph.nodes()
            }
            node_sizes = [
                850 + 180 * np.sqrt(max(int(graph.nodes[node].get("total_weight", 0)), 1))
                for node in graph.nodes()
            ]
            edge_widths = [
                1.0 + 1.2 * np.sqrt(max(int(data.get("total_weight", 0)), 1))
                for _, _, data in graph.edges(data=True)
            ]
            nx.draw_networkx_nodes(
                graph,
                positions,
                node_size=node_sizes,
                node_color="#4C78A8",
                alpha=0.9,
                ax=axis,
            )
            nx.draw_networkx_labels(
                graph,
                positions,
                labels=labels,
                font_size=10,
                ax=axis,
            )
            nx.draw_networkx_edges(
                graph,
                positions,
                width=edge_widths,
                arrows=True,
                arrowstyle="-|>",
                arrowsize=18,
                edge_color="#7A5195",
                connectionstyle="arc3,rad=0.08",
                ax=axis,
            )
            axis.set_axis_off()
        axis.set_title(title)
        figure.tight_layout()
        figure.savefig(output_path, dpi=160)
    finally:
        plt.close(figure)
