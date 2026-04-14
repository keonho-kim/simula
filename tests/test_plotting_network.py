"""Purpose:
- Verify network-plot visual encoding and layout tuning.
"""

from __future__ import annotations

import networkx as nx
import numpy as np
import pytest

from simula.application.analysis.plotting.network import (
    _build_edge_label_text,
    _build_edge_visual_style,
    _build_layout_kwargs,
    _build_node_visual_style,
)


def test_node_visual_style_emphasizes_influence_metrics() -> None:
    graph = nx.DiGraph()
    graph.add_node(
        "leader",
        display_name="Leader",
        total_weight=9,
        pagerank=0.42,
        betweenness_centrality=0.31,
    )
    graph.add_node(
        "support",
        display_name="Support",
        total_weight=4,
        pagerank=0.08,
        betweenness_centrality=0.02,
    )

    style = _build_node_visual_style(graph)

    assert style.sizes[0] > style.sizes[1]
    assert style.colors[0] > style.colors[1]
    assert style.border_widths[0] > style.border_widths[1]


def test_node_visual_style_falls_back_to_activity_metrics() -> None:
    graph = nx.DiGraph()
    graph.add_node("active", display_name="Active", total_weight=7)
    graph.add_node("quiet", display_name="Quiet", total_weight=1)

    style = _build_node_visual_style(graph)

    assert style.sizes[0] > style.sizes[1]
    assert style.colors[0] > style.colors[1]
    assert np.isfinite(style.border_widths).all()


def test_layout_kwargs_increase_spacing_and_iterations() -> None:
    graph = nx.DiGraph()
    graph.add_edge("alpha", "beta", total_weight=3)
    graph.add_edge("beta", "gamma", total_weight=2)
    graph.add_edge("gamma", "delta", total_weight=1)
    graph.add_node("isolated-a")
    graph.add_node("isolated-b")

    kwargs = _build_layout_kwargs(graph)

    assert kwargs["weight"] == "total_weight"
    assert kwargs["iterations"] == 300
    assert kwargs["scale"] == 1.0
    assert kwargs["method"] == "force"
    assert float(kwargs["k"]) == pytest.approx(2.4 / np.sqrt(4))


def test_edge_visual_style_normalizes_weight_with_minimum_width_one() -> None:
    graph = nx.DiGraph()
    graph.add_edge("alpha", "beta", total_weight=1)
    graph.add_edge("beta", "gamma", total_weight=9)

    style = _build_edge_visual_style(graph)

    assert style.widths[0] == pytest.approx(1.0)
    assert style.widths[1] > style.widths[0]
    assert style.colors[1] > style.colors[0]


def test_edge_label_text_includes_count_and_preview() -> None:
    graph = nx.DiGraph()
    graph.add_edge(
        "alpha",
        "beta",
        total_weight=3,
        label_preview="데이트를 제안한다.",
        label_variant_count=2,
    )

    labels = _build_edge_label_text(graph)

    assert labels[("alpha", "beta")] == "3회 · 데이트를 제안한다. 외 1"
