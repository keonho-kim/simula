"""Purpose:
- Verify network-plot visual encoding and layout tuning.
"""

from __future__ import annotations

import networkx as nx
import numpy as np
import pytest
from types import SimpleNamespace

import simula.application.analysis.plotting.network as plotting_network
import simula.application.analysis.plotting.network_layout as plotting_network_layout
from simula.application.analysis.models import (
    ActorRecord,
    AdoptedActivityRecord,
    NetworkGrowthRecord,
    NetworkGrowthReport,
)
from simula.application.analysis.plotting.network import (
    compute_render_layout,
    render_network_growth_video,
)
from simula.application.analysis.plotting.network_collision import (
    resolve_node_collisions_pixel_space,
)
from simula.application.analysis.plotting.network_layout import (
    build_layout_kwargs,
    compute_layout_positions,
)
from simula.application.analysis.plotting.network_render import (
    build_edge_label_text,
    build_edge_strengths,
    build_edge_visual_style,
    build_node_visual_style,
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

    style = build_node_visual_style(graph)

    assert style.sizes[0] > style.sizes[1]
    assert style.colors[0] > style.colors[1]
    assert style.border_widths[0] > style.border_widths[1]


def test_node_visual_style_falls_back_to_activity_metrics() -> None:
    graph = nx.DiGraph()
    graph.add_node("active", display_name="Active", total_weight=7)
    graph.add_node("quiet", display_name="Quiet", total_weight=1)

    style = build_node_visual_style(graph)

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

    kwargs = build_layout_kwargs(graph, node_sizes=build_node_visual_style(graph).sizes)

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
        plotting_network_layout.nx,
        "forceatlas2_layout",
        _fake_forceatlas2_layout,
    )

    positions = compute_layout_positions(
        graph,
        layout_kwargs=build_layout_kwargs(
            graph, node_sizes=build_node_visual_style(graph).sizes
        ),
    )

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
        plotting_network_layout.nx,
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
        plotting_network_layout.nx,
        "forceatlas2_layout",
        _fake_forceatlas2_layout,
    )

    positions = compute_layout_positions(
        graph,
        layout_kwargs=build_layout_kwargs(
            graph, node_sizes=build_node_visual_style(graph).sizes
        ),
    )

    assert set(positions) == {"alpha", "beta"}


def test_edge_visual_style_normalizes_weight_with_minimum_width_one() -> None:
    graph = nx.DiGraph()
    graph.add_edge("alpha", "beta", total_weight=1)
    graph.add_edge("beta", "gamma", total_weight=9)

    style = build_edge_visual_style(graph)

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

    strengths = build_edge_strengths(graph)

    assert strengths[("alpha", "beta")] == pytest.approx(0.5)
    assert strengths[("beta", "gamma")] == pytest.approx(1.0)


def test_edge_label_text_uses_interaction_count_when_present() -> None:
    graph = nx.DiGraph()
    graph.add_edge("alpha", "beta", total_weight=3, weight=0.3, action_count=1)
    graph.add_edge("beta", "gamma", total_weight=6, weight=0.6, action_count=5)

    labels = build_edge_label_text(graph)

    assert labels[("alpha", "beta")] == "1회"
    assert labels[("beta", "gamma")] == "5회"


def test_edge_label_text_hides_edges_without_interactions() -> None:
    graph = nx.DiGraph()
    graph.add_edge("alpha", "beta", total_weight=4, weight=0.4)
    graph.add_edge("beta", "gamma", total_weight=6, weight=0.6, action_count=0)

    labels = build_edge_label_text(graph)

    assert labels == {}


def test_edge_label_text_shows_all_candidates_for_sparse_graph() -> None:
    graph = nx.DiGraph()
    for index in range(10):
        graph.add_edge(
            f"source-{index}",
            f"target-{index}",
            total_weight=index + 1,
            action_count=1,
        )

    labels = build_edge_label_text(graph)

    assert len(labels) == 10
    assert ("source-0", "target-0") in labels
    assert ("source-9", "target-9") in labels


def test_edge_label_text_limits_to_top_actionable_edges_for_dense_graph() -> None:
    graph = nx.DiGraph()
    for index in range(11):
        graph.add_edge(
            f"source-{index}",
            f"target-{index}",
            total_weight=index + 1,
            action_count=index + 1,
        )

    labels = build_edge_label_text(graph)

    assert len(labels) == 8
    assert ("source-10", "target-10") in labels
    assert ("source-9", "target-9") in labels
    assert ("source-2", "target-2") not in labels
    assert ("source-0", "target-0") not in labels


def test_resolve_node_collisions_pixel_space_separates_overlapping_nodes() -> None:
    positions = {
        "alpha": np.asarray([100.0, 100.0]),
        "beta": np.asarray([110.0, 100.0]),
        "gamma": np.asarray([105.0, 108.0]),
    }
    radii = {"alpha": 20.0, "beta": 20.0, "gamma": 20.0}

    resolved = resolve_node_collisions_pixel_space(
        pixel_positions=positions,
        radii_px=radii,
        padding_px=4.0,
    )

    for left_name, left_position in resolved.items():
        for right_name, right_position in resolved.items():
            if left_name >= right_name:
                continue
            minimum_distance = radii[left_name] + radii[right_name] + 4.0
            assert (
                np.linalg.norm(left_position - right_position)
                >= minimum_distance - 1e-6
            )


def test_compute_render_layout_returns_resolved_positions(monkeypatch) -> None:
    graph = nx.DiGraph()
    graph.add_node("alpha", display_name="Alpha", total_weight=5)
    graph.add_node("beta", display_name="Beta", total_weight=4)
    graph.add_edge("alpha", "beta", total_weight=3, action_count=2)

    monkeypatch.setattr(
        plotting_network,
        "compute_layout_positions",
        lambda graph, layout_kwargs=None: {  # noqa: ARG005
            "alpha": np.asarray([0.0, 0.0]),
            "beta": np.asarray([0.0, 0.0]),
        },
    )

    layout = compute_render_layout(graph)

    assert set(layout.positions) == {"alpha", "beta"}
    assert layout.x_limits[0] < layout.x_limits[1]
    assert layout.y_limits[0] < layout.y_limits[1]
    assert not np.allclose(layout.positions["alpha"], layout.positions["beta"])


def test_render_network_growth_video_writes_output(monkeypatch, tmp_path) -> None:
    graph = nx.DiGraph()
    graph.add_node("alpha", display_name="Alpha", total_weight=4)
    graph.add_node("beta", display_name="Beta", total_weight=2)
    graph.add_edge("alpha", "beta", total_weight=4, action_count=2)

    monkeypatch.setattr(
        plotting_network,
        "compute_layout_positions",
        lambda graph, layout_kwargs=None: {  # noqa: ARG005
            "alpha": np.asarray([-1.0, 0.0]),
            "beta": np.asarray([1.0, 0.0]),
        },
    )
    layout = compute_render_layout(graph)
    growth_report = NetworkGrowthReport(
        rows=[
            NetworkGrowthRecord(
                round_index=1,
                cumulative_activity_count=1,
                participating_actor_count=2,
                edge_count=1,
                largest_component_ratio=1.0,
                density=0.5,
                top1_actor_share=0.5,
                top3_actor_share=1.0,
                actor_weight_hhi=0.5,
                actor_weight_gini=0.0,
                top1_edge_share=1.0,
                top3_edge_share=1.0,
                edge_weight_hhi=1.0,
                edge_weight_gini=0.0,
                new_actor_count=2,
                new_edge_count=1,
            )
        ]
    )
    render_network_growth_video(
        run_id="run-1",
        title="network",
        output_path=tmp_path / "growth.mp4",
        layout=layout,
        actors_by_id={
            "alpha": ActorRecord(cast_id="alpha", display_name="Alpha"),
            "beta": ActorRecord(cast_id="beta", display_name="Beta"),
        },
        activities=[
            AdoptedActivityRecord(
                round_index=1,
                source_cast_id="alpha",
                target_cast_ids=["beta"],
                visibility="private",
                thread_id="thread-1",
                action_type="private_check_in",
            )
        ],
        growth_report=growth_report,
        planned_max_rounds=1,
    )

    assert (tmp_path / "growth.mp4").exists()
