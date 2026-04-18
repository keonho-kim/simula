"""Runtime and coordinator contracts."""

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from simula.domain.contracts.shared import (
    MajorEventStatusType,
    PressureLevel,
    ResolutionStopReason,
    RoundTimeAdvanceProposal,
    SimulationMomentum,
    VisibilityType,
)


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
    must_resolve: bool
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


class ActorActionProposal(BaseModel):
    """One actor proposal for one step."""

    action_type: str
    goal: str
    summary: str
    detail: str
    utterance: str
    visibility: VisibilityType
    target_cast_ids: list[str]

    @model_validator(mode="after")
    def validate_actor_action_proposal(self) -> "ActorActionProposal":
        for field_name in ("action_type", "goal", "summary", "detail"):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        if self.visibility == "group" and not self.target_cast_ids:
            raise ValueError("group proposals require target_cast_ids.")
        return self


class ActorActionShell(BaseModel):
    """Action shell chosen before narrative details are filled."""

    action_type: str
    visibility: VisibilityType
    target_cast_ids: list[str]

    @model_validator(mode="after")
    def validate_actor_action_shell(self) -> "ActorActionShell":
        if not self.action_type.strip():
            raise ValueError("action_type must not be empty.")
        if self.visibility == "group" and not self.target_cast_ids:
            raise ValueError("group proposals require target_cast_ids.")
        return self


class ActorActionNarrative(BaseModel):
    """Narrative fields filled after the action shell is fixed."""

    goal: str
    summary: str
    detail: str
    utterance: str

    @model_validator(mode="after")
    def validate_actor_action_narrative(self) -> "ActorActionNarrative":
        for field_name in ("goal", "summary", "detail"):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
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
    goal: str
    summary: str
    detail: str
    utterance: str
    thread_id: str
    created_at: str


class ActorIntentSnapshot(BaseModel):
    """Actor intent snapshot."""

    cast_id: str
    goal: str
    target_cast_ids: list[str]
    confidence: float = Field(ge=0.0, le=1.0)
    changed_from_previous: bool

    @model_validator(mode="after")
    def validate_intent_snapshot(self) -> "ActorIntentSnapshot":
        for field_name in ("cast_id", "goal"):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        return self


class FocusSlice(BaseModel):
    """Selected focus slice."""

    slice_id: str
    title: str
    focus_cast_ids: list[str]
    visibility: VisibilityType
    stakes: str
    reason: str

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
        if not self.reason.strip():
            raise ValueError("reason must not be empty.")
        return self


class BackgroundUpdate(BaseModel):
    """Compressed off-screen update."""

    round_index: int = Field(ge=1)
    cast_id: str
    summary: str
    pressure_level: PressureLevel

    @model_validator(mode="after")
    def validate_background_update(self) -> "BackgroundUpdate":
        for field_name in ("cast_id", "summary"):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        return self


class RoundDirectiveFocusCore(BaseModel):
    """Focus-only portion of a round directive."""

    focus_summary: str
    reason: str
    focus_slices: list[FocusSlice]

    @model_validator(mode="after")
    def validate_round_directive_focus_core(self) -> "RoundDirectiveFocusCore":
        if not self.focus_summary.strip():
            raise ValueError("focus_summary must not be empty.")
        if not self.reason.strip():
            raise ValueError("reason must not be empty.")
        return self


class ActorFacingScenarioDigest(BaseModel):
    """Actor-facing round digest for the next decision."""

    round_index: int = Field(ge=0)
    current_pressures: list[str]
    next_step_notes: list[str]
    world_state_summary: str

    @model_validator(mode="after")
    def validate_actor_facing_scenario_digest(
        self,
    ) -> "ActorFacingScenarioDigest":
        for field_name in ("world_state_summary",):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        for field_name in ("current_pressures", "next_step_notes"):
            if not getattr(self, field_name):
                raise ValueError(f"{field_name} must not be empty.")
        return self


class ActorFacingScenarioDigestBody(BaseModel):
    """Round-digest body before round/world injection."""

    current_pressures: list[str]
    next_step_notes: list[str]

    @model_validator(mode="after")
    def validate_actor_facing_scenario_digest_body(
        self,
    ) -> "ActorFacingScenarioDigestBody":
        for field_name in ("current_pressures", "next_step_notes"):
            if not getattr(self, field_name):
                raise ValueError(f"{field_name} must not be empty.")
        return self


class RoundDirective(BaseModel):
    """Single runtime directive for a round."""

    round_index: int = Field(ge=1)
    focus_summary: str
    reason: str
    selected_cast_ids: list[str]
    deferred_cast_ids: list[str]
    focus_slices: list[FocusSlice]
    background_updates: list[BackgroundUpdate]

    @model_validator(mode="after")
    def validate_round_directive(self) -> "RoundDirective":
        if not self.focus_summary.strip():
            raise ValueError("focus_summary must not be empty.")
        if not self.reason.strip():
            raise ValueError("reason must not be empty.")
        if len(self.selected_cast_ids) != len(set(self.selected_cast_ids)):
            raise ValueError("selected_cast_ids must be unique.")
        if len(self.deferred_cast_ids) != len(set(self.deferred_cast_ids)):
            raise ValueError("deferred_cast_ids must be unique.")
        selected_set = set(self.selected_cast_ids)
        for focus_slice in self.focus_slices:
            if not set(focus_slice.focus_cast_ids).issubset(selected_set):
                raise ValueError("focus_cast_ids must be contained in selected_cast_ids.")
        return self


class ObserverReportBody(BaseModel):
    """Observer-report body before round/world injection."""

    summary: str
    notable_events: list[str]
    atmosphere: str
    momentum: SimulationMomentum

    @model_validator(mode="after")
    def validate_observer_report_body(self) -> "ObserverReportBody":
        for field_name in ("summary", "atmosphere"):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        return self


class RoundResolutionNarrativeBodies(BaseModel):
    """Narrative-only portion of round resolution."""

    observer_report: ObserverReportBody
    actor_facing_scenario_digest: ActorFacingScenarioDigestBody


class RoundResolutionCore(BaseModel):
    """Core non-narrative portion of round resolution."""

    adopted_cast_ids: list[str]
    time_advance: RoundTimeAdvanceProposal
    world_state_summary: str
    stop_reason: ResolutionStopReason

    @model_validator(mode="after")
    def validate_round_resolution_core(self) -> "RoundResolutionCore":
        if len(self.adopted_cast_ids) != len(set(self.adopted_cast_ids)):
            raise ValueError("adopted_cast_ids must be unique.")
        if not self.world_state_summary.strip():
            raise ValueError("world_state_summary must not be empty.")
        return self


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
    intent_states: list[ActorIntentSnapshot]
    event_updates: list[MajorEventUpdate]
    time_advance: RoundTimeAdvanceProposal
    observer_report: ObserverReport
    actor_facing_scenario_digest: ActorFacingScenarioDigest
    world_state_summary: str
    stop_reason: ResolutionStopReason

    @model_validator(mode="after")
    def validate_round_resolution(self) -> "RoundResolution":
        if len(self.adopted_cast_ids) != len(set(self.adopted_cast_ids)):
            raise ValueError("adopted_cast_ids must be unique.")
        intent_state_cast_ids = [item.cast_id for item in self.intent_states]
        if len(intent_state_cast_ids) != len(set(intent_state_cast_ids)):
            raise ValueError("intent_states must use unique cast_id values.")
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
