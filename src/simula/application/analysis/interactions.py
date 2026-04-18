"""Purpose:
- Aggregate adopted activities into deterministic relationship/thread interaction digests.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from simula.application.analysis.models import (
    ActorRecord,
    AdoptedActivityRecord,
    InteractionDigestRecord,
)


@dataclass(slots=True)
class _MutableInteractionState:
    interaction_key: str
    grouping_type: str
    thread_id: str
    participant_cast_ids: list[str]
    participant_display_names: list[str]
    visibility_modes: list[str] = field(default_factory=list)
    action_types: list[str] = field(default_factory=list)
    round_start: int = 0
    round_end: int = 0
    activity_count: int = 0
    representative_interaction: str = ""
    representative_message: str = ""
    latest_message: str = ""


def build_interaction_digests(
    *,
    actors_by_id: dict[str, ActorRecord],
    activities: list[AdoptedActivityRecord],
) -> list[InteractionDigestRecord]:
    """Build stable interaction digests from adopted activities."""

    grouped: dict[tuple[str, str], _MutableInteractionState] = {}
    for activity in activities:
        participant_cast_ids = _participant_cast_ids(activity)
        if not participant_cast_ids:
            continue
        grouping_type, interaction_key = _interaction_identity(
            activity=activity,
            participant_cast_ids=participant_cast_ids,
        )
        state = grouped.setdefault(
            (grouping_type, interaction_key),
            _MutableInteractionState(
                interaction_key=interaction_key,
                grouping_type=grouping_type,
                thread_id=activity.thread_id,
                participant_cast_ids=participant_cast_ids,
                participant_display_names=[
                    _display_name_of(actors_by_id=actors_by_id, cast_id=cast_id)
                    for cast_id in participant_cast_ids
                ],
            ),
        )
        state.activity_count += 1
        if activity.visibility and activity.visibility not in state.visibility_modes:
            state.visibility_modes.append(activity.visibility)
        if activity.action_type and activity.action_type not in state.action_types:
            state.action_types.append(activity.action_type)
        if state.round_start == 0 or activity.round_index < state.round_start:
            state.round_start = activity.round_index
        if activity.round_index > state.round_end:
            state.round_end = activity.round_index
        representative_interaction = _non_empty_text(
            activity.summary,
            activity.action_type,
        )
        representative_message = _non_empty_text(
            activity.utterance,
            activity.summary,
            activity.detail,
        )
        latest_message = _non_empty_text(
            activity.utterance,
            activity.summary,
            activity.detail,
        )
        if representative_interaction:
            state.representative_interaction = representative_interaction
        if representative_message:
            state.representative_message = representative_message
        if latest_message:
            state.latest_message = latest_message

    return sorted(
        (
            InteractionDigestRecord(
                interaction_key=item.interaction_key,
                grouping_type=item.grouping_type,
                thread_id=item.thread_id,
                participant_cast_ids=item.participant_cast_ids,
                participant_display_names=item.participant_display_names,
                visibility_modes=item.visibility_modes,
                action_types=item.action_types,
                round_start=item.round_start,
                round_end=item.round_end,
                activity_count=item.activity_count,
                representative_interaction=item.representative_interaction,
                representative_message=item.representative_message,
                latest_message=item.latest_message,
            )
            for item in grouped.values()
        ),
        key=lambda item: (
            -item.activity_count,
            -item.round_end,
            0 if item.grouping_type == "thread" else 1,
            item.participant_display_names,
            item.interaction_key,
        ),
    )


def select_key_interactions(
    interactions: list[InteractionDigestRecord],
    *,
    limit: int,
) -> list[InteractionDigestRecord]:
    """Select the most salient relationship-level interactions."""

    relationship_interactions = [
        item for item in interactions if len(item.participant_cast_ids) >= 2
    ]
    return relationship_interactions[:limit]


def _interaction_identity(
    *,
    activity: AdoptedActivityRecord,
    participant_cast_ids: list[str],
) -> tuple[str, str]:
    if activity.thread_id:
        return "thread", activity.thread_id
    participants_key = "+".join(sorted(participant_cast_ids))
    action_type = activity.action_type or "interaction"
    return "participants_action", f"{participants_key}:{action_type}"


def _participant_cast_ids(activity: AdoptedActivityRecord) -> list[str]:
    participants = [activity.source_cast_id, *activity.target_cast_ids]
    deduped: list[str] = []
    for cast_id in participants:
        normalized = cast_id.strip()
        if normalized and normalized not in deduped:
            deduped.append(normalized)
    return deduped


def _display_name_of(
    *,
    actors_by_id: dict[str, ActorRecord],
    cast_id: str,
) -> str:
    actor = actors_by_id.get(cast_id)
    if actor is None:
        return cast_id
    return actor.display_name


def _non_empty_text(*values: str) -> str:
    for value in values:
        text = " ".join(str(value).split()).strip()
        if text:
            return text
    return ""
