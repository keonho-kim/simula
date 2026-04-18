"""Runtime and coordinator prompt projections."""

from __future__ import annotations

from collections.abc import Iterable
from typing import cast

from simula.application.workflow.utils.prompt_projections.base import (
    INTENT_STATE_LIMIT,
    LAST_FOCUS_SUMMARY_LIMIT,
    PREVIOUS_SUMMARY_LIMIT,
    WORLD_STATE_SUMMARY_LIMIT,
    compact_action_proposal_for_prompt,
    compact_intent_snapshot,
    dict_list,
    int_value,
    string_list,
    truncate_text,
)


def build_event_memory_prompt_view(
    event_memory: object,
    *,
    limit: int = 4,
) -> dict[str, object]:
    """coordinator prompt용 major-event memory 축약본을 만든다."""

    if not isinstance(event_memory, dict):
        return {}
    dumped = cast(dict[str, object], event_memory)
    events = dict_list(dumped.get("events", []))
    ordered = sorted(
        events,
        key=lambda item: (
            1 if str(item.get("status", "")) in {"pending", "in_progress"} else 0,
            -int(item.get("earliest_round", 0)),
            str(item.get("event_id", "")),
        ),
        reverse=True,
    )
    return {
        "next_event_ids": string_list(dumped.get("next_event_ids", [])),
        "overdue_event_ids": string_list(dumped.get("overdue_event_ids", [])),
        "completed_event_ids": string_list(dumped.get("completed_event_ids", [])),
        "missed_event_ids": string_list(dumped.get("missed_event_ids", [])),
        "endgame_gate_open": bool(dumped.get("endgame_gate_open", False)),
        "events": [
            {
                "event_id": str(item.get("event_id", "")),
                "title": truncate_text(item.get("title", ""), 60),
                "summary": truncate_text(item.get("summary", ""), 120),
                "status": str(item.get("status", "")),
                "participant_cast_ids": string_list(item.get("participant_cast_ids", [])),
                "earliest_round": int_value(item.get("earliest_round", 0)),
                "latest_round": int_value(item.get("latest_round", 0)),
                "must_resolve": bool(item.get("must_resolve", False)),
                "progress_summary": truncate_text(item.get("progress_summary", ""), 100),
            }
            for item in ordered[:limit]
        ],
    }


def build_relevant_intent_states(
    actor_intent_states: list[dict[str, object]],
    *,
    relevant_cast_ids: Iterable[str],
    limit: int = INTENT_STATE_LIMIT,
) -> list[dict[str, object]]:
    """prompt용 관련 actor intent subset을 만든다."""

    target_ids = [item for item in relevant_cast_ids if item]
    if not target_ids:
        return []
    selected: list[dict[str, object]] = []
    selected_ids: set[str] = set()
    target_set = set(target_ids)
    for snapshot in actor_intent_states:
        cast_id = str(snapshot.get("cast_id", ""))
        if cast_id not in target_set or cast_id in selected_ids:
            continue
        selected.append(compact_intent_snapshot(snapshot))
        selected_ids.add(cast_id)
        if len(selected) >= limit:
            break
    return selected


def build_compact_pending_actor_proposals(
    pending_actor_proposals: list[dict[str, object]],
) -> list[dict[str, object]]:
    """adjudication prompt용 actor proposal 축약본을 만든다."""

    return [
        {
            "cast_id": str(item.get("cast_id", "")),
            "forced_idle": bool(item.get("forced_idle", False)),
            "proposal": compact_action_proposal_for_prompt(item.get("proposal", {})),
        }
        for item in pending_actor_proposals
    ]


def build_progression_plan_prompt_view(
    progression_plan: dict[str, object],
) -> dict[str, object]:
    """prompt용 progression plan 축약본을 만든다."""

    return {
        "max_rounds": progression_plan.get("max_rounds"),
        "allowed_elapsed_units": string_list(
            progression_plan.get("allowed_elapsed_units", [])
        ),
        "default_elapsed_unit": progression_plan.get("default_elapsed_unit"),
    }


def build_compact_background_updates(
    background_updates: list[dict[str, object]],
) -> list[dict[str, object]]:
    """prompt용 background update 축약본을 만든다."""

    return [
        {
            "round_index": int_value(item.get("round_index", 0)),
            "cast_id": str(item.get("cast_id", "")),
            "summary": truncate_text(item.get("summary", ""), 140),
            "pressure_level": str(item.get("pressure_level", "")),
        }
        for item in background_updates
    ]


def build_prior_state_digest(
    *,
    observer_reports: list[dict[str, object]],
    world_state_summary: object,
    round_focus_history: list[dict[str, object]],
    simulation_clock: dict[str, object],
) -> dict[str, object]:
    """observer prompt용 직전 상태 digest를 만든다."""

    previous_summary = ""
    if observer_reports:
        previous_summary = str(observer_reports[-1].get("summary", ""))
    last_focus_summary = ""
    if round_focus_history:
        last_focus_summary = str(round_focus_history[-1].get("focus_summary", ""))
    return {
        "previous_observer_summary": truncate_text(
            previous_summary,
            PREVIOUS_SUMMARY_LIMIT,
        ),
        "previous_world_state_summary": truncate_text(
            world_state_summary,
            WORLD_STATE_SUMMARY_LIMIT,
        ),
        "last_focus_summary": truncate_text(
            last_focus_summary,
            LAST_FOCUS_SUMMARY_LIMIT,
        ),
        "simulation_clock_label": str(
            simulation_clock.get("total_elapsed_label", "0분")
        ),
    }
