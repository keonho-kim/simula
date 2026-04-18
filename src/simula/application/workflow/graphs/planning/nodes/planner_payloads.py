"""Payload assembly helpers for planning nodes."""

from __future__ import annotations

from typing import cast


def build_plan_payload(
    *,
    planning_analysis: dict[str, object],
    execution_plan_frame: dict[str, object],
    cast_roster: list[dict[str, object]],
) -> dict[str, object]:
    time_scope = cast(dict[str, object], planning_analysis.get("time_scope", {}))
    key_pressures = planning_analysis.get("key_pressures", [])
    situation = cast(dict[str, object], execution_plan_frame["situation"])
    progression_plan = cast(dict[str, object], planning_analysis["progression_plan"])
    action_catalog = cast(dict[str, object], execution_plan_frame["action_catalog"])
    coordination_frame = cast(
        dict[str, object], execution_plan_frame["coordination_frame"]
    )
    major_events = cast(list[object], execution_plan_frame.get("major_events", []))
    interpretation = {
        "brief_summary": str(planning_analysis.get("brief_summary", "")),
        "premise": str(planning_analysis.get("premise", "")),
        "time_scope": dict(time_scope),
        "key_pressures": list(cast(list[object], key_pressures)),
    }
    return {
        "interpretation": interpretation,
        "situation": dict(situation),
        "progression_plan": dict(progression_plan),
        "action_catalog": dict(action_catalog),
        "coordination_frame": dict(coordination_frame),
        "cast_roster": list(cast_roster),
        "major_events": list(major_events),
    }
