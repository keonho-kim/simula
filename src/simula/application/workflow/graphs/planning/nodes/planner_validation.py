"""Validation and repair helpers for planning nodes."""

from __future__ import annotations

from collections.abc import Sequence
from typing import cast

from simula.domain.contracts import (
    ActionCatalog,
    CastRoster,
    CastRosterOutlineItem,
    ExecutionPlanFrameBundle,
    MajorEventPlanItem,
)

def validate_cast_roster_outline_semantics(
    *,
    cast_roster_outline: list[CastRosterOutlineItem],
    num_cast: int,
    allow_additional_cast: bool,
) -> list[str]:
    """Return semantic issues for the cast roster outline."""

    issues: list[str] = []
    items = list(cast_roster_outline)
    cast_count = len(items)
    if allow_additional_cast:
        if cast_count < num_cast:
            issues.append(
                f"cast roster outline는 최소 {num_cast}명을 포함해야 합니다. 현재 {cast_count}명입니다."
            )
    elif cast_count != num_cast:
        issues.append(
            f"cast roster outline는 정확히 {num_cast}명이어야 합니다. 현재 {cast_count}명입니다."
        )

    expected_slots = list(range(1, cast_count + 1))
    actual_slots = [item.slot_index for item in items]
    if actual_slots != expected_slots:
        issues.append(
            "cast roster outline의 slot_index 는 1부터 끊김 없이 증가해야 합니다."
        )
    return issues


def build_cast_roster_outline_repair_context(
    *,
    num_cast: int,
    allow_additional_cast: bool,
) -> dict[str, object]:
    return {
        "num_cast": num_cast,
        "allow_additional_cast": allow_additional_cast,
        "repair_guidance": [
            "`slot_index` must start at 1 and increase without gaps up to the final cast count.",
            (
                f"Return exactly {num_cast} cast outline items."
                if not allow_additional_cast
                else f"Return at least {num_cast} cast outline items."
            ),
            "Reuse scenario-grounded participant names or role labels only.",
        ],
    }


def validate_execution_plan_frame_semantics(
    *,
    execution_plan_frame: ExecutionPlanFrameBundle,
    cast_roster_outline: list[CastRosterOutlineItem],
    planned_max_rounds: int,
) -> list[str]:
    issues: list[str] = []
    issues.extend(
        validate_action_catalog_semantics(
            action_catalog=execution_plan_frame.action_catalog.model_dump(mode="json")
        )
    )
    cast_roster = cast(
        list[dict[str, object]],
        [
            {"cast_id": item.cast_id, "display_name": item.display_name}
            for item in cast_roster_outline
        ],
    )
    try:
        validate_major_events(
            major_events=[
                item.model_dump(mode="json") for item in execution_plan_frame.major_events
            ],
            cast_roster=cast_roster,
            planned_max_rounds=planned_max_rounds,
        )
    except ValueError as exc:
        issues.append(str(exc))
    return issues


def build_execution_plan_frame_repair_context(
    *,
    cast_roster_outline: list[CastRosterOutlineItem],
    planned_max_rounds: int,
) -> dict[str, object]:
    return {
        "valid_cast_ids": [item.cast_id for item in cast_roster_outline],
        "max_actions": 5,
        "max_major_events": 6,
        "planned_max_rounds": planned_max_rounds,
        "repair_guidance": [
            "Keep `action_catalog.actions` at 5 items or fewer.",
            "Keep `major_events` at 6 items or fewer.",
            "Use only the provided cast ids in `major_events.participant_cast_ids`.",
            "Each action must keep `action_type`, `label`, `description`, `supported_visibility`, and `requires_target`.",
            "Use broad, reusable action categories rather than scenario-specific micro-actions.",
        ],
    }


def build_action_catalog_repair_context() -> dict[str, object]:
    return {
        "max_actions": 5,
        "repair_guidance": [
            "Keep `actions` at 5 items or fewer.",
            "Keep `action_type` values unique.",
            "Each action must keep `action_type`, `label`, `description`, `supported_visibility`, and `requires_target`.",
            "Use broad, reusable action categories rather than scenario-specific micro-actions.",
        ],
    }


def validate_major_event_plan_batch_semantics(
    *,
    major_event_batch: list[MajorEventPlanItem],
    cast_roster_outline: list[CastRosterOutlineItem],
    action_catalog: ActionCatalog,
    planned_max_rounds: int,
) -> list[str]:
    issues: list[str] = []
    cast_roster = cast(
        list[dict[str, object]],
        [
            {"cast_id": item.cast_id, "display_name": item.display_name}
            for item in cast_roster_outline
        ],
    )
    try:
        validate_major_events(
            major_events=[item.model_dump(mode="json") for item in major_event_batch],
            cast_roster=cast_roster,
            planned_max_rounds=planned_max_rounds,
        )
    except ValueError as exc:
        issues.append(str(exc))
    allowed_action_types = {item.action_type for item in action_catalog.actions}
    for event in major_event_batch:
        invalid_action_types = [
            action_type
            for action_type in event.completion_action_types
            if action_type not in allowed_action_types
        ]
        if invalid_action_types:
            issues.append(
                f"major event `{event.event_id}` 의 completion_action_types가 action catalog에 없습니다: {', '.join(invalid_action_types)}"
            )
    return issues


def build_major_event_plan_batch_repair_context(
    *,
    cast_roster_outline: list[CastRosterOutlineItem],
    action_catalog: ActionCatalog,
    planned_max_rounds: int,
) -> dict[str, object]:
    return {
        "valid_cast_ids": [item.cast_id for item in cast_roster_outline],
        "valid_action_types": [item.action_type for item in action_catalog.actions],
        "max_major_events": 6,
        "planned_max_rounds": planned_max_rounds,
        "repair_guidance": [
            "Use only the provided cast ids in `participant_cast_ids`.",
            "Use only the provided action types in `completion_action_types`.",
            "Keep `completion_signals` as a non-empty array of strings.",
            "Keep `major_events` at 6 items or fewer.",
        ],
    }


def validate_action_catalog_semantics(
    *,
    action_catalog: dict[str, object],
) -> list[str]:
    issues: list[str] = []
    for raw_action in cast(list[object], action_catalog.get("actions", [])):
        if not isinstance(raw_action, dict):
            continue
        action = cast(dict[str, object], raw_action)
        action_type = str(action.get("action_type", "")).strip()
        requires_target = bool(action.get("requires_target", False))
        supported_visibility = [
            str(item)
            for item in cast(list[object], action.get("supported_visibility", []))
        ]
        if requires_target and not set(supported_visibility).intersection(
            {"private", "group"}
        ):
            issues.append(
                f"action_type `{action_type}` 는 requires_target=true 이므로 `private` 또는 `group` visibility를 지원해야 합니다."
            )
    return issues


def validate_plan_cast_chunk_semantics(
    *,
    cast_roster: CastRoster,
    assigned_outline: list[CastRosterOutlineItem],
) -> list[str]:
    issues: list[str] = []
    expected_by_id = {item.cast_id: item.display_name for item in assigned_outline}
    actual_items = list(cast_roster.items)
    if len(actual_items) != len(assigned_outline):
        issues.append(
            f"cast chunk는 정확히 {len(assigned_outline)}명이어야 합니다. 현재 {len(actual_items)}명입니다."
        )
        return issues
    actual_ids = [item.cast_id for item in actual_items]
    unexpected_ids = [cast_id for cast_id in actual_ids if cast_id not in expected_by_id]
    missing_ids = [cast_id for cast_id in expected_by_id if cast_id not in actual_ids]
    if unexpected_ids:
        issues.append(
            "cast chunk에 배정되지 않은 cast_id가 포함되어 있습니다: "
            + ", ".join(unexpected_ids)
        )
    if missing_ids:
        issues.append(
            "cast chunk에 누락된 cast_id가 있습니다: " + ", ".join(missing_ids)
        )
    for item in actual_items:
        expected_display_name = expected_by_id.get(item.cast_id)
        if expected_display_name is not None and item.display_name != expected_display_name:
            issues.append(
                f"cast_id `{item.cast_id}` 의 display_name 은 `{expected_display_name}` 이어야 합니다."
            )
    return issues


def build_plan_cast_chunk_repair_context(
    *,
    chunk_index: int,
    assigned_outline: list[CastRosterOutlineItem],
) -> dict[str, object]:
    return {
        "chunk_index": chunk_index,
        "assigned_cast_ids": [item.cast_id for item in assigned_outline],
        "assigned_display_names": {
            item.cast_id: item.display_name for item in assigned_outline
        },
        "exact_chunk_size": len(assigned_outline),
        "repair_guidance": [
            "Return only the assigned cast ids for this chunk.",
            "Reuse each assigned display_name exactly as provided.",
            f"Return exactly {len(assigned_outline)} cast items.",
        ],
    }


def build_cast_roster_outline_model(
    payload: Sequence[object],
) -> list[CastRosterOutlineItem]:
    return [
        CastRosterOutlineItem.model_validate(item)
        for item in payload
        if isinstance(item, dict)
    ]


def build_cast_roster_outline_items(
    values: Sequence[object],
) -> list[CastRosterOutlineItem]:
    return [
        CastRosterOutlineItem.model_validate(item)
        for item in values
        if isinstance(item, dict)
    ]


def validate_unique_cast_roster(cast_roster: list[dict[str, object]]) -> None:
    cast_ids = [str(item["cast_id"]) for item in cast_roster]
    display_names = [str(item["display_name"]) for item in cast_roster]
    if len(cast_ids) != len(set(cast_ids)):
        raise ValueError("cast roster에 중복 cast_id를 허용하지 않습니다.")
    if len(display_names) != len(set(display_names)):
        raise ValueError("cast roster에 중복 display_name을 허용하지 않습니다.")


def validate_cast_roster_count(
    *,
    cast_roster: list[dict[str, object]],
    num_cast: int,
    allow_additional_cast: bool,
) -> None:
    cast_count = len(cast_roster)
    if allow_additional_cast:
        if cast_count < num_cast:
            raise ValueError(
                f"cast roster는 최소 {num_cast}명을 포함해야 합니다. 현재 {cast_count}명입니다."
            )
        return
    if cast_count != num_cast:
        raise ValueError(
            f"cast roster는 정확히 {num_cast}명이어야 합니다. 현재 {cast_count}명입니다."
        )


def validate_major_events(
    *,
    major_events: list[dict[str, object]],
    cast_roster: list[dict[str, object]],
    planned_max_rounds: int,
) -> None:
    cast_ids = {
        str(item.get("cast_id", "")).strip()
        for item in cast_roster
        if str(item.get("cast_id", "")).strip()
    }
    event_ids: set[str] = set()
    for event in major_events:
        event_id = str(event.get("event_id", "")).strip()
        if not event_id:
            raise ValueError("major event에 빈 event_id를 허용하지 않습니다.")
        if event_id in event_ids:
            raise ValueError(f"major event_id 중복을 허용하지 않습니다: {event_id}")
        event_ids.add(event_id)
        earliest_round = int_value(event.get("earliest_round", 0))
        latest_round = int_value(event.get("latest_round", 0))
        if earliest_round < 1 or latest_round < 1:
            raise ValueError("major event round window는 1 이상이어야 합니다.")
        if earliest_round > latest_round:
            raise ValueError(
                f"major event `{event_id}` 는 earliest_round가 latest_round보다 클 수 없습니다."
            )
        if latest_round > planned_max_rounds:
            raise ValueError(
                f"major event `{event_id}` 는 planned max round {planned_max_rounds} 안에 있어야 합니다."
            )
        participant_values = event.get("participant_cast_ids", [])
        participant_cast_ids = (
            [str(item).strip() for item in participant_values if str(item).strip()]
            if isinstance(participant_values, list)
            else []
        )
        invalid_cast_ids = [
            cast_id for cast_id in participant_cast_ids if cast_id not in cast_ids
        ]
        if invalid_cast_ids:
            raise ValueError(
                f"major event `{event_id}` 의 participant_cast_ids가 cast roster에 없습니다: {', '.join(invalid_cast_ids)}"
            )


def int_value(value: object) -> int:
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return 0
