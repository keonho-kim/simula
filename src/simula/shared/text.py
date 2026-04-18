"""Shared text normalization helpers."""

from __future__ import annotations

import re
import unicodedata

_NON_ALNUM_PATTERN = re.compile(r"[^a-z0-9]+")


def slugify_path_token(value: str) -> str:
    """Normalize one filesystem-safe lowercase token."""

    normalized = unicodedata.normalize("NFKD", value).encode(
        "ascii", "ignore"
    ).decode("ascii")
    slug = _NON_ALNUM_PATTERN.sub("-", normalized.strip().lower()).strip("-")
    return slug
