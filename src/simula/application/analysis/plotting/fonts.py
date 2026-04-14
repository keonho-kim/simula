"""Purpose:
- Configure Matplotlib to prefer Korean-capable fonts for analysis charts.
"""

from __future__ import annotations

from functools import lru_cache

from matplotlib import font_manager, ft2font, pyplot as plt

_FONT_CANDIDATES = (
    "Noto Sans KR",
    "Noto Sans CJK KR",
    "Noto Sans CJK JP",
    "Noto Sans",
    "NanumGothic",
    "Malgun Gothic",
    "AppleGothic",
)
_DEFAULT_FONT = "DejaVu Sans"
_HANGUL_SAMPLE_TEXT = "한글"


def _font_supports_text(font_path: str, text: str = _HANGUL_SAMPLE_TEXT) -> bool:
    """Return True when the font file can render every character in text."""

    try:
        charmap = ft2font.FT2Font(font_path).get_charmap()
    except RuntimeError:
        return False

    return all(ord(char) in charmap for char in text if not char.isspace())


def _resolve_font_path(font_name: str) -> str | None:
    """Resolve one Matplotlib font family name to a concrete font file."""

    try:
        return font_manager.findfont(font_name, fallback_to_default=False)
    except (RuntimeError, ValueError):
        return None


def _preferred_sans_serif_fonts(selected_font: str) -> list[str]:
    """Build a sans-serif preference list with the selected font first."""

    names: list[str] = []
    for candidate in (
        selected_font,
        *_FONT_CANDIDATES,
        *plt.rcParams.get("font.sans-serif", []),
        _DEFAULT_FONT,
    ):
        if candidate and candidate not in names:
            names.append(candidate)
    return names


@lru_cache(maxsize=1)
def configure_korean_font() -> str:
    """Select one available Korean-friendly font for Matplotlib."""

    for candidate in _FONT_CANDIDATES:
        font_path = _resolve_font_path(candidate)
        if font_path and _font_supports_text(font_path):
            plt.rcParams["font.family"] = ["sans-serif"]
            plt.rcParams["font.sans-serif"] = _preferred_sans_serif_fonts(candidate)
            plt.rcParams["axes.unicode_minus"] = False
            return candidate

    plt.rcParams["font.family"] = ["sans-serif"]
    plt.rcParams["font.sans-serif"] = _preferred_sans_serif_fonts(_DEFAULT_FONT)
    plt.rcParams["axes.unicode_minus"] = False
    return _DEFAULT_FONT
