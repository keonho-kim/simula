"""목적:
- 프롬프트 자산이 영문 지시와 한국어 응답 규칙을 함께 포함하는지 검증한다.

설명:
- 공용 출력 예시와 각 단계 프롬프트의 핵심 문구를 확인한다.

사용한 설계 패턴:
- 프롬프트 회귀 테스트 패턴
"""

from __future__ import annotations

from simula.application.workflow.graphs.generation.prompts.generate_actor_prompt import (
    PROMPT as GENERATE_ACTOR_PROMPT,
)
from simula.application.workflow.graphs.finalization.prompts.actor_dynamics_prompt import (
    PROMPT as ACTOR_DYNAMICS_PROMPT,
)
from simula.application.workflow.graphs.finalization.prompts.actor_final_results_prompt import (
    PROMPT as ACTOR_FINAL_RESULTS_PROMPT,
)
from simula.application.workflow.graphs.finalization.prompts.major_events_prompt import (
    PROMPT as MAJOR_EVENTS_PROMPT,
)
from simula.application.workflow.graphs.finalization.prompts.simulation_conclusion_prompt import (
    PROMPT as SIMULATION_CONCLUSION_PROMPT,
)
from simula.application.workflow.graphs.finalization.prompts.timeline_anchor_prompt import (
    PROMPT as TIMELINE_ANCHOR_PROMPT,
)
from simula.application.workflow.graphs.finalization.prompts.timeline_report_prompt import (
    PROMPT as TIMELINE_REPORT_PROMPT,
)
from simula.application.workflow.graphs.coordinator.prompts.adjudicate_step_focus_prompt import (
    PROMPT as ADJUDICATE_STEP_FOCUS_PROMPT,
)
from simula.application.workflow.graphs.coordinator.prompts.build_step_focus_plan_prompt import (
    PROMPT as BUILD_STEP_FOCUS_PLAN_PROMPT,
)
from simula.application.workflow.graphs.coordinator.prompts.summarize_background_updates_prompt import (
    PROMPT as SUMMARIZE_BACKGROUND_UPDATES_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.build_coordination_frame_prompt import (
    PROMPT as BUILD_COORDINATION_FRAME_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.build_cast_roster_prompt import (
    PROMPT as BUILD_CAST_ROSTER_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.build_action_catalog_prompt import (
    PROMPT as BUILD_ACTION_CATALOG_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.decide_runtime_progression_prompt import (
    PROMPT as DECIDE_RUNTIME_PROGRESSION_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.finalize_situation_prompt import (
    PROMPT as FINALIZE_SITUATION_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.interpret_core_prompt import (
    PROMPT as INTERPRET_CORE_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.interpret_pressure_points_prompt import (
    PROMPT as INTERPRET_PRESSURE_POINTS_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.interpret_time_scope_prompt import (
    PROMPT as INTERPRET_TIME_SCOPE_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.interpret_visibility_context_prompt import (
    PROMPT as INTERPRET_VISIBILITY_CONTEXT_PROMPT,
)
from simula.application.workflow.graphs.runtime.prompts.actor_turn_prompt import (
    PROMPT as ACTOR_PROPOSAL_PROMPT,
)
from simula.application.workflow.graphs.runtime.prompts.estimate_step_time_advance_prompt import (
    PROMPT as ESTIMATE_STEP_TIME_ADVANCE_PROMPT,
)
from simula.application.workflow.graphs.runtime.prompts.observe_step_prompt import (
    PROMPT as OBSERVE_STEP_PROMPT,
)
from simula.application.workflow.graphs.runtime.prompts.propose_observer_event_prompt import (
    PROMPT as PROPOSE_OBSERVER_EVENT_PROMPT,
)
from simula.application.workflow.graphs.runtime.prompts.track_intent_shifts_prompt import (
    PROMPT as TRACK_INTENT_SHIFTS_PROMPT,
)
from simula.domain.contracts import (
    ActionCatalog,
    ActorActionProposal,
    ActorCard,
    ActorIntentStateBatch,
    BackgroundUpdateBatch,
    CastRosterItem,
    CoordinationFrame,
    ObserverEventProposal,
    ObserverReport,
    RuntimeProgressionPlan,
    ScenarioTimeScope,
    StepAdjudication,
    StepFocusPlan,
    SituationBundle,
    StepTimeAdvanceProposal,
    TimelineAnchorDecision,
)
from simula.prompts.shared.output_examples import (
    build_ndjson_prompt_bundle,
    build_output_prompt_bundle,
)


def test_output_examples_are_generic_and_english_rules() -> None:
    bundle = build_output_prompt_bundle(ScenarioTimeScope)

    assert "Return one JSON object only." in bundle["format_rules"]
    assert '"start": "초기 대면 직후"' in bundle["output_example"]
    assert "미국" not in bundle["output_example"]


def test_timeline_anchor_prompt_requests_absolute_timestamp() -> None:
    prompt = TIMELINE_ANCHOR_PROMPT.format(
        scenario_text="A realistic coordination crisis.",
        date_hint="2027-06-18",
        time_hint="03:20",
        context_hint="시작 시각: 03:20",
        elapsed_simulation_label="6시간 30분",
        max_steps=4,
        **build_output_prompt_bundle(TimelineAnchorDecision),
    )

    assert "determine one absolute starting timestamp" in prompt
    assert "`anchor_iso` must be one absolute timestamp" in prompt
    assert "Preserve any explicit date or time information" in prompt


def test_interpret_core_prompt_is_english_with_korean_response_rule() -> None:
    prompt = INTERPRET_CORE_PROMPT.format(
        scenario_text="A realistic coordination crisis.",
        max_steps=4,
    )

    assert "extract the core premise" in prompt
    assert "Return one concise sentence only." in prompt
    assert "Use short, direct Korean sentences" in prompt


def test_interpret_time_scope_prompt_is_english_with_korean_response_rule() -> None:
    prompt = INTERPRET_TIME_SCOPE_PROMPT.format(
        scenario_text="A realistic coordination crisis.",
        max_steps=4,
        **build_output_prompt_bundle(ScenarioTimeScope),
    )

    assert "effective time scope in structured form" in prompt
    assert "terminal resolution" in prompt
    assert "Treat this scope as narrative guidance" in prompt
    assert "Write all natural-language values in Korean." in prompt
    assert "Use short, direct Korean sentences" in prompt


def test_decide_runtime_progression_prompt_requests_dynamic_clock_plan() -> None:
    prompt = DECIDE_RUNTIME_PROGRESSION_PROMPT.format(
        scenario_text="A realistic coordination crisis.",
        core_premise="제한된 시간 안에 공개 신호와 비공개 계산이 충돌한다.",
        max_steps=8,
        **build_output_prompt_bundle(RuntimeProgressionPlan),
    )

    assert "design the execution time progression plan" in prompt
    assert "allowed_units must be chosen from `minute`, `hour`, `day`, `week`" in prompt
    assert "reach the scenario's terminal resolution within max_steps" in prompt
    assert (
        "Do not assume that every step advances by the same amount of time." in prompt
    )
    assert "30분 또는 1시간으로 본다." in prompt
    assert "Use short, direct Korean sentences" in prompt


def test_interpret_visibility_context_prompt_uses_list_bundle() -> None:
    prompt = INTERPRET_VISIBILITY_CONTEXT_PROMPT.format(
        scenario_text="A realistic coordination crisis.",
        output_format_name="JSON",
        format_rules="- Return one JSON object only.",
        output_example='{"public_context":["공개"],"private_context":["비공개"]}',
    )

    assert "publicly observable" in prompt
    assert "public_context and private_context must both be lists." in prompt


def test_interpret_pressure_points_prompt_uses_list_bundle() -> None:
    prompt = INTERPRET_PRESSURE_POINTS_PROMPT.format(
        scenario_text="A realistic coordination crisis.",
        output_format_name="JSON",
        format_rules="- Return one JSON object only.",
        output_example='{"key_pressures":["압박"],"observation_points":["포인트"]}',
    )

    assert "main pressures and observation points" in prompt
    assert "key_pressures and observation_points must both be lists." in prompt


def test_situation_prompt_is_english_with_korean_response_rule() -> None:
    prompt = FINALIZE_SITUATION_PROMPT.format(
        scenario_text="A realistic coordination crisis.",
        interpretation_json="{}",
        max_steps=4,
        **build_output_prompt_bundle(SituationBundle),
    )

    assert "turn the scenario interpretation into a runnable situation bundle" in prompt
    assert "Write all natural-language values in Korean." in prompt
    assert "Use short, direct Korean sentences" in prompt


def test_cast_roster_prompt_uses_ndjson() -> None:
    prompt = BUILD_CAST_ROSTER_PROMPT.format(
        scenario_text="A realistic coordination crisis.",
        interpretation_json="{}",
        situation_json="{}",
        action_catalog_json="{}",
        **build_ndjson_prompt_bundle(CastRosterItem),
    )

    assert "Output NDJSON only." in prompt
    assert "Every line must be one valid JSON object." in prompt


def test_action_catalog_prompt_requests_action_first_simulation_space() -> None:
    prompt = BUILD_ACTION_CATALOG_PROMPT.format(
        scenario_text="A realistic coordination crisis.",
        interpretation_json="{}",
        situation_json="{}",
        **build_output_prompt_bundle(ActionCatalog),
    )

    assert "derive a scenario-wide action catalog" in prompt
    assert "`speech` must be treated as one possible action" in prompt
    assert "supports_utterance" in prompt


def test_coordination_frame_prompt_requests_focus_rules() -> None:
    prompt = BUILD_COORDINATION_FRAME_PROMPT.format(
        scenario_text="A realistic coordination crisis.",
        interpretation_json="{}",
        situation_json="{}",
        action_catalog_json="{}",
        **build_output_prompt_bundle(CoordinationFrame),
    )

    assert "derive the coordination frame" in prompt
    assert "focus_selection_rules" in prompt
    assert "background_motion_rules" in prompt


def test_generation_prompt_is_english_with_korean_response_rule() -> None:
    prompt = GENERATE_ACTOR_PROMPT.format(
        scenario_text="A realistic coordination crisis.",
        interpretation_json="{}",
        situation_json="{}",
        action_catalog_json="{}",
        coordination_frame_json="{}",
        actor_slot_index=1,
        target_actor_count=4,
        cast_item_json="{}",
        **build_output_prompt_bundle(ActorCard),
    )

    assert "one cast roster item into one realistic participant card" in prompt
    assert "Write all natural-language values in Korean." in prompt
    assert "Scenario interpretation JSON:" in prompt
    assert "Action catalog JSON:" in prompt
    assert "Coordination frame JSON:" in prompt
    assert "Preserve the cast_id and display_name" in prompt


def test_actor_proposal_prompt_is_english_with_korean_response_rule() -> None:
    prompt = ACTOR_PROPOSAL_PROMPT.format(
        step_index=1,
        progression_plan_json="{}",
        simulation_clock_json="{}",
        actor_json="{}",
        focus_slice_json="{}",
        recent_visible_activities_json="[]",
        visible_actors_json="[]",
        unread_visible_activities_json="[]",
        runtime_guidance_json='{"available_actions":[]}',
        max_recipients_per_message=2,
        **build_output_prompt_bundle(ActorActionProposal),
    )

    assert "propose one plausible action for this step" in prompt
    assert "Write all natural-language values in Korean." in prompt
    assert "recent visible activities JSON:" in prompt
    assert "runtime guidance JSON:" in prompt
    assert "focus slice JSON:" in prompt
    assert "Choose action_type from the available actions" in prompt
    assert "current simulation clock JSON:" in prompt


def test_observer_prompt_is_english_with_korean_response_rule() -> None:
    prompt = OBSERVE_STEP_PROMPT.format(
        step_index=1,
        simulation_clock_json="{}",
        step_time_advance_json="{}",
        latest_activities_json="[]",
        recent_activities_json="[]",
        current_intent_states_json="[]",
        recent_intent_history_json="[]",
        latest_background_updates_json="[]",
        previous_summary="none",
        world_state_summary="초기 상태",
        **build_output_prompt_bundle(ObserverReport),
    )

    assert "You are a simulation observer at our company." in prompt
    assert "Write all natural-language values in Korean." in prompt
    assert "momentum must be exactly one of `high`, `medium`, `low`." in prompt
    assert "Do not translate momentum into Korean words" in prompt
    assert "current intent states JSON:" in prompt
    assert "latest background updates JSON:" in prompt
    assert "Use short, direct Korean sentences" in prompt


def test_observer_event_prompt_requests_public_event() -> None:
    prompt = PROPOSE_OBSERVER_EVENT_PROMPT.format(
        step_index=1,
        simulation_clock_json="{}",
        step_time_advance_json="{}",
        latest_activities_json="[]",
        recent_activities_json="[]",
        current_intent_states_json="[]",
        previous_summary="none",
        world_state_summary="초기 상태",
        **build_output_prompt_bundle(ObserverEventProposal),
    )

    assert "propose one public situation change" in prompt
    assert "Propose exactly one public action or event." in prompt
    assert "Write all natural-language values in Korean." in prompt
    assert "Use short, direct Korean sentences" in prompt


def test_build_step_focus_plan_prompt_requests_budgeted_focus() -> None:
    prompt = BUILD_STEP_FOCUS_PLAN_PROMPT.format(
        step_index=1,
        focus_candidates_json="[]",
        coordination_frame_json="{}",
        situation_json="{}",
        action_catalog_json="{}",
        simulation_clock_json="{}",
        previous_observer_summary="none",
        max_focus_slices_per_step=3,
        max_actor_calls_per_step=6,
        **build_output_prompt_bundle(StepFocusPlan),
    )

    assert "which focus slices deserve direct simulation attention" in prompt
    assert "selected_actor_ids should match the union" in prompt
    assert "max actor calls per step" in prompt


def test_background_update_prompt_requests_offscreen_digest_only() -> None:
    prompt = SUMMARIZE_BACKGROUND_UPDATES_PROMPT.format(
        step_index=1,
        deferred_actors_json="[]",
        selected_actor_ids_json="[]",
        recent_activities_json="[]",
        actor_intent_states_json="[]",
        world_state_summary="초기 상태",
        coordination_frame_json="{}",
        **build_output_prompt_bundle(BackgroundUpdateBatch),
    )

    assert "background state movement" in prompt
    assert "pressure_level must be exactly one of `low`, `medium`, `high`." in prompt


def test_step_adjudication_prompt_requests_adopted_subset() -> None:
    prompt = ADJUDICATE_STEP_FOCUS_PROMPT.format(
        step_index=1,
        step_focus_plan_json="{}",
        pending_actor_proposals_json="[]",
        actor_intent_states_json="[]",
        latest_background_updates_json="[]",
        simulation_clock_json="{}",
        progression_plan_json="{}",
        world_state_summary="초기 상태",
        **build_output_prompt_bundle(StepAdjudication),
    )

    assert "adjudicate the selected actor proposals" in prompt
    assert "Do not adopt every proposal by default" in prompt
    assert "event_action is optional" in prompt


def test_step_time_advance_prompt_requests_dynamic_elapsed_time() -> None:
    prompt = ESTIMATE_STEP_TIME_ADVANCE_PROMPT.format(
        step_index=1,
        latest_actions_json="[]",
        current_intent_states_json="[]",
        progression_plan_json="{}",
        simulation_clock_json="{}",
        interpretation_json="{}",
        situation_json="{}",
        **build_output_prompt_bundle(StepTimeAdvanceProposal),
    )

    assert "estimates how much simulation time actually passed" in prompt
    assert "The normalized elapsed time must be at least 30 minutes." in prompt
    assert "elapsed_unit must be one of the units allowed" in prompt


def test_track_intent_prompt_requests_one_snapshot_per_actor() -> None:
    prompt = TRACK_INTENT_SHIFTS_PROMPT.format(
        step_index=1,
        actors_json="[]",
        latest_actions_json="[]",
        previous_intent_states_json="[]",
        action_catalog_json="{}",
        **build_output_prompt_bundle(ActorIntentStateBatch),
    )

    assert "tracks how each actor's intent evolves" in prompt
    assert "Return one current intent snapshot per actor." in prompt


def test_simulation_conclusion_prompt_requests_bullet_only() -> None:
    prompt = SIMULATION_CONCLUSION_PROMPT.format(
        scenario_text="A realistic coordination crisis.",
        final_report_json="{}",
        report_projection_json="{}",
        body_sections_markdown="## 시뮬레이션 타임라인\n\n본문",
        actor_final_results_markdown="| A | 결과 | 대상 | 상태 | 근거 |",
    )

    assert "write the Markdown body for one fixed section" in prompt
    assert "- section title:\n        시뮬레이션 결론" in prompt
    assert "`### 최종 상태`와 `### 핵심 이유`" in prompt
    assert "첫 bullet부터 시나리오가 요구한 마지막 판정 이벤트" in prompt
    assert "body sections markdown" in prompt
    assert "actor final results markdown" in prompt
    assert "simulation log JSONL" not in prompt
    assert "Output Markdown body only for the requested section." in prompt


def test_body_section_prompts_are_split_by_stage() -> None:
    results_prompt = ACTOR_FINAL_RESULTS_PROMPT.format(
        scenario_text="A realistic coordination crisis.",
        final_report_json="{}",
        report_projection_json="{}",
        body_sections_markdown="## 시뮬레이션 타임라인\n\n본문",
    )
    actor_prompt = ACTOR_DYNAMICS_PROMPT.format(
        scenario_text="A realistic coordination crisis.",
        final_report_json="{}",
        report_projection_json="{}",
    )
    timeline_prompt = TIMELINE_REPORT_PROMPT.format(
        scenario_text="A realistic coordination crisis.",
        final_report_json="{}",
        report_projection_json="{}",
    )
    event_prompt = MAJOR_EVENTS_PROMPT.format(
        scenario_text="A realistic coordination crisis.",
        final_report_json="{}",
        report_projection_json="{}",
    )

    assert "- section title:\n        행위자 별 최종 결과" in results_prompt
    assert "마지막 판정 이벤트 이름이 있으면 그 표현을 우선 사용하라." in results_prompt
    assert "- section title:\n        행위자 역학 관계" in actor_prompt
    assert "`### 현재 구도`와 `### 관계 변화`" in actor_prompt
    assert "Use short, direct Korean sentences" in actor_prompt
    assert "- section title:\n        시뮬레이션 타임라인" in timeline_prompt
    assert "YYYY-MM-DD HH:mm | 국면 | 핵심 이벤트 | 결과/파급" in timeline_prompt
    assert (
        "`시작 단계`, `탐색 단계`, `관계 변화 단계`, `마무리 단계`" in timeline_prompt
    )
    assert "- section title:\n        주요 사건과 그 결과" in event_prompt
    assert "누가 무엇을 했는지와 그 결과가 어떻게 이어졌는지" in event_prompt


def test_user_facing_style_rules_are_not_added_to_actor_roleplay_prompts() -> None:
    actor_prompt = ACTOR_PROPOSAL_PROMPT.format(
        step_index=1,
        progression_plan_json="{}",
        simulation_clock_json="{}",
        actor_json="{}",
        focus_slice_json="{}",
        recent_visible_activities_json="[]",
        visible_actors_json="[]",
        unread_visible_activities_json="[]",
        runtime_guidance_json="{}",
        max_recipients_per_message=2,
        **build_output_prompt_bundle(ActorActionProposal),
    )
    generator_prompt = GENERATE_ACTOR_PROMPT.format(
        scenario_text="A realistic coordination crisis.",
        interpretation_json="{}",
        situation_json="{}",
        action_catalog_json="{}",
        coordination_frame_json="{}",
        actor_slot_index=1,
        target_actor_count=4,
        cast_item_json="{}",
        **build_output_prompt_bundle(ActorCard),
    )
    roster_prompt = BUILD_CAST_ROSTER_PROMPT.format(
        scenario_text="A realistic coordination crisis.",
        interpretation_json="{}",
        situation_json="{}",
        action_catalog_json="{}",
        **build_ndjson_prompt_bundle(CastRosterItem),
    )

    assert "Use short, direct Korean sentences" not in actor_prompt
    assert "Use short, direct Korean sentences" not in generator_prompt
    assert "Use short, direct Korean sentences" not in roster_prompt
