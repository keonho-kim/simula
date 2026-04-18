"""Validation helpers for round directive stages."""

from __future__ import annotations

from simula.domain.contracts import BackgroundUpdate, RoundDirectiveFocusCore


def validate_round_directive_focus_core_semantics(
    *,
    focus_core: RoundDirectiveFocusCore,
    focus_candidates: list[dict[str, object]],
    max_actor_calls: int,
) -> list[str]:
    """Return semantic issues for the focus-only directive stage."""

    issues: list[str] = []
    candidate_ids = {
        str(item.get("cast_id", "")).strip()
        for item in focus_candidates
        if str(item.get("cast_id", "")).strip()
    }
    selected_cast_ids: list[str] = []
    for focus_slice in focus_core.focus_slices:
        invalid_cast_ids = [
            cast_id
            for cast_id in focus_slice.focus_cast_ids
            if cast_id not in candidate_ids
        ]
        if invalid_cast_ids:
            issues.append(
                "focus_slices에 후보 pool 밖 cast_id가 있습니다: "
                + ", ".join(invalid_cast_ids)
            )
        for cast_id in focus_slice.focus_cast_ids:
            if cast_id not in selected_cast_ids:
                selected_cast_ids.append(cast_id)
    if len(selected_cast_ids) > max_actor_calls:
        issues.append(
            f"selected cast 수는 최대 {max_actor_calls}명이어야 합니다. 현재 {len(selected_cast_ids)}명입니다."
        )
    return issues


def build_round_directive_focus_core_repair_context(
    *,
    focus_candidates: list[dict[str, object]],
    max_focus_slices: int,
    max_actor_calls: int,
) -> dict[str, object]:
    """Build repair context for the focus-only directive stage."""

    return {
        "valid_focus_candidate_ids": [
            str(item.get("cast_id", ""))
            for item in focus_candidates
            if str(item.get("cast_id", "")).strip()
        ],
        "max_focus_slices": max_focus_slices,
        "max_actor_calls": max_actor_calls,
        "repair_guidance": [
            "Use only focus candidate cast ids in `focus_slices.focus_cast_ids`.",
            "Keep the selected cast union within the actor-call budget.",
            "Do not generate background updates in this stage.",
        ],
    }


def validate_background_update_batch_semantics(
    *,
    background_update_batch: list[BackgroundUpdate],
    deferred_cast_ids: list[str],
    round_index: int,
) -> list[str]:
    """Return semantic issues for the background-update stage."""

    issues: list[str] = []
    valid_cast_id_set = set(deferred_cast_ids)
    for update in background_update_batch:
        if update.cast_id not in valid_cast_id_set:
            issues.append(
                f"background update `{update.cast_id}` 는 deferred actor가 아닙니다."
            )
        if update.round_index != round_index:
            issues.append(
                f"background update `{update.cast_id}` 의 round_index 는 {round_index} 이어야 합니다."
            )
    return issues


def build_background_update_batch_repair_context(
    *,
    deferred_actors: list[dict[str, object]],
    round_index: int,
) -> dict[str, object]:
    """Build repair context for the background-update stage."""

    valid_deferred_cast_ids = [
        str(actor.get("cast_id", ""))
        for actor in deferred_actors
        if str(actor.get("cast_id", "")).strip()
    ]
    return {
        "valid_deferred_cast_ids": valid_deferred_cast_ids,
        "valid_deferred_actor_map": {
            str(actor.get("cast_id", "")): str(actor.get("display_name", ""))
            for actor in deferred_actors
            if str(actor.get("cast_id", "")).strip()
        },
        "round_index": round_index,
        "repair_guidance": [
            "Use only deferred actor cast ids in `background_updates`.",
            "Copy each `cast_id` exactly from `valid_deferred_cast_ids`; never rename or reformat it.",
            "If a cast_id is invalid, replace it with the closest matching valid deferred cast id instead of dropping the item.",
            "Keep `pressure_level` as one of low, medium, high.",
            "Set each `round_index` to the provided round index.",
        ],
    }
