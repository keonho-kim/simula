"""Purpose:
- Define the required structured contracts used across planning, runtime, and reporting.

Description:
- Keep LLM-facing schemas compact and required-only.
- Keep runtime/report payloads explicit and validation-friendly.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from simula.domain.time_units import TimeUnit

VisibilityType = Literal["public", "private", "group"]
SimulationMomentum = Literal["high", "medium", "low"]
AttentionTier = Literal["lead", "driver", "support", "background"]
PressureLevel = Literal["low", "medium", "high"]
MajorEventStatusType = Literal["pending", "in_progress", "completed", "missed"]
StopReason = Literal["", "no_progress", "simulation_done"]
ContinuationStopReason = Literal["", "no_progress"]
ResolutionStopReason = Literal["", "simulation_done"]


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

    max_rounds: int = Field(ge=1)
    allowed_elapsed_units: list[TimeUnit]
    default_elapsed_unit: TimeUnit
    pacing_guidance: list[str]
    selection_reason: str

    @model_validator(mode="after")
    def validate_progression_plan(self) -> "RuntimeProgressionPlan":
        if not self.allowed_elapsed_units:
            raise ValueError("allowed_elapsed_units must not be empty.")
        if len(self.allowed_elapsed_units) != len(set(self.allowed_elapsed_units)):
            raise ValueError("allowed_elapsed_units must be unique.")
        if self.default_elapsed_unit not in self.allowed_elapsed_units:
            raise ValueError("default_elapsed_unit must be included in allowed_elapsed_units.")
        if not self.selection_reason.strip():
            raise ValueError("selection_reason must not be empty.")
        return self


class RoundTimeAdvanceProposal(BaseModel):
    """Elapsed time chosen for one step."""

    elapsed_unit: TimeUnit
    elapsed_amount: int = Field(ge=1)
    selection_reason: str
    signals: list[str]

    @model_validator(mode="after")
    def validate_time_advance(self) -> "RoundTimeAdvanceProposal":
        if not self.selection_reason.strip():
            raise ValueError("selection_reason must not be empty.")
        return self


class RoundTimeAdvanceRecord(BaseModel):
    """Persisted normalized step-time record."""

    round_index: int = Field(ge=1)
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
    last_advanced_round_index: int = Field(ge=0)


class PlanningAnalysis(BaseModel):
    """Single required planning-analysis bundle."""

    brief_summary: str
    premise: str
    time_scope: ScenarioTimeScope
    public_context: list[str]
    private_context: list[str]
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


class CastRosterOutlineBundle(BaseModel):
    """Compact cast roster outline used before chunk expansion."""

    items: list[CastRosterOutlineItem]

    @model_validator(mode="after")
    def validate_cast_roster_outline_bundle(self) -> "CastRosterOutlineBundle":
        if not self.items:
            raise ValueError("items must not be empty.")
        slot_indexes = [item.slot_index for item in self.items]
        cast_ids = [item.cast_id for item in self.items]
        display_names = [item.display_name for item in self.items]
        if len(slot_indexes) != len(set(slot_indexes)):
            raise ValueError("slot_index values must be unique.")
        if len(cast_ids) != len(set(cast_ids)):
            raise ValueError("cast_id values must be unique.")
        if len(display_names) != len(set(display_names)):
            raise ValueError("display_name values must be unique.")
        return self


class ExecutionPlanFrameBundle(BaseModel):
    """Execution-plan frame generated before cast chunk expansion."""

    situation: SituationBundle
    action_catalog: ActionCatalog
    coordination_frame: CoordinationFrame
    major_events: list["MajorEventPlanItem"]

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
    major_events: list["MajorEventPlanItem"]

    @model_validator(mode="after")
    def validate_execution_plan_bundle(self) -> "ExecutionPlanBundle":
        event_ids = [item.event_id for item in self.major_events]
        if len(event_ids) != len(set(event_ids)):
            raise ValueError("major_events must use unique event_id values.")
        if len(self.major_events) > 6:
            raise ValueError("major_events must contain at most 6 items.")
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
    required_before_end: bool

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


class MajorEventUpdate(BaseModel):
    """One event-memory update proposed during round resolution."""

    event_id: str
    status: MajorEventStatusType
    progress_summary: str
    matched_activity_ids: list[str]

    @model_validator(mode="after")
    def validate_major_event_update(self) -> "MajorEventUpdate":
        for field_name in ("event_id", "progress_summary"):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        if len(self.matched_activity_ids) != len(set(self.matched_activity_ids)):
            raise ValueError("matched_activity_ids must be unique.")
        return self


class MajorEventState(BaseModel):
    """Runtime state for one planned major event."""

    event_id: str
    title: str
    summary: str
    participant_cast_ids: list[str]
    earliest_round: int = Field(ge=1)
    latest_round: int = Field(ge=1)
    completion_action_types: list[str]
    completion_signals: list[str]
    required_before_end: bool
    status: MajorEventStatusType
    progress_summary: str
    matched_activity_ids: list[str]
    last_evaluated_round: int = Field(ge=0)
    completed_round: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_major_event_state(self) -> "MajorEventState":
        for field_name in ("event_id", "title", "summary", "progress_summary"):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        if self.earliest_round > self.latest_round:
            raise ValueError("earliest_round must be less than or equal to latest_round.")
        if not self.participant_cast_ids:
            raise ValueError("participant_cast_ids must not be empty.")
        if not self.completion_action_types:
            raise ValueError("completion_action_types must not be empty.")
        if not self.completion_signals:
            raise ValueError("completion_signals must not be empty.")
        if len(self.participant_cast_ids) != len(set(self.participant_cast_ids)):
            raise ValueError("participant_cast_ids must be unique.")
        if len(self.matched_activity_ids) != len(set(self.matched_activity_ids)):
            raise ValueError("matched_activity_ids must be unique.")
        return self


class EventMemory(BaseModel):
    """Shared runtime memory for major-event tracking."""

    events: list[MajorEventState]
    next_event_ids: list[str]
    overdue_event_ids: list[str]
    completed_event_ids: list[str]
    missed_event_ids: list[str]
    endgame_gate_open: bool

    @model_validator(mode="after")
    def validate_event_memory(self) -> "EventMemory":
        event_ids = [item.event_id for item in self.events]
        if len(event_ids) != len(set(event_ids)):
            raise ValueError("events must use unique event_id values.")
        for field_name in (
            "next_event_ids",
            "overdue_event_ids",
            "completed_event_ids",
            "missed_event_ids",
        ):
            values = getattr(self, field_name)
            if len(values) != len(set(values)):
                raise ValueError(f"{field_name} must be unique.")
        return self


class ActorCard(BaseModel):
    """Runtime actor card."""

    cast_id: str
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


class GeneratedActorCardDraft(BaseModel):
    """LLM draft for one actor card without identity fields."""

    role: str
    public_profile: str
    private_goal: str
    speaking_style: str
    avatar_seed: str
    baseline_attention_tier: AttentionTier
    story_function: str
    preferred_action_types: list[str]
    action_bias_notes: list[str]

    @model_validator(mode="after")
    def validate_generated_actor_card_draft(self) -> "GeneratedActorCardDraft":
        for field_name in (
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
    intent_target_cast_ids: list[str]
    action_summary: str
    action_detail: str
    utterance: str
    visibility: VisibilityType
    target_cast_ids: list[str]
    thread_id: str

    @model_validator(mode="after")
    def validate_actor_action_proposal(self) -> "ActorActionProposal":
        for field_name in ("action_type", "intent", "action_summary", "action_detail"):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        if self.visibility == "group" and not self.target_cast_ids:
            raise ValueError("group proposals require target_cast_ids.")
        return self


class CanonicalAction(BaseModel):
    """Persisted canonical action."""

    activity_id: str
    run_id: str
    round_index: int
    source_cast_id: str
    visibility: VisibilityType
    target_cast_ids: list[str]
    visibility_scope: list[str]
    action_type: str
    intent: str
    intent_target_cast_ids: list[str]
    action_summary: str
    action_detail: str
    utterance: str
    thread_id: str
    created_at: str


class ActorIntentSnapshot(BaseModel):
    """Actor intent snapshot."""

    cast_id: str
    current_intent: str
    thought: str
    target_cast_ids: list[str]
    supporting_action_type: str
    confidence: float = Field(ge=0.0, le=1.0)
    changed_from_previous: bool

    @model_validator(mode="after")
    def validate_intent_snapshot(self) -> "ActorIntentSnapshot":
        for field_name in (
            "cast_id",
            "current_intent",
            "thought",
            "supporting_action_type",
        ):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        return self


class ActorIntentStateBatch(BaseModel):
    """Batch of intent snapshots."""

    actor_intent_states: list[ActorIntentSnapshot]

    @model_validator(mode="after")
    def validate_intent_batch(self) -> "ActorIntentStateBatch":
        cast_ids = [item.cast_id for item in self.actor_intent_states]
        if len(cast_ids) != len(set(cast_ids)):
            raise ValueError("actor_intent_states must use unique cast_id values.")
        return self


class FocusSlice(BaseModel):
    """Selected focus slice."""

    slice_id: str
    title: str
    focus_cast_ids: list[str]
    visibility: VisibilityType
    stakes: str
    selection_reason: str

    @model_validator(mode="after")
    def validate_focus_slice(self) -> "FocusSlice":
        if not self.slice_id.strip():
            raise ValueError("slice_id must not be empty.")
        if not self.title.strip():
            raise ValueError("title must not be empty.")
        if not self.focus_cast_ids:
            raise ValueError("focus_cast_ids must not be empty.")
        if not self.stakes.strip():
            raise ValueError("stakes must not be empty.")
        if not self.selection_reason.strip():
            raise ValueError("selection_reason must not be empty.")
        return self


class BackgroundUpdate(BaseModel):
    """Compressed off-screen update."""

    round_index: int = Field(ge=1)
    cast_id: str
    summary: str
    pressure_level: PressureLevel
    future_hook: str

    @model_validator(mode="after")
    def validate_background_update(self) -> "BackgroundUpdate":
        for field_name in ("cast_id", "summary", "future_hook"):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        return self


class BackgroundUpdateBatch(BaseModel):
    """Batch of background updates."""

    background_updates: list[BackgroundUpdate]


class ActorFacingScenarioDigest(BaseModel):
    """Actor-facing round digest for the next decision."""

    round_index: int = Field(ge=0)
    relationship_map_summary: str
    current_pressures: list[str]
    talking_points: list[str]
    avoid_repetition_notes: list[str]
    recommended_tone: str
    world_state_summary: str

    @model_validator(mode="after")
    def validate_actor_facing_scenario_digest(
        self,
    ) -> "ActorFacingScenarioDigest":
        for field_name in (
            "relationship_map_summary",
            "recommended_tone",
            "world_state_summary",
        ):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        for field_name in (
            "current_pressures",
            "talking_points",
            "avoid_repetition_notes",
        ):
            if not getattr(self, field_name):
                raise ValueError(f"{field_name} must not be empty.")
        return self


class RoundDirective(BaseModel):
    """Single runtime directive for a round."""

    round_index: int = Field(ge=1)
    focus_summary: str
    selection_reason: str
    selected_cast_ids: list[str]
    deferred_cast_ids: list[str]
    focus_slices: list[FocusSlice]
    background_updates: list[BackgroundUpdate]

    @model_validator(mode="after")
    def validate_round_directive(self) -> "RoundDirective":
        if not self.focus_summary.strip():
            raise ValueError("focus_summary must not be empty.")
        if not self.selection_reason.strip():
            raise ValueError("selection_reason must not be empty.")
        if len(self.selected_cast_ids) != len(set(self.selected_cast_ids)):
            raise ValueError("selected_cast_ids must be unique.")
        if len(self.deferred_cast_ids) != len(set(self.deferred_cast_ids)):
            raise ValueError("deferred_cast_ids must be unique.")
        selected_set = set(self.selected_cast_ids)
        for focus_slice in self.focus_slices:
            if not set(focus_slice.focus_cast_ids).issubset(selected_set):
                raise ValueError("focus_cast_ids must be contained in selected_cast_ids.")
        return self


class RoundContinuationDecision(BaseModel):
    """Decision about whether to continue into the next round."""

    stop_reason: ContinuationStopReason


class ObserverReport(BaseModel):
    """Observer round summary."""

    round_index: int = Field(ge=1)
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


class RoundResolution(BaseModel):
    """Single required runtime resolution bundle."""

    adopted_cast_ids: list[str]
    updated_intent_states: list[ActorIntentSnapshot]
    event_updates: list[MajorEventUpdate]
    round_time_advance: RoundTimeAdvanceProposal
    observer_report: ObserverReport
    actor_facing_scenario_digest: ActorFacingScenarioDigest
    world_state_summary: str
    stop_reason: ResolutionStopReason

    @model_validator(mode="after")
    def validate_round_resolution(self) -> "RoundResolution":
        if len(self.adopted_cast_ids) != len(set(self.adopted_cast_ids)):
            raise ValueError("adopted_cast_ids must be unique.")
        intent_state_cast_ids = [item.cast_id for item in self.updated_intent_states]
        if len(intent_state_cast_ids) != len(set(intent_state_cast_ids)):
            raise ValueError("updated_intent_states must use unique cast_id values.")
        event_ids = [item.event_id for item in self.event_updates]
        if len(event_ids) != len(set(event_ids)):
            raise ValueError("event_updates must use unique event_id values.")
        if not self.world_state_summary.strip():
            raise ValueError("world_state_summary must not be empty.")
        if (
            self.actor_facing_scenario_digest.world_state_summary
            != self.world_state_summary
        ):
            raise ValueError(
                "actor_facing_scenario_digest.world_state_summary must match world_state_summary."
            )
        return self


class LLMUsageSummary(BaseModel):
    """Run-scoped LLM usage summary."""

    total_calls: int
    calls_by_role: dict[str, int]
    calls_by_task: dict[str, int] = Field(default_factory=dict)
    structured_calls: int
    text_calls: int
    parse_failures: int
    forced_defaults: int
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None


class FinalReport(BaseModel):
    """Final aggregate report."""

    run_id: str
    scenario: str
    objective: str
    world_summary: str
    world_state_summary: str
    elapsed_simulation_minutes: int
    elapsed_simulation_label: str
    rounds_completed: int
    actor_count: int
    total_activities: int
    visibility_activity_counts: dict[str, int]
    last_observer_summary: str
    notable_events: list[str]
    errors: list[str]
    llm_usage_summary: LLMUsageSummary


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
