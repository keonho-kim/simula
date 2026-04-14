"""Purpose:
- Build stable simulation log events for both real-time append and final artifacts.
"""

from __future__ import annotations

from typing import cast


def build_simulation_started_event(
    *,
    run_id: str,
    scenario: object,
    max_rounds: object,
    rng_seed: object,
) -> dict[str, object]:
    return {
        "event": "simulation_started",
        "event_key": "simulation_started",
        "run_id": run_id,
        "scenario": str(scenario or ""),
        "max_rounds": _int_value(max_rounds),
        "rng_seed": _optional_int_value(rng_seed),
    }


def build_plan_finalized_event(
    *,
    run_id: str,
    plan: dict[str, object],
) -> dict[str, object]:
    return {
        "event": "plan_finalized",
        "event_key": "plan_finalized",
        "run_id": run_id,
        "plan": plan,
    }


def build_actors_finalized_event(
    *,
    run_id: str,
    actors: list[dict[str, object]],
) -> dict[str, object]:
    return {
        "event": "actors_finalized",
        "event_key": "actors_finalized",
        "run_id": run_id,
        "actors": actors,
    }


def build_round_focus_selected_event(
    *,
    run_id: str,
    round_index: int,
    round_focus_plan: dict[str, object],
) -> dict[str, object]:
    return {
        "event": "round_focus_selected",
        "event_key": f"round_focus_selected:{round_index}",
        "run_id": run_id,
        "round_index": round_index,
        "round_focus_plan": round_focus_plan,
    }


def build_round_time_advanced_event(
    *,
    run_id: str,
    round_index: int,
    time_advance: dict[str, object],
) -> dict[str, object]:
    return {
        "event": "round_time_advanced",
        "event_key": f"round_time_advanced:{round_index}",
        "run_id": run_id,
        "round_index": round_index,
        "time_advance": time_advance,
    }


def build_round_background_updated_event(
    *,
    run_id: str,
    round_index: int,
    background_updates: list[dict[str, object]],
) -> dict[str, object]:
    return {
        "event": "round_background_updated",
        "event_key": f"round_background_updated:{round_index}",
        "run_id": run_id,
        "round_index": round_index,
        "background_updates": background_updates,
    }


def build_round_actions_adopted_event(
    *,
    run_id: str,
    round_index: int,
    activities: list[dict[str, object]],
) -> dict[str, object]:
    return {
        "event": "round_actions_adopted",
        "event_key": f"round_actions_adopted:{round_index}",
        "run_id": run_id,
        "round_index": round_index,
        "activities": activities,
    }


def build_round_observer_report_event(
    *,
    run_id: str,
    round_index: int,
    observer_report: dict[str, object],
) -> dict[str, object]:
    return {
        "event": "round_observer_report",
        "event_key": f"round_observer_report:{round_index}",
        "run_id": run_id,
        "round_index": round_index,
        "observer_report": observer_report,
    }


def build_final_report_event(
    *,
    run_id: str,
    final_report: dict[str, object],
    stop_reason: object,
) -> dict[str, object]:
    return {
        "event": "final_report",
        "event_key": "final_report",
        "run_id": run_id,
        "final_report": final_report,
        "stop_reason": stop_reason,
    }


def build_llm_usage_summary_event(
    *,
    run_id: str,
    llm_usage_summary: dict[str, object],
) -> dict[str, object]:
    return {
        "event": "llm_usage_summary",
        "event_key": "llm_usage_summary",
        "run_id": run_id,
        "llm_usage_summary": llm_usage_summary,
    }


def _int_value(value: object) -> int:
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return 0


def _optional_int_value(value: object) -> int | None:
    if value is None:
        return None
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return cast(int | None, None)
