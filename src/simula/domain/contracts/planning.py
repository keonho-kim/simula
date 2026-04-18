"""Planning-stage contracts."""

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from simula.domain.contracts.shared import (
    RuntimeProgressionPlan,
    ScenarioTimeScope,
    VisibilityType,
)


class PlanningAnalysis(BaseModel):
    """Single required planning-analysis bundle."""

    brief_summary: str
    premise: str
    time_scope: ScenarioTimeScope
    key_pressures: list[str]
    progression_plan: RuntimeProgressionPlan

    @model_validator(mode="after")
    def validate_planning_analysis(self) -> "PlanningAnalysis":
        for field_name in ("brief_summary", "premise"):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        return self


class SituationBundle(BaseModel):
    """Compact execution situation bundle."""

    simulation_objective: str
    world_summary: str
    initial_tensions: list[str]
    channel_guidance: dict[VisibilityType, str]
    current_constraints: list[str]

    @model_validator(mode="after")
    def validate_situation_bundle(self) -> "SituationBundle":
        if not self.simulation_objective.strip():
            raise ValueError("simulation_objective must not be empty.")
        if not self.world_summary.strip():
            raise ValueError("world_summary must not be empty.")
        if not self.channel_guidance:
            raise ValueError("channel_guidance must not be empty.")
        return self


class CoordinationFrame(BaseModel):
    """Runtime coordination policy."""

    focus_policy: str
    background_policy: str
    max_focus_actors: int = Field(ge=1)

    @model_validator(mode="after")
    def validate_coordination_frame(self) -> "CoordinationFrame":
        for field_name in ("focus_policy", "background_policy"):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        return self


class ActionCatalogItem(BaseModel):
    """One broad action option."""

    action_type: str
    label: str
    description: str
    supported_visibility: list[VisibilityType]
    requires_target: bool

    @model_validator(mode="after")
    def validate_action_catalog_item(self) -> "ActionCatalogItem":
        if not self.action_type.strip():
            raise ValueError("action_type must not be empty.")
        if not self.label.strip():
            raise ValueError("label must not be empty.")
        if not self.description.strip():
            raise ValueError("description must not be empty.")
        if not self.supported_visibility:
            raise ValueError("supported_visibility must not be empty.")
        return self


class ActionCatalog(BaseModel):
    """Scenario-wide action catalog."""

    actions: list[ActionCatalogItem]

    @model_validator(mode="after")
    def validate_action_catalog(self) -> "ActionCatalog":
        if not self.actions:
            raise ValueError("actions must not be empty.")
        action_types = [item.action_type for item in self.actions]
        if len(action_types) != len(set(action_types)):
            raise ValueError("action_type values must be unique.")
        if len(action_types) > 5:
            raise ValueError("actions must contain at most 5 items.")
        return self


class CastRosterItem(BaseModel):
    """One cast roster item."""

    cast_id: str
    display_name: str
    role_hint: str
    group_name: str
    core_tension: str

    @model_validator(mode="after")
    def validate_cast_roster_item(self) -> "CastRosterItem":
        for field_name in (
            "cast_id",
            "display_name",
            "role_hint",
            "core_tension",
        ):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        return self


class CastRoster(BaseModel):
    """Compact required cast roster."""

    items: list[CastRosterItem]

    @model_validator(mode="after")
    def validate_cast_roster(self) -> "CastRoster":
        if not self.items:
            raise ValueError("items must not be empty.")
        cast_ids = [item.cast_id for item in self.items]
        display_names = [item.display_name for item in self.items]
        if len(cast_ids) != len(set(cast_ids)):
            raise ValueError("cast_id values must be unique.")
        if len(display_names) != len(set(display_names)):
            raise ValueError("display_name values must be unique.")
        return self


class CastRosterOutlineItem(BaseModel):
    """One compact cast-outline item."""

    slot_index: int = Field(ge=1)
    cast_id: str
    display_name: str

    @model_validator(mode="after")
    def validate_cast_roster_outline_item(self) -> "CastRosterOutlineItem":
        if not self.cast_id.strip():
            raise ValueError("cast_id must not be empty.")
        if not self.display_name.strip():
            raise ValueError("display_name must not be empty.")
        return self


class MajorEventPlanItem(BaseModel):
    """Scenario-grounded major event plan item."""

    event_id: str
    title: str
    summary: str
    participant_cast_ids: list[str]
    earliest_round: int = Field(ge=1)
    latest_round: int = Field(ge=1)
    completion_action_types: list[str]
    completion_signals: list[str]
    must_resolve: bool

    @model_validator(mode="after")
    def validate_major_event_plan_item(self) -> "MajorEventPlanItem":
        for field_name in ("event_id", "title", "summary"):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        if not self.participant_cast_ids:
            raise ValueError("participant_cast_ids must not be empty.")
        if not self.completion_action_types:
            raise ValueError("completion_action_types must not be empty.")
        if not self.completion_signals:
            raise ValueError("completion_signals must not be empty.")
        if len(self.participant_cast_ids) != len(set(self.participant_cast_ids)):
            raise ValueError("participant_cast_ids must be unique.")
        if len(self.completion_action_types) != len(set(self.completion_action_types)):
            raise ValueError("completion_action_types must be unique.")
        if self.earliest_round > self.latest_round:
            raise ValueError("earliest_round must be less than or equal to latest_round.")
        return self


class ExecutionPlanFrameBundle(BaseModel):
    """Execution-plan frame generated before cast chunk expansion."""

    situation: SituationBundle
    action_catalog: ActionCatalog
    coordination_frame: CoordinationFrame
    major_events: list[MajorEventPlanItem]

    @model_validator(mode="after")
    def validate_execution_plan_frame_bundle(self) -> "ExecutionPlanFrameBundle":
        event_ids = [item.event_id for item in self.major_events]
        if len(event_ids) != len(set(event_ids)):
            raise ValueError("major_events must use unique event_id values.")
        if len(self.major_events) > 6:
            raise ValueError("major_events must contain at most 6 items.")
        return self


class ExecutionPlanBundle(BaseModel):
    """Single execution-plan bundle."""

    situation: SituationBundle
    action_catalog: ActionCatalog
    coordination_frame: CoordinationFrame
    cast_roster: CastRoster
    major_events: list[MajorEventPlanItem]

    @model_validator(mode="after")
    def validate_execution_plan_bundle(self) -> "ExecutionPlanBundle":
        event_ids = [item.event_id for item in self.major_events]
        if len(event_ids) != len(set(event_ids)):
            raise ValueError("major_events must use unique event_id values.")
        if len(self.major_events) > 6:
            raise ValueError("major_events must contain at most 6 items.")
        return self
