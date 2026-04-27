"""Runtime and coordinator contracts."""

from __future__ import annotations

from pydantic import BaseModel, Field, model_validator

from simula.domain.contracts.shared import (
    MajorEventStatusType,
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
            raise ValueError(
                "earliest_round must be less than or equal to latest_round."
            )
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


class SymbolTable(BaseModel):
    """Compact runtime symbols for prompt input."""

    actors: dict[str, str]
    events: dict[str, str]
    actions: dict[str, str]

    @model_validator(mode="after")
    def validate_symbol_table(self) -> "SymbolTable":
        for field_name in ("actors", "events", "actions"):
            values = list(getattr(self, field_name).values())
            if len(values) != len(set(values)):
                raise ValueError(f"{field_name} symbols must be unique.")
        return self


class ActorPolicy(BaseModel):
    """Runtime-facing actor policy."""

    cast_id: str
    symbol: str
    priorities: list[str]
    preferred_target_cast_ids: list[str]
    allowed_action_types: list[str]
    trigger_rules: list[str]
    current_intent: str
    relationship_notes: dict[str, str]
    recent_memory: list[str]
    pressure_level: int = Field(ge=0, le=5)
    hidden_information: list[str]
    speech_cooldown: int = Field(ge=0)
    action_cooldown: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_actor_policy(self) -> "ActorPolicy":
        for field_name in ("cast_id", "symbol", "current_intent"):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        if not self.priorities:
            raise ValueError("priorities must not be empty.")
        if not self.allowed_action_types:
            raise ValueError("allowed_action_types must not be empty.")
        if not self.trigger_rules:
            raise ValueError("trigger_rules must not be empty.")
        return self


class ActorAgentState(BaseModel):
    """Mutable runtime state for one simulated actor."""

    cast_id: str
    current_intent: str
    relationship_notes: dict[str, str]
    recent_memory: list[str]
    pressure_level: int = Field(ge=0, le=5)
    hidden_information: list[str]
    speech_cooldown: int = Field(ge=0)
    action_cooldown: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_actor_agent_state(self) -> "ActorAgentState":
        for field_name in ("cast_id", "current_intent"):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        return self


class EventQueueItem(BaseModel):
    """One deterministic runtime event-queue entry."""

    event_id: str
    symbol: str
    title: str
    status: MajorEventStatusType
    participant_cast_ids: list[str]
    must_resolve: bool
    earliest_round: int = Field(ge=1)
    latest_round: int = Field(ge=1)

    @model_validator(mode="after")
    def validate_event_queue_item(self) -> "EventQueueItem":
        for field_name in ("event_id", "symbol", "title"):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        if not self.participant_cast_ids:
            raise ValueError("participant_cast_ids must not be empty.")
        if self.earliest_round > self.latest_round:
            raise ValueError(
                "earliest_round must be less than or equal to latest_round."
            )
        return self


class ActionTemplate(BaseModel):
    """One compact action template for candidate generation."""

    action_type: str
    symbol: str
    label: str
    description: str
    supported_visibility: list[VisibilityType]
    requires_target: bool

    @model_validator(mode="after")
    def validate_action_template(self) -> "ActionTemplate":
        for field_name in ("action_type", "symbol", "label", "description"):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        if not self.supported_visibility:
            raise ValueError("supported_visibility must not be empty.")
        return self


class RuntimeBudget(BaseModel):
    """Runtime-mode limits used by the scene kernel."""

    max_scene_actors: int = Field(ge=1)
    max_candidates: int = Field(ge=1)
    max_scene_beats: int = Field(ge=1)
    runtime_narrative: bool


class SimulationPlan(BaseModel):
    """Runtime-ready plan consumed by the current runtime graph."""

    symbol_table: SymbolTable
    actor_policies: list[ActorPolicy]
    event_queue: list[EventQueueItem]
    action_templates: list[ActionTemplate]
    runtime_budget: RuntimeBudget

    @model_validator(mode="after")
    def validate_simulation_plan(self) -> "SimulationPlan":
        cast_ids = [item.cast_id for item in self.actor_policies]
        if len(cast_ids) != len(set(cast_ids)):
            raise ValueError("actor_policies must use unique cast_id values.")
        event_ids = [item.event_id for item in self.event_queue]
        if len(event_ids) != len(set(event_ids)):
            raise ValueError("event_queue must use unique event_id values.")
        action_types = [item.action_type for item in self.action_templates]
        if len(action_types) != len(set(action_types)):
            raise ValueError("action_templates must use unique action_type values.")
        return self


class ActionCandidate(BaseModel):
    """Code-generated scene action candidate."""

    candidate_id: str
    event_id: str
    source_cast_id: str
    target_cast_ids: list[str]
    action_type: str
    visibility: VisibilityType
    goal: str
    summary: str
    detail: str
    utterance: str = ""
    intent: str
    stakes: str
    expected_effect: str
    risk: str
    target_reason: str
    initiative_score: int

    @model_validator(mode="after")
    def validate_action_candidate(self) -> "ActionCandidate":
        for field_name in (
            "candidate_id",
            "event_id",
            "source_cast_id",
            "action_type",
            "goal",
            "summary",
            "detail",
            "intent",
            "stakes",
            "expected_effect",
            "risk",
            "target_reason",
        ):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        return self


class SceneBeat(BaseModel):
    """One dramatized beat inside a scene tick."""

    beat_id: str
    candidate_id: str
    source_cast_id: str
    target_cast_ids: list[str]
    intent: str
    action_type: str
    summary: str
    detail: str
    utterance: str
    reaction: str
    emotional_tone: str
    event_effect: str

    @model_validator(mode="after")
    def validate_scene_beat(self) -> "SceneBeat":
        for field_name in (
            "beat_id",
            "candidate_id",
            "source_cast_id",
            "intent",
            "action_type",
            "summary",
            "detail",
            "reaction",
            "emotional_tone",
            "event_effect",
        ):
            if not getattr(self, field_name).strip():
                raise ValueError(f"{field_name} must not be empty.")
        if len(self.target_cast_ids) != len(set(self.target_cast_ids)):
            raise ValueError("target_cast_ids must be unique.")
        return self


class SceneDelta(BaseModel):
    """Single LLM output for one current-runtime scene tick."""

    selected_event_id: str
    scene_beats: list[SceneBeat]
    intent_updates: list[ActorIntentSnapshot]
    event_updates: list[MajorEventUpdate]
    world_state_summary: str
    time_advance: RoundTimeAdvanceProposal
    stop_reason: ResolutionStopReason
    debug_rationale: str

    @model_validator(mode="after")
    def validate_scene_delta(self) -> "SceneDelta":
        if not self.selected_event_id.strip():
            raise ValueError("selected_event_id must not be empty.")
        if not self.scene_beats:
            raise ValueError("scene_beats must not be empty.")
        beat_ids = [item.beat_id for item in self.scene_beats]
        if len(beat_ids) != len(set(beat_ids)):
            raise ValueError("scene_beats must use unique beat_id values.")
        candidate_ids = [item.candidate_id for item in self.scene_beats]
        if len(candidate_ids) != len(set(candidate_ids)):
            raise ValueError("scene_beats must use unique candidate_id values.")
        intent_cast_ids = [item.cast_id for item in self.intent_updates]
        if len(intent_cast_ids) != len(set(intent_cast_ids)):
            raise ValueError("intent_updates must use unique cast_id values.")
        event_ids = [item.event_id for item in self.event_updates]
        if len(event_ids) != len(set(event_ids)):
            raise ValueError("event_updates must use unique event_id values.")
        if not self.world_state_summary.strip():
            raise ValueError("world_state_summary must not be empty.")
        if not self.debug_rationale.strip():
            raise ValueError("debug_rationale must not be empty.")
        return self


class CanonicalAction(BaseModel):
    """Persisted canonical action."""

    activity_id: str
    beat_id: str = ""
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
    reaction: str = ""
    emotional_tone: str = ""
    event_effect: str = ""
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
