"""Purpose:
- Define the required structured contracts used across planning, runtime, and reporting.

Description:
- Keep LLM-facing schemas compact and required-only.
- Keep runtime/report payloads explicit and validation-friendly.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from simula.domain.time_steps import TimeUnit

VisibilityType = Literal["public", "private", "group"]
SimulationMomentum = Literal["high", "medium", "low"]
AttentionTier = Literal["lead", "driver", "support", "background"]
PressureLevel = Literal["low", "medium", "high"]


class ScenarioTimeScope(BaseModel):
    """Scenario time window."""

    start: str
    end: str

    @model_validator(mode="after")
    def validate_time_scope(self) -> "ScenarioTimeScope":
        if not self.start.strip():
            raise ValueError("start must not be empty.")
        if not self.end.strip():
            raise ValueError("end must not be empty.")
        return self


class RuntimeProgressionPlan(BaseModel):
    """Runtime pacing policy."""

    max_steps: int = Field(ge=1)
    allowed_units: list[TimeUnit]
    default_unit: TimeUnit
    pacing_guidance: list[str]
    selection_reason: str

    @model_validator(mode="after")
    def validate_progression_plan(self) -> "RuntimeProgressionPlan":
        if not self.allowed_units:
            raise ValueError("allowed_units must not be empty.")
        if len(self.allowed_units) != len(set(self.allowed_units)):
            raise ValueError("allowed_units must be unique.")
        if self.default_unit not in self.allowed_units:
            raise ValueError("default_unit must be included in allowed_units.")
        if not self.selection_reason.strip():
            raise ValueError("selection_reason must not be empty.")
        return self


class StepTimeAdvanceProposal(BaseModel):
    """Elapsed time chosen for one step."""

    elapsed_unit: TimeUnit
    elapsed_amount: int = Field(ge=1)
    selection_reason: str
    signals: list[str]

    @model_validator(mode="after")
    def validate_time_advance(self) -> "StepTimeAdvanceProposal":
        if not self.selection_reason.strip():
            raise ValueError("selection_reason must not be empty.")
        return self


class StepTimeAdvanceRecord(BaseModel):
    """Persisted normalized step-time record."""

    step_index: int = Field(ge=1)
    elapsed_unit: TimeUnit
    elapsed_amount: int = Field(ge=1)
    elapsed_minutes: int = Field(ge=1)
    elapsed_label: str
    total_elapsed_minutes: int = Field(ge=0)
    total_elapsed_label: str
    selection_reason: str
    signals: list[str]


class SimulationClockSnapshot(BaseModel):
    """Accumulated simulation clock snapshot."""

    total_elapsed_minutes: int = Field(ge=0)
    total_elapsed_label: str
    last_elapsed_minutes: int = Field(ge=0)
    last_elapsed_label: str
    last_advanced_step_index: int = Field(ge=0)


class PlanningAnalysis(BaseModel):
    """Single required planning-analysis bundle."""

    brief_summary: str
    premise: str
    time_scope: ScenarioTimeScope
    public_context: list[str]
    private_context: list[str]
    key_pressures: list[str]
    observation_points: list[str]
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
    """Runtime coordination rules."""

    focus_selection_rules: list[str]
    background_motion_rules: list[str]
    focus_archetypes: list[str]
    attention_shift_rules: list[str]
    budget_guidance: list[str]

    @model_validator(mode="after")
    def validate_coordination_frame(self) -> "CoordinationFrame":
        for field_name in (
            "focus_selection_rules",
            "background_motion_rules",
            "focus_archetypes",
            "attention_shift_rules",
            "budget_guidance",
        ):
            if not getattr(self, field_name):
                raise ValueError(f"{field_name} must not be empty.")
        return self


class ActionCatalogItem(BaseModel):
    """One broad action option."""

    action_type: str
    label: str
    description: str
    supported_visibility: list[VisibilityType]
    requires_target: bool
    supports_utterance: bool

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
    selection_guidance: list[str]

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


class ExecutionPlanBundle(BaseModel):
    """Single execution-plan bundle."""

    situation: SituationBundle
    action_catalog: ActionCatalog
    coordination_frame: CoordinationFrame
    cast_roster: CastRoster


class ActorCard(BaseModel):
    """Runtime actor card."""

    cast_id: str
    actor_id: str
    display_name: str
    role: str
    group_name: str
    public_profile: str
    private_goal: str
    speaking_style: str
    avatar_seed: str
    baseline_attention_tier: AttentionTier
    story_function: str
    preferred_action_types: list[str]
    action_bias_notes: list[str]

    @model_validator(mode="after")
    def validate_actor_card(self) -> "ActorCard":
        for field_name in (
            "cast_id",
            "actor_id",
            "display_name",
            "role",
            "public_profile",
            "private_goal",
            "speaking_style",
            "avatar_seed",
            "story_function",
        ):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        return self


class ActorActionProposal(BaseModel):
    """One actor proposal for one step."""

    action_type: str
    intent: str
    intent_target_actor_ids: list[str]
    action_summary: str
    action_detail: str
    utterance: str
    visibility: VisibilityType
    target_actor_ids: list[str]
    thread_id: str

    @model_validator(mode="after")
    def validate_actor_action_proposal(self) -> "ActorActionProposal":
        for field_name in ("action_type", "intent", "action_summary", "action_detail"):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        if self.visibility in {"private", "group"} and not self.target_actor_ids:
            raise ValueError("private/group proposals require target_actor_ids.")
        return self


class CanonicalAction(BaseModel):
    """Persisted canonical action."""

    activity_id: str
    run_id: str
    step_index: int
    source_actor_id: str
    visibility: VisibilityType
    target_actor_ids: list[str]
    visibility_scope: list[str]
    action_type: str
    intent: str
    intent_target_actor_ids: list[str]
    action_summary: str
    action_detail: str
    utterance: str
    thread_id: str
    created_at: str


class ActorIntentSnapshot(BaseModel):
    """Actor intent snapshot."""

    actor_id: str
    current_intent: str
    target_actor_ids: list[str]
    supporting_action_type: str
    confidence: float = Field(ge=0.0, le=1.0)
    changed_from_previous: bool

    @model_validator(mode="after")
    def validate_intent_snapshot(self) -> "ActorIntentSnapshot":
        for field_name in ("actor_id", "current_intent", "supporting_action_type"):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        return self


class ActorIntentStateBatch(BaseModel):
    """Batch of intent snapshots."""

    actor_intent_states: list[ActorIntentSnapshot]

    @model_validator(mode="after")
    def validate_intent_batch(self) -> "ActorIntentStateBatch":
        actor_ids = [item.actor_id for item in self.actor_intent_states]
        if len(actor_ids) != len(set(actor_ids)):
            raise ValueError("actor_intent_states must use unique actor_id values.")
        return self


class FocusSlice(BaseModel):
    """Selected focus slice."""

    slice_id: str
    title: str
    focus_actor_ids: list[str]
    visibility: VisibilityType
    stakes: str
    selection_reason: str

    @model_validator(mode="after")
    def validate_focus_slice(self) -> "FocusSlice":
        if not self.slice_id.strip():
            raise ValueError("slice_id must not be empty.")
        if not self.title.strip():
            raise ValueError("title must not be empty.")
        if not self.focus_actor_ids:
            raise ValueError("focus_actor_ids must not be empty.")
        if not self.stakes.strip():
            raise ValueError("stakes must not be empty.")
        if not self.selection_reason.strip():
            raise ValueError("selection_reason must not be empty.")
        return self


class BackgroundUpdate(BaseModel):
    """Compressed off-screen update."""

    step_index: int = Field(ge=1)
    actor_id: str
    summary: str
    pressure_level: PressureLevel
    future_hook: str

    @model_validator(mode="after")
    def validate_background_update(self) -> "BackgroundUpdate":
        for field_name in ("actor_id", "summary", "future_hook"):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        return self


class BackgroundUpdateBatch(BaseModel):
    """Batch of background updates."""

    background_updates: list[BackgroundUpdate]


class StepDirective(BaseModel):
    """Single runtime directive for a step."""

    step_index: int = Field(ge=1)
    focus_summary: str
    selection_reason: str
    selected_actor_ids: list[str]
    deferred_actor_ids: list[str]
    focus_slices: list[FocusSlice]
    background_updates: list[BackgroundUpdate]

    @model_validator(mode="after")
    def validate_step_directive(self) -> "StepDirective":
        if not self.focus_summary.strip():
            raise ValueError("focus_summary must not be empty.")
        if not self.selection_reason.strip():
            raise ValueError("selection_reason must not be empty.")
        if len(self.selected_actor_ids) != len(set(self.selected_actor_ids)):
            raise ValueError("selected_actor_ids must be unique.")
        if len(self.deferred_actor_ids) != len(set(self.deferred_actor_ids)):
            raise ValueError("deferred_actor_ids must be unique.")
        selected_set = set(self.selected_actor_ids)
        for focus_slice in self.focus_slices:
            if not set(focus_slice.focus_actor_ids).issubset(selected_set):
                raise ValueError("focus_actor_ids must be contained in selected_actor_ids.")
        return self


class ObserverReport(BaseModel):
    """Observer step summary."""

    step_index: int = Field(ge=1)
    summary: str
    notable_events: list[str]
    atmosphere: str
    momentum: SimulationMomentum
    world_state_summary: str

    @model_validator(mode="after")
    def validate_observer_report(self) -> "ObserverReport":
        for field_name in ("summary", "atmosphere", "world_state_summary"):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        return self


class StepResolution(BaseModel):
    """Single required runtime resolution bundle."""

    adopted_actor_ids: list[str]
    updated_intent_states: list[ActorIntentSnapshot]
    step_time_advance: StepTimeAdvanceProposal
    observer_report: ObserverReport
    world_state_summary: str
    stop_reason: str

    @model_validator(mode="after")
    def validate_step_resolution(self) -> "StepResolution":
        if len(self.adopted_actor_ids) != len(set(self.adopted_actor_ids)):
            raise ValueError("adopted_actor_ids must be unique.")
        if not self.world_state_summary.strip():
            raise ValueError("world_state_summary must not be empty.")
        return self


class FinalReport(BaseModel):
    """Final aggregate report."""

    run_id: str
    scenario: str
    objective: str
    world_summary: str
    world_state_summary: str
    elapsed_simulation_minutes: int
    elapsed_simulation_label: str
    steps_completed: int
    actor_count: int
    total_activities: int
    visibility_activity_counts: dict[str, int]
    last_observer_summary: str
    notable_events: list[str]
    errors: list[str]


class TimelineAnchorDecision(BaseModel):
    """Absolute timeline anchor."""

    anchor_iso: str
    selection_reason: str

    @model_validator(mode="after")
    def validate_timeline_anchor(self) -> "TimelineAnchorDecision":
        if not self.anchor_iso.strip():
            raise ValueError("anchor_iso must not be empty.")
        if not self.selection_reason.strip():
            raise ValueError("selection_reason must not be empty.")
        return self


class FinalReportSections(BaseModel):
    """Single final-report writing bundle."""

    conclusion_section: str
    actor_results_rows: str
    timeline_section: str
    actor_dynamics_section: str
    major_events_section: str

    @model_validator(mode="after")
    def validate_final_report_sections(self) -> "FinalReportSections":
        for field_name in (
            "conclusion_section",
            "actor_results_rows",
            "timeline_section",
            "actor_dynamics_section",
            "major_events_section",
        ):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        return self
