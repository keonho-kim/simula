"""Purpose:
- Verify network-plot visual encoding and layout tuning.
"""

from __future__ import annotations

import networkx as nx
import numpy as np
import pytest
from types import SimpleNamespace

import simula.application.analysis.plotting.network as plotting_network
from simula.application.analysis.plotting.network import (
    _build_edge_label_text,
    _build_edge_strengths,
    _build_edge_visual_style,
    _build_layout_kwargs,
    _compute_layout_positions,
    _build_node_visual_style,
    render_network_plot,
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


def test_layout_kwargs_select_forceatlas2_parameters() -> None:
    graph = nx.DiGraph()
    graph.add_edge("alpha", "beta", total_weight=3)
    graph.add_edge("beta", "gamma", total_weight=2)
    graph.add_edge("gamma", "delta", total_weight=1)
    graph.add_node("isolated-a")
    graph.add_node("isolated-b")

    kwargs = _build_layout_kwargs(graph)

    assert kwargs["max_iter"] == 300
    assert kwargs["jitter_tolerance"] == pytest.approx(0.7)
    assert float(kwargs["scaling_ratio"]) > 0.0
    assert float(kwargs["gravity"]) >= 0.0
    assert kwargs["distributed_action"] is True
    assert kwargs["strong_gravity"] is False
    assert kwargs["weight"] == "total_weight"
    assert kwargs["seed"] == 42
    assert isinstance(kwargs["node_size"], dict)
    assert set(kwargs["node_size"]) == set(graph.nodes())


def test_compute_layout_positions_uses_forceatlas2_layout(monkeypatch) -> None:
    graph = nx.DiGraph()
    graph.add_edge("alpha", "beta", total_weight=3)
    graph.add_node("gamma")
    captured: dict[str, object] = {}

    def _fake_forceatlas2_layout(graph_obj, **kwargs):  # noqa: ANN001
        captured["graph"] = graph_obj
        captured["kwargs"] = kwargs
        return {
            "alpha": (10.0, 30.0),
            "beta": (30.0, 10.0),
            "gamma": (20.0, 20.0),
        }

    monkeypatch.setattr(
        plotting_network.nx,
        "forceatlas2_layout",
        _fake_forceatlas2_layout,
    )

    positions = _compute_layout_positions(graph)

    assert captured["graph"] is graph
    assert captured["kwargs"]["max_iter"] == 300
    assert captured["kwargs"]["weight"] == "total_weight"
    assert set(positions) == {"alpha", "beta", "gamma"}
    assert all(isinstance(value, np.ndarray) for value in positions.values())
    assert np.isfinite(np.asarray(list(positions.values()), dtype=float)).all()


def test_compute_layout_positions_does_not_use_graphviz_layout(monkeypatch) -> None:
    graph = nx.DiGraph()
    graph.add_edge("alpha", "beta", total_weight=2)

    monkeypatch.setattr(
        plotting_network.nx,
        "nx_agraph",
        SimpleNamespace(
            graphviz_layout=lambda *args, **kwargs: (_ for _ in ()).throw(
                AssertionError("graphviz_layout should not be used")
            )
        ),
        raising=False,
    )

    def _fake_forceatlas2_layout(graph_obj, **kwargs):  # noqa: ANN001
        del graph_obj, kwargs
        return {
            "alpha": (0.0, 0.0),
            "beta": (1.0, 1.0),
        }

    monkeypatch.setattr(
        plotting_network.nx,
        "forceatlas2_layout",
        _fake_forceatlas2_layout,
    )

    positions = _compute_layout_positions(graph)

    assert set(positions) == {"alpha", "beta"}


def test_edge_visual_style_normalizes_weight_with_minimum_width_one() -> None:
    graph = nx.DiGraph()
    graph.add_edge("alpha", "beta", total_weight=1)
    graph.add_edge("beta", "gamma", total_weight=9)

    style = _build_edge_visual_style(graph)

    assert style.widths[0] >= 1.0
    assert style.widths[1] > style.widths[0]
    assert style.colors[1] > style.colors[0]


def test_edge_strengths_are_normalized_between_zero_and_one() -> None:
    graph = nx.DiGraph()
    graph.add_edge(
        "alpha",
        "beta",
        total_weight=3,
        label_preview="private_one_on_one",
        label_variant_count=2,
    )
    graph.add_edge("beta", "gamma", total_weight=6)

    strengths = _build_edge_strengths(graph)

    assert strengths[("alpha", "beta")] == pytest.approx(0.5)
    assert strengths[("beta", "gamma")] == pytest.approx(1.0)


def test_edge_label_text_uses_interaction_count_when_present() -> None:
    graph = nx.DiGraph()
    graph.add_edge("alpha", "beta", total_weight=3, weight=0.3, action_count=2)
    graph.add_edge("beta", "gamma", total_weight=6, weight=0.6, action_count=5)

    labels = _build_edge_label_text(graph)

    assert labels[("alpha", "beta")] == "2회"
    assert labels[("beta", "gamma")] == "5회"


def test_edge_label_text_hides_edges_without_interactions() -> None:
    graph = nx.DiGraph()
    graph.add_edge("alpha", "beta", total_weight=4, weight=0.4)
    graph.add_edge("beta", "gamma", total_weight=6, weight=0.6, action_count=0)

    labels = _build_edge_label_text(graph)

    assert labels == {}


def test_render_network_plot_draws_interaction_labels_only(
    monkeypatch,
    tmp_path,
) -> None:
    graph = nx.DiGraph()
    graph.add_node("alpha", display_name="Alpha", total_weight=4)
    graph.add_node("beta", display_name="Beta", total_weight=2)
    graph.add_edge("alpha", "beta", total_weight=4, action_count=2)
    graph.add_edge("beta", "alpha", total_weight=2, action_count=0)

    monkeypatch.setattr(
        plotting_network,
        "_compute_layout_positions",
        lambda graph: {"alpha": (-1.0, 0.0), "beta": (1.0, 0.0)},
    )
    captured: list[dict[str, object]] = []

    def _fake_draw_networkx_edge_labels(*args, **kwargs):  # noqa: ANN002, ANN003
        del args
        captured.append(dict(kwargs))
        return {}

    monkeypatch.setattr(
        plotting_network.nx,
        "draw_networkx_edge_labels",
        _fake_draw_networkx_edge_labels,
    )

    render_network_plot(graph, title="network", output_path=tmp_path / "graph.png")

    assert len(captured) == 1
    assert captured[0]["edge_labels"] == {("alpha", "beta"): "2회"}
    assert captured[0]["label_pos"] == pytest.approx(0.52)
