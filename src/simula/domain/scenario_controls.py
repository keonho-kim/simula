"""Purpose:
- Define the compact scenario-control contract parsed from scenario frontmatter.
"""

from __future__ import annotations

from typing import TypedDict


class ScenarioControls(TypedDict):
    """Scenario-level controls parsed before workflow execution."""

    create_all_participants: bool


def default_scenario_controls() -> ScenarioControls:
    """Return the default scenario-control payload."""

    return {"create_all_participants": False}
