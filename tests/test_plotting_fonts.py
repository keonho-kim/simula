"""Purpose:
- Verify Matplotlib font selection for Korean analysis plots.
"""

from __future__ import annotations

from collections.abc import Iterator
import warnings

import matplotlib.pyplot as plt
import networkx as nx
import pytest

from simula.application.analysis.plotting import fonts
from simula.application.analysis.plotting import network as plotting_network
from simula.application.analysis.plotting.network import render_network_plot


@pytest.fixture(autouse=True)
def _reset_matplotlib_font_state() -> Iterator[None]:
    """Restore Matplotlib font settings after each test."""

    fonts.configure_korean_font.cache_clear()
    original_rcparams = plt.rcParams.copy()

    try:
        yield
    finally:
        fonts.configure_korean_font.cache_clear()
        plt.rcParams.update(original_rcparams)


def test_configure_korean_font_prefers_hangul_capable_family(monkeypatch) -> None:
    font_paths = {
        "Noto Sans": "/fonts/noto-sans.ttf",
        "Noto Sans CJK JP": "/fonts/noto-cjk.ttc",
        "NanumGothic": "/fonts/nanum.ttf",
    }

    monkeypatch.setattr(fonts, "_resolve_font_path", lambda name: font_paths.get(name))
    monkeypatch.setattr(
        fonts,
        "_font_supports_text",
        lambda font_path, text=fonts._HANGUL_SAMPLE_TEXT: (
            font_path != "/fonts/noto-sans.ttf"
        ),
    )
    plt.rcParams["font.sans-serif"] = ["DejaVu Sans", "Verdana"]

    selected = fonts.configure_korean_font()

    assert selected == "Noto Sans CJK JP"
    assert plt.rcParams["font.family"] == ["sans-serif"]
    assert plt.rcParams["font.sans-serif"][0] == "Noto Sans CJK JP"
    assert "NanumGothic" in plt.rcParams["font.sans-serif"]
    assert plt.rcParams["axes.unicode_minus"] is False
    assert plt.rcParams["axes.facecolor"] == "#E5E5E5"
    assert plt.rcParams["axes.grid"] is True


def test_configure_korean_font_falls_back_to_dejavu_when_needed(monkeypatch) -> None:
    monkeypatch.setattr(fonts, "_resolve_font_path", lambda name: f"/fonts/{name}.ttf")
    monkeypatch.setattr(
        fonts,
        "_font_supports_text",
        lambda font_path, text=fonts._HANGUL_SAMPLE_TEXT: False,
    )

    selected = fonts.configure_korean_font()

    assert selected == "DejaVu Sans"
    assert plt.rcParams["font.family"] == ["sans-serif"]
    assert plt.rcParams["font.sans-serif"][0] == "DejaVu Sans"
    assert plt.rcParams["axes.unicode_minus"] is False
    assert plt.rcParams["axes.facecolor"] == "#E5E5E5"
    assert plt.rcParams["axes.grid"] is True


def test_render_network_plot_avoids_missing_hangul_glyph_warnings(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    selected = fonts.configure_korean_font()
    if selected == "DejaVu Sans":
        pytest.skip("No Korean-capable font is available in this environment.")

    graph = nx.DiGraph()
    graph.add_node("alpha", display_name="경수", total_weight=1)
    graph.add_node("beta", display_name="옥순", total_weight=1)
    graph.add_edge("alpha", "beta", total_weight=1)
    monkeypatch.setattr(
        plotting_network,
        "compute_layout_positions",
        lambda graph, layout_kwargs=None: {  # noqa: ARG005
            "alpha": (-1.0, 0.0),
            "beta": (1.0, 0.0),
        },
    )

    with warnings.catch_warnings(record=True) as captured:
        warnings.simplefilter("always")
        render_network_plot(graph, title="연결망", output_path=tmp_path / "graph.png")

    missing_glyph_warnings = [
        warning
        for warning in captured
        if "missing from font(s)" in str(warning.message)
    ]
    assert missing_glyph_warnings == []
