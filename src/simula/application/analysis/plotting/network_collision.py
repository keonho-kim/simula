"""Purpose:
- Resolve node-circle overlaps in display space for network rendering.
"""

from __future__ import annotations

import numpy as np
from matplotlib.transforms import Bbox


def resolve_node_collisions_pixel_space(
    *,
    pixel_positions: dict[str, np.ndarray],
    radii_px: dict[str, float],
    padding_px: float,
    bounds_px: Bbox | None = None,
    max_iter: int = 400,
) -> dict[str, np.ndarray]:
    """Iteratively separate overlapping node circles in display space."""

    resolved = {
        node: np.asarray(position, dtype=float).copy()
        for node, position in pixel_positions.items()
    }
    node_ids = list(resolved)
    if len(node_ids) <= 1:
        return resolved

    for _ in range(max_iter):
        moved = False
        for left_index, left_node in enumerate(node_ids):
            for right_node in node_ids[left_index + 1 :]:
                left = resolved[left_node]
                right = resolved[right_node]
                delta = right - left
                distance = float(np.linalg.norm(delta))
                minimum_distance = radii_px[left_node] + radii_px[right_node] + padding_px
                if distance >= minimum_distance:
                    continue
                direction = collision_direction(
                    delta=delta,
                    left_node=left_node,
                    right_node=right_node,
                )
                shift = (minimum_distance - distance) / 2.0 + 0.5
                resolved[left_node] = left - direction * shift
                resolved[right_node] = right + direction * shift
                moved = True

        if bounds_px is not None:
            for node in node_ids:
                radius = radii_px[node] + padding_px / 2.0
                clamped_x = np.clip(
                    resolved[node][0],
                    bounds_px.xmin + radius,
                    bounds_px.xmax - radius,
                )
                clamped_y = np.clip(
                    resolved[node][1],
                    bounds_px.ymin + radius,
                    bounds_px.ymax - radius,
                )
                if not np.isclose(clamped_x, resolved[node][0]) or not np.isclose(
                    clamped_y, resolved[node][1]
                ):
                    resolved[node] = np.asarray([clamped_x, clamped_y], dtype=float)
                    moved = True
        if not moved:
            break
    return resolved


def node_radius_pixels(*, size: float, border_width: float, dpi: float) -> float:
    """Estimate one drawn node circle radius in display pixels."""

    area_points = max(size, 1.0)
    radius_points = np.sqrt(area_points / np.pi)
    return radius_points * dpi / 72.0 + (border_width * dpi / 144.0)


def collision_direction(
    *,
    delta: np.ndarray,
    left_node: str,
    right_node: str,
) -> np.ndarray:
    """Return a stable separation vector for one colliding pair."""

    distance = float(np.linalg.norm(delta))
    if distance > 1e-6:
        return delta / distance
    angle_seed = (
        sum(ord(char) for char in left_node) - sum(ord(char) for char in right_node)
    ) or 1
    angle = float(angle_seed % 360) * np.pi / 180.0
    return np.asarray([np.cos(angle), np.sin(angle)], dtype=float)


__all__ = [
    "collision_direction",
    "node_radius_pixels",
    "resolve_node_collisions_pixel_space",
]
