"""Validation helpers for round resolution stages."""

from __future__ import annotations

from typing import cast

from simula.domain.contracts import ActorIntentSnapshot, MajorEventUpdate, RoundResolutionCore


def validate_round_resolution_core_semantics(
    *,
    resolution_core: RoundResolutionCore,
    pending_actor_proposals: list[dict[str, object]],
) -> list[str]:
    valid_cast_ids = {
        str(item.get("cast_id", "")).strip()
        for item in pending_actor_proposals
        if str(item.get("cast_id", "")).strip()
    }
    invalid_cast_ids = [
        cast_id
        for cast_id in resolution_core.adopted_cast_ids
        if cast_id not in valid_cast_ids
    ]
    if not invalid_cast_ids:
        return []
    return [
        "adopted_cast_ids에 pending proposal 밖 cast_id가 있습니다: "
        + ", ".join(invalid_cast_ids)
    ]


def build_round_resolution_core_repair_context(
    *,
    pending_actor_proposals: list[dict[str, object]],
) -> dict[str, object]:
    return {
        "valid_adopted_cast_ids": [
            str(item.get("cast_id", ""))
            for item in pending_actor_proposals
            if str(item.get("cast_id", "")).strip()
        ],
        "repair_guidance": [
            "Adopt only cast ids from the pending proposal set.",
            "Keep `world_state_summary` non-empty and concrete.",
            'Use only `""` or `"simulation_done"` for `stop_reason`.',
        ],
    }


def validate_major_event_update_batch_semantics(
    *,
    major_event_update_batch: list[MajorEventUpdate],
    event_memory: dict[str, object],
) -> list[str]:
    valid_event_ids = {
        str(item.get("event_id", "")).strip()
        for item in dict_list(event_memory.get("events", []))
        if str(item.get("event_id", "")).strip()
    }
    invalid_event_ids = [
        update.event_id
        for update in major_event_update_batch
        if update.event_id not in valid_event_ids
    ]
    if not invalid_event_ids:
        return []
    return [
        "event_updates에 event memory 밖 event_id가 있습니다: "
        + ", ".join(invalid_event_ids)
    ]


def build_major_event_update_batch_repair_context(
    *,
    event_memory: dict[str, object],
) -> dict[str, object]:
    return {
        "valid_event_ids": [
            str(item.get("event_id", ""))
            for item in dict_list(event_memory.get("events", []))
            if str(item.get("event_id", "")).strip()
        ],
        "repair_guidance": [
            "Use only event ids from event memory.",
            "Keep `progress_summary` concrete and non-empty.",
        ],
    }


def validate_actor_intent_state_batch_semantics(
    *,
    actor_intent_state_batch: list[ActorIntentSnapshot],
    actors: list[dict[str, object]],
) -> list[str]:
    valid_cast_ids = {
        str(actor.get("cast_id", "")).strip()
        for actor in actors
        if str(actor.get("cast_id", "")).strip()
    }
    invalid_cast_ids = [
        snapshot.cast_id
        for snapshot in actor_intent_state_batch
        if snapshot.cast_id not in valid_cast_ids
    ]
    if not invalid_cast_ids:
        return []
    return [
        "actor_intent_states에 actor roster 밖 cast_id가 있습니다: "
        + ", ".join(invalid_cast_ids)
    ]


def build_actor_intent_state_batch_repair_context(
    *,
    actors: list[dict[str, object]],
) -> dict[str, object]:
    return {
        "valid_cast_ids": [
            str(actor.get("cast_id", ""))
            for actor in actors
            if str(actor.get("cast_id", "")).strip()
        ],
        "repair_guidance": [
            "Use only actor roster cast ids.",
            "Keep `goal` concrete and scenario-grounded.",
            "Return only the current schema fields for each item.",
            "Return each cast id at most once.",
        ],
    }


def dict_list(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, object], item) for item in value if isinstance(item, dict)]
