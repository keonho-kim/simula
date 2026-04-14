"""Purpose:
- Configure Matplotlib to prefer Korean-capable fonts for analysis charts.
"""

from __future__ import annotations

from functools import lru_cache

from matplotlib import font_manager, pyplot as plt

_FONT_CANDIDATES = (
    "Noto Sans KR",
    "Noto Sans CJK KR",
    "NanumGothic",
    "Malgun Gothic",
    "AppleGothic",
    "DejaVu Sans",
)


@lru_cache(maxsize=1)
def configure_korean_font() -> str:
    """Select one available Korean-friendly font for Matplotlib."""

    available_fonts = {
        item.name
        for item in font_manager.fontManager.ttflist
    }
    for candidate in _FONT_CANDIDATES:
        if candidate in available_fonts:
            plt.rcParams["font.family"] = [candidate]
            plt.rcParams["axes.unicode_minus"] = False
            return candidate

    plt.rcParams["font.family"] = ["DejaVu Sans"]
    plt.rcParams["axes.unicode_minus"] = False
    return "DejaVu Sans"
