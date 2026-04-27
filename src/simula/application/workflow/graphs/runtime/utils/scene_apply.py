"""Scene beat application helpers."""

from __future__ import annotations

from typing import Any, cast, get_args

from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.activity.actions import create_canonical_action
from simula.domain.activity.feeds import build_visibility_scope, route_activity
from simula.domain.contracts import SceneDelta
from simula.domain.event_memory import (
    evaluate_round_event_updates,
    hard_stop_round,
    has_required_unresolved_events,
    sanitize_event_updates,
)
from simula.domain.scenario.time import (
    TimeUnit,
    cumulative_elapsed_label,
    duration_label,
    duration_minutes,
)

_SUPPORTED_TIME_UNITS = frozenset(get_args(TimeUnit))


def apply_scene_beats(
    *,
    state: SimulationWorkflowState,
    round_index: int,
    scene_beats: list[dict[str, Any]],
    candidates: list[dict[str, Any]],
) -> dict[str, Any]:
    feeds = dict(state.get("activity_feeds", {}))
    all_activities = list(state.get("activities", []))
    latest: list[dict[str, Any]] = []
    candidate_by_id = {str(item.get("candidate_id", "")): item for item in candidates}
    for beat in scene_beats:
        candidate = candidate_by_id[str(beat.get("candidate_id", ""))]
        action = create_canonical_action(
            run_id=str(state["run_id"]),
            round_index=round_index,
            source_cast_id=str(beat.get("source_cast_id", "")),
            visibility=cast(Any, str(candidate.get("visibility", "public"))),
            target_cast_ids=[
                str(item) for item in list(beat.get("target_cast_ids", []))
            ],
            visibility_scope=build_visibility_scope(
                str(beat.get("source_cast_id", "")),
                [str(item) for item in list(beat.get("target_cast_ids", []))],
                str(candidate.get("visibility", "public")),
            ),
            action_type=str(beat.get("action_type", "")),
            goal=str(beat.get("intent", "")),
            summary=str(beat.get("summary", "")),
            detail=str(beat.get("detail", "")),
            utterance=str(beat.get("utterance", "")),
            beat_id=str(beat.get("beat_id", "")),
            reaction=str(beat.get("reaction", "")),
            emotional_tone=str(beat.get("emotional_tone", "")),
            event_effect=str(beat.get("event_effect", "")),
            thread_id=f"event:{str(candidate.get('event_id', ''))}",
        ).model_dump(mode="json")
        all_activities.append(action)
        latest.append(action)
        feeds = route_activity(feeds, action)
    return {
        "activity_feeds": feeds,
        "activities": all_activities,
        "latest_round_activities": latest,
    }


def event_updates(
    *,
    event_memory: dict[str, Any],
    proposed_updates: list[dict[str, Any]],
    latest_round_activities: list[dict[str, Any]],
    current_round_index: int,
) -> list[dict[str, Any]]:
    hints = evaluate_round_event_updates(
        event_memory,
        latest_round_activities=latest_round_activities,
        current_round_index=current_round_index,
    )
    return sanitize_event_updates(
        event_memory,
        proposed_updates=proposed_updates,
        latest_round_activities=latest_round_activities,
        evaluation_hints=hints,
    )


def effective_stop_reason(
    *,
    state: SimulationWorkflowState,
    round_index: int,
    requested_stop_reason: str,
    event_memory: dict[str, Any],
    chosen_count: int,
) -> str:
    planned_max_rounds = int(state.get("planned_max_rounds", state["max_rounds"]))
    hard_stop = hard_stop_round(
        configured_max_rounds=int(state["max_rounds"]),
        planned_max_rounds=planned_max_rounds,
    )
    if round_index >= hard_stop:
        return "simulation_done"
    if requested_stop_reason == "simulation_done" and not has_required_unresolved_events(
        event_memory
    ):
        return "simulation_done"
    if chosen_count == 0 and int(state.get("stagnation_rounds", 0)) >= 1:
        return "no_progress"
    return ""


def build_updated_clock(
    *,
    state: SimulationWorkflowState,
    round_index: int,
    time_advance: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    previous_clock = dict(state["simulation_clock"])
    elapsed_unit = str(time_advance["elapsed_unit"])
    elapsed_amount = int(str(time_advance["elapsed_amount"]))
    if elapsed_unit not in _SUPPORTED_TIME_UNITS:
        raise ValueError(f"지원하지 않는 elapsed_unit 입니다: {elapsed_unit}")
    normalized_elapsed_unit = cast(TimeUnit, elapsed_unit)
    elapsed_minutes = duration_minutes(
        time_unit=normalized_elapsed_unit,
        amount=elapsed_amount,
    )
    total_elapsed_minutes = (
        int(str(previous_clock.get("total_elapsed_minutes", 0))) + elapsed_minutes
    )
    round_time_record = {
        "round_index": round_index,
        "elapsed_unit": normalized_elapsed_unit,
        "elapsed_amount": elapsed_amount,
        "elapsed_minutes": elapsed_minutes,
        "elapsed_label": duration_label(
            time_unit=normalized_elapsed_unit,
            amount=elapsed_amount,
        ),
        "total_elapsed_minutes": total_elapsed_minutes,
        "total_elapsed_label": cumulative_elapsed_label(total_elapsed_minutes),
        "reason": str(time_advance["reason"]),
    }
    return {
        "time_advance": round_time_record,
        "simulation_clock": {
            "total_elapsed_minutes": total_elapsed_minutes,
            "total_elapsed_label": round_time_record["total_elapsed_label"],
            "last_elapsed_minutes": elapsed_minutes,
            "last_elapsed_label": round_time_record["elapsed_label"],
            "last_advanced_round_index": round_index,
        },
    }


def observer_report(
    *,
    round_index: int,
    delta: SceneDelta,
    event: dict[str, Any],
    actual_event_updates: list[dict[str, Any]],
) -> dict[str, Any]:
    notable = [
        str(update.get("progress_summary", ""))
        for update in actual_event_updates
        if str(update.get("progress_summary", "")).strip()
    ]
    return {
        "round_index": round_index,
        "summary": delta.world_state_summary,
        "notable_events": notable
        or [f"{str(event.get('title', 'Selected event'))} remained active."],
        "atmosphere": "focused",
        "momentum": "medium" if delta.scene_beats else "low",
        "world_state_summary": delta.world_state_summary,
    }


def actor_digest(
    *,
    round_index: int,
    world_state_summary: str,
    latest_round_activities: list[dict[str, Any]],
    event: dict[str, Any],
) -> dict[str, Any]:
    next_step_notes = [
        str(activity.get("summary", ""))
        for activity in latest_round_activities[:2]
        if str(activity.get("summary", "")).strip()
    ] or [str(event.get("title", "The selected event remains active."))]
    return {
        "round_index": round_index,
        "current_pressures": [str(event.get("title", "Selected event"))],
        "next_step_notes": next_step_notes,
        "world_state_summary": world_state_summary,
    }


def next_stagnation_rounds(
    *,
    previous: int,
    chosen_count: int,
    stop_reason: str,
) -> int:
    if stop_reason:
        return previous
    return 0 if chosen_count else previous + 1


def scene_errors(
    state: SimulationWorkflowState,
    round_index: int,
    meta: dict[str, Any],
) -> list[str]:
    errors = list(state.get("errors", []))
    if bool(meta.get("forced_default", False)):
        errors.append(f"scene tick {round_index} defaulted")
    return errors
