"""Purpose:
- Define the compact scenario-control contract parsed from scenario frontmatter.
"""

from __future__ import annotations

from typing import TypedDict


class ScenarioControls(TypedDict):
    """Scenario-level controls parsed before workflow execution."""

    num_cast: int
    allow_additional_cast: bool


def build_scenario_controls(
    *,
    num_cast: int,
    allow_additional_cast: bool = True,
) -> ScenarioControls:
    """Build the normalized scenario-control payload."""

    return {
        "num_cast": num_cast,
        "allow_additional_cast": allow_additional_cast,
    }
