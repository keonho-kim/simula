"""Analyzer report, action, and manifest models."""

from __future__ import annotations

from dataclasses import dataclass

@dataclass(slots=True)
class PlannedActionRecord:
    """One action option recovered from the execution plan."""

    action_type: str
    label: str
    description: str
    supported_visibility: list[str]
    requires_target: bool


@dataclass(slots=True)
class ActionAdoptionSummaryRecord:
    """One action catalog row joined with adopted-activity usage."""

    action_type: str
    label: str
    description: str
    supported_visibility: list[str]
    adopted_count: int
    adopted_round_count: int
    first_adopted_round: int | None
    last_adopted_round: int | None
    adopted_share: float | None

    def to_row(self) -> dict[str, object]:
        return {
            "action_type": self.action_type,
            "label": self.label,
            "description": self.description,
            "supported_visibility": self.supported_visibility,
            "adopted_count": self.adopted_count,
            "adopted_round_count": self.adopted_round_count,
            "first_adopted_round": self.first_adopted_round,
            "last_adopted_round": self.last_adopted_round,
            "adopted_share": self.adopted_share,
        }


@dataclass(slots=True)
class ActionCatalogReport:
    """Action catalog and adoption summary bundle."""

    rows: list[ActionAdoptionSummaryRecord]
    empty_reason: str | None = None

    @property
    def adopted_rows(self) -> list[ActionAdoptionSummaryRecord]:
        return [item for item in self.rows if item.adopted_count > 0]

    @property
    def unused_rows(self) -> list[ActionAdoptionSummaryRecord]:
        return [item for item in self.rows if item.adopted_count == 0]


@dataclass(slots=True)
class InteractionDigestRecord:
    """Deterministic grouped interaction summary for one relationship/thread."""

    interaction_key: str
    grouping_type: str
    thread_id: str
    participant_cast_ids: list[str]
    participant_display_names: list[str]
    visibility_modes: list[str]
    action_types: list[str]
    round_start: int
    round_end: int
    activity_count: int
    representative_interaction: str
    representative_message: str
    latest_message: str

    def to_row(self) -> dict[str, object]:
        return {
            "interaction_key": self.interaction_key,
            "grouping_type": self.grouping_type,
            "thread_id": self.thread_id,
            "participant_cast_ids": self.participant_cast_ids,
            "participant_display_names": self.participant_display_names,
            "visibility_modes": self.visibility_modes,
            "action_types": self.action_types,
            "round_start": self.round_start,
            "round_end": self.round_end,
            "activity_count": self.activity_count,
            "representative_interaction": self.representative_interaction,
            "representative_message": self.representative_message,
            "latest_message": self.latest_message,
        }
