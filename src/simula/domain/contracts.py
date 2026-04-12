"""목적:
- 런타임의 구조화 출력 계약을 정의한다.

설명:
- Planner 3단계 출력, Actor Generator, Actor Proposal, Observer, Final Report의 JSON 스키마를 고정한다.

사용한 설계 패턴:
- Pydantic 계약 모델 패턴

연관된 다른 모듈/구조:
- simula.application.workflow.graphs
- simula.infrastructure.llm.router
"""

from __future__ import annotations

from typing import Literal, cast

from pydantic import BaseModel, Field, model_validator

from simula.domain.time_steps import TimeUnit

VisibilityType = Literal["public", "private", "group"]
SimulationMomentum = Literal["high", "medium", "low"]
AttentionTier = Literal["lead", "driver", "support", "background"]
PressureLevel = Literal["low", "medium", "high"]


class ScenarioTimeScope(BaseModel):
    """시나리오 시간 범위 해석이다."""

    start: str
    end: str


class RuntimeProgressionPlan(BaseModel):
    """Planner가 제안하는 실행 시간 진행 계획이다."""

    max_steps: int = Field(ge=1)
    allowed_units: list[TimeUnit] = Field(default_factory=list)
    default_unit: TimeUnit
    pacing_guidance: list[str] = Field(default_factory=list)
    selection_reason: str

    @model_validator(mode="after")
    def validate_progression_plan(self) -> "RuntimeProgressionPlan":
        """허용 단위와 기본 단위 정합성을 검증한다."""

        if not self.allowed_units:
            raise ValueError("allowed_units는 최소 1개 이상 필요합니다.")
        if len(self.allowed_units) != len(set(self.allowed_units)):
            raise ValueError("allowed_units에 중복 단위를 허용하지 않습니다.")
        if self.default_unit not in self.allowed_units:
            raise ValueError("default_unit은 allowed_units 안에 있어야 합니다.")
        return self


class StepTimeAdvanceProposal(BaseModel):
    """한 step의 경과 시간을 해석한 결과다."""

    elapsed_unit: TimeUnit
    elapsed_amount: int = Field(ge=1)
    selection_reason: str
    signals: list[str] = Field(default_factory=list)


class StepTimeAdvanceRecord(BaseModel):
    """저장 및 보고용으로 정규화한 step 시간 기록이다."""

    step_index: int = Field(ge=1)
    elapsed_unit: TimeUnit
    elapsed_amount: int = Field(ge=1)
    elapsed_minutes: int = Field(ge=30)
    elapsed_label: str
    total_elapsed_minutes: int = Field(ge=30)
    total_elapsed_label: str
    selection_reason: str
    signals: list[str] = Field(default_factory=list)


class SimulationClockSnapshot(BaseModel):
    """현재 시뮬레이션 누적 시간 상태다."""

    total_elapsed_minutes: int = Field(ge=0)
    total_elapsed_label: str
    last_elapsed_minutes: int = Field(ge=0)
    last_elapsed_label: str
    last_advanced_step_index: int = Field(ge=0)


class ScenarioInterpretation(BaseModel):
    """시나리오 1차 해석 결과다."""

    premise: str
    time_scope: ScenarioTimeScope
    public_context: list[str]
    private_context: list[str]
    key_pressures: list[str]
    observation_points: list[str]


class SituationBundle(BaseModel):
    """실행용 상황 번들이다."""

    simulation_objective: str
    world_summary: str
    initial_tensions: list[str]
    channel_guidance: dict[VisibilityType, str]
    current_constraints: list[str]


class CoordinationFrame(BaseModel):
    """Planner가 만드는 step 조율 기준 프레임이다."""

    focus_selection_rules: list[str] = Field(default_factory=list)
    background_motion_rules: list[str] = Field(default_factory=list)
    focus_archetypes: list[str] = Field(default_factory=list)
    attention_shift_rules: list[str] = Field(default_factory=list)
    budget_guidance: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_coordination_frame(self) -> "CoordinationFrame":
        """조율 프레임 각 항목이 최소 1개 이상 있는지 검증한다."""

        for field_name in (
            "focus_selection_rules",
            "background_motion_rules",
            "focus_archetypes",
            "attention_shift_rules",
            "budget_guidance",
        ):
            if not getattr(self, field_name):
                raise ValueError(f"{field_name}는 최소 1개 이상 필요합니다.")
        return self


class ActionCatalogItem(BaseModel):
    """시나리오 전역 액션 카탈로그 항목이다."""

    action_type: str
    label: str
    description: str
    role_hints: list[str] = Field(default_factory=list)
    group_hints: list[str] = Field(default_factory=list)
    supported_visibility: list[VisibilityType] = Field(default_factory=list)
    requires_target: bool = False
    supports_utterance: bool = False
    examples_or_usage_notes: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_action_catalog_item(self) -> "ActionCatalogItem":
        """액션 카탈로그 항목 필수 필드를 검증한다."""

        if not self.action_type.strip():
            raise ValueError("action_type은 비어 있을 수 없습니다.")
        if not self.label.strip():
            raise ValueError("label은 비어 있을 수 없습니다.")
        if not self.description.strip():
            raise ValueError("description은 비어 있을 수 없습니다.")
        if not self.supported_visibility:
            raise ValueError("supported_visibility는 최소 1개 이상 필요합니다.")
        return self


class ActionCatalog(BaseModel):
    """시나리오 전역 액션 카탈로그다."""

    actions: list[ActionCatalogItem]
    selection_guidance: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_action_catalog(self) -> "ActionCatalog":
        """action_type 중복을 허용하지 않는다."""

        action_types = [item.action_type for item in self.actions]
        if not action_types:
            raise ValueError("actions는 최소 1개 이상 필요합니다.")
        if len(action_types) != len(set(action_types)):
            raise ValueError("action catalog에 중복 action_type을 허용하지 않습니다.")
        return self


class CastRosterItem(BaseModel):
    """고유 등장인물 roster item이다."""

    cast_id: str
    display_name: str
    role_hint: str
    group_name: str | None = None
    core_tension: str


class ActorCard(BaseModel):
    """실행 중인 actor의 최소 표현이다."""

    cast_id: str
    actor_id: str
    display_name: str
    role: str
    group_name: str | None = None
    public_profile: str
    private_goal: str
    speaking_style: str
    avatar_seed: str
    baseline_attention_tier: AttentionTier
    story_function: str
    preferred_action_types: list[str] = Field(default_factory=list)
    action_bias_notes: list[str] = Field(default_factory=list)


class ActorActionProposal(BaseModel):
    """Actor 한 명의 한 단계 자유행동 제안이다."""

    action_type: str
    intent: str
    intent_target_actor_ids: list[str] = Field(default_factory=list)
    action_summary: str
    action_detail: str
    utterance: str | None = None
    visibility: VisibilityType = "private"
    target_actor_ids: list[str] = Field(default_factory=list)
    thread_id: str | None = None
    expected_outcome: str | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_optional_utterance(cls, value: object) -> object:
        """빈 utterance 문자열을 None으로 정규화한다."""

        if not isinstance(value, dict):
            return value
        payload = cast(dict[str, object], value)
        raw_utterance = payload.get("utterance")
        if isinstance(raw_utterance, str) and not raw_utterance.strip():
            return {
                **payload,
                "utterance": None,
            }
        return value

    @model_validator(mode="after")
    def validate_proposal(self) -> "ActorActionProposal":
        """visibility별 target 요구사항을 검증한다."""

        if self.visibility in {"private", "group"} and not self.target_actor_ids:
            raise ValueError("private/group 활동은 target_actor_ids가 필요합니다.")
        if not self.action_type.strip():
            raise ValueError("활동 제안은 action_type이 필요합니다.")
        if not self.intent.strip():
            raise ValueError("활동 제안은 intent가 필요합니다.")
        if not self.action_summary.strip():
            raise ValueError("활동 제안은 action_summary가 필요합니다.")
        if not self.action_detail.strip():
            raise ValueError("활동 제안은 action_detail이 필요합니다.")
        if self.utterance is not None and not self.utterance.strip():
            raise ValueError("utterance가 있으면 비어 있을 수 없습니다.")
        return self


class CanonicalAction(BaseModel):
    """실제 저장되는 canonical action이다."""

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
    utterance: str | None = None
    expected_outcome: str | None = None
    thread_id: str | None = None
    created_at: str


class ActorIntentSnapshot(BaseModel):
    """actor의 현재 의도 snapshot이다."""

    actor_id: str
    current_intent: str
    target_actor_ids: list[str] = Field(default_factory=list)
    supporting_action_type: str
    confidence: float = Field(ge=0.0, le=1.0)
    changed_from_previous: bool = False

    @model_validator(mode="after")
    def validate_intent_snapshot(self) -> "ActorIntentSnapshot":
        """의도 snapshot 필수 필드를 검증한다."""

        if not self.actor_id.strip():
            raise ValueError("actor_id는 비어 있을 수 없습니다.")
        if not self.current_intent.strip():
            raise ValueError("current_intent는 비어 있을 수 없습니다.")
        if not self.supporting_action_type.strip():
            raise ValueError("supporting_action_type은 비어 있을 수 없습니다.")
        return self


class ActorIntentStateBatch(BaseModel):
    """step 종료 후 actor intent snapshot 묶음이다."""

    actor_intent_states: list[ActorIntentSnapshot]

    @model_validator(mode="after")
    def validate_intent_batch(self) -> "ActorIntentStateBatch":
        """배치 내 actor_id 중복을 허용하지 않는다."""

        actor_ids = [item.actor_id for item in self.actor_intent_states]
        if len(actor_ids) != len(set(actor_ids)):
            raise ValueError(
                "actor intent snapshot에 중복 actor_id를 허용하지 않습니다."
            )
        return self


class FocusSlice(BaseModel):
    """한 step 안에서 coordinator가 선택한 focus slice다."""

    slice_id: str
    title: str
    focus_actor_ids: list[str]
    visibility: VisibilityType
    stakes: str
    selection_reason: str

    @model_validator(mode="after")
    def validate_focus_slice(self) -> "FocusSlice":
        """focus slice 핵심 필드를 검증한다."""

        if not self.slice_id.strip():
            raise ValueError("slice_id는 비어 있을 수 없습니다.")
        if not self.title.strip():
            raise ValueError("title은 비어 있을 수 없습니다.")
        if not self.focus_actor_ids:
            raise ValueError("focus_actor_ids는 최소 1명 이상 필요합니다.")
        if not self.stakes.strip():
            raise ValueError("stakes는 비어 있을 수 없습니다.")
        if not self.selection_reason.strip():
            raise ValueError("selection_reason은 비어 있을 수 없습니다.")
        return self


class StepFocusPlan(BaseModel):
    """Coordinator가 한 step에 대해 세운 focus 계획이다."""

    step_index: int = Field(ge=1)
    focus_summary: str
    selection_reason: str
    selected_actor_ids: list[str] = Field(default_factory=list)
    deferred_actor_ids: list[str] = Field(default_factory=list)
    focus_slices: list[FocusSlice] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_step_focus_plan(self) -> "StepFocusPlan":
        """selected/deferred와 slice 정합성을 검증한다."""

        if not self.focus_summary.strip():
            raise ValueError("focus_summary는 비어 있을 수 없습니다.")
        if not self.selection_reason.strip():
            raise ValueError("selection_reason은 비어 있을 수 없습니다.")
        if len(self.selected_actor_ids) != len(set(self.selected_actor_ids)):
            raise ValueError("selected_actor_ids에 중복을 허용하지 않습니다.")
        if len(self.deferred_actor_ids) != len(set(self.deferred_actor_ids)):
            raise ValueError("deferred_actor_ids에 중복을 허용하지 않습니다.")
        for focus_slice in self.focus_slices:
            for actor_id in focus_slice.focus_actor_ids:
                if actor_id not in self.selected_actor_ids:
                    raise ValueError(
                        "focus_slices의 focus_actor_ids는 selected_actor_ids 안에 있어야 합니다."
                    )
        return self


class BackgroundUpdate(BaseModel):
    """off-screen actor의 배경 상태 변화를 요약한 항목이다."""

    step_index: int = Field(ge=1)
    actor_id: str
    summary: str
    pressure_level: PressureLevel
    future_hook: str

    @model_validator(mode="after")
    def validate_background_update(self) -> "BackgroundUpdate":
        """배경 업데이트 핵심 필드를 검증한다."""

        if not self.actor_id.strip():
            raise ValueError("actor_id는 비어 있을 수 없습니다.")
        if not self.summary.strip():
            raise ValueError("summary는 비어 있을 수 없습니다.")
        if not self.future_hook.strip():
            raise ValueError("future_hook은 비어 있을 수 없습니다.")
        return self


class BackgroundUpdateBatch(BaseModel):
    """한 step의 background update 묶음이다."""

    background_updates: list[BackgroundUpdate] = Field(default_factory=list)


class StepAdjudication(BaseModel):
    """Coordinator가 actor proposal을 채택하고 상태를 정리한 결과다."""

    adopted_actor_ids: list[str] = Field(default_factory=list)
    rejected_action_notes: list[str] = Field(default_factory=list)
    updated_intent_states: list[ActorIntentSnapshot] = Field(default_factory=list)
    step_time_advance: StepTimeAdvanceProposal
    background_updates: list[BackgroundUpdate] = Field(default_factory=list)
    event_action: ObserverEventProposal | None = None
    world_state_summary_hint: str

    @model_validator(mode="after")
    def validate_step_adjudication(self) -> "StepAdjudication":
        """채택 결과 핵심 필드를 검증한다."""

        if not self.world_state_summary_hint.strip():
            raise ValueError("world_state_summary_hint는 비어 있을 수 없습니다.")
        if len(self.adopted_actor_ids) != len(set(self.adopted_actor_ids)):
            raise ValueError("adopted_actor_ids에 중복을 허용하지 않습니다.")
        return self


class ObserverReport(BaseModel):
    """Observer가 작성하는 단계 요약이다."""

    step_index: int
    summary: str
    notable_events: list[str]
    atmosphere: str
    momentum: SimulationMomentum = "medium"
    world_state_summary: str


class ObserverEventProposal(BaseModel):
    """Observer가 확률 분기에서 생성하는 공용 action/event 제안이다."""

    action_type: str
    intent: str
    action_summary: str
    action_detail: str
    utterance: str | None = None
    thread_id: str | None = None
    expected_outcome: str | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_optional_utterance(cls, value: object) -> object:
        """빈 utterance 문자열을 None으로 정규화한다."""

        if not isinstance(value, dict):
            return value
        payload = cast(dict[str, object], value)
        raw_utterance = payload.get("utterance")
        if isinstance(raw_utterance, str) and not raw_utterance.strip():
            return {
                **payload,
                "utterance": None,
            }
        return value

    @model_validator(mode="after")
    def validate_event(self) -> "ObserverEventProposal":
        """사건 제안 필수 텍스트를 검증한다."""

        if not self.action_type.strip():
            raise ValueError("사건 제안은 action_type이 필요합니다.")
        if not self.intent.strip():
            raise ValueError("사건 제안은 intent가 필요합니다.")
        if not self.action_summary.strip():
            raise ValueError("사건 제안은 action_summary가 필요합니다.")
        if not self.action_detail.strip():
            raise ValueError("사건 제안은 action_detail이 필요합니다.")
        if self.utterance is not None and not self.utterance.strip():
            raise ValueError("utterance가 있으면 비어 있을 수 없습니다.")
        return self


class FinalReport(BaseModel):
    """최종 실행 결과 요약이다."""

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
    """최종 보고서 타임라인의 시작 시각 결정이다."""

    anchor_iso: str
    selection_reason: str
