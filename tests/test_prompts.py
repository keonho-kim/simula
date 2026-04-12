"""목적:
- live prompt 자산의 핵심 placeholder와 형식 규칙만 검증한다.

설명:
- 문구 자체를 고정하지 않고, 현재 그래프가 요구하는 입력 채널과 출력 형식이
  유지되는지만 확인한다.

사용한 설계 패턴:
- prompt smoke 테스트 패턴
"""

from __future__ import annotations

from simula.application.workflow.graphs.coordinator.prompts.build_step_focus_plan_prompt import (
    PROMPT as BUILD_STEP_FOCUS_PLAN_PROMPT,
)
from simula.application.workflow.graphs.coordinator.output_schema.bundles import (
    build_step_focus_plan_prompt_bundle,
)
from simula.application.workflow.graphs.generation.prompts.generate_actor_prompt import (
    PROMPT as GENERATE_ACTOR_PROMPT,
)
from simula.application.workflow.graphs.generation.output_schema.bundles import (
    build_actor_card_prompt_bundle,
)
from simula.application.workflow.graphs.planning.prompts.build_cast_roster_prompt import (
    PROMPT as BUILD_CAST_ROSTER_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.decide_runtime_progression_prompt import (
    PROMPT as DECIDE_RUNTIME_PROGRESSION_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.summarize_scenario_brief_prompt import (
    PROMPT as SUMMARIZE_SCENARIO_BRIEF_PROMPT,
)
from simula.application.workflow.graphs.planning.output_schema.bundles import (
    build_cast_roster_item_ndjson_prompt_bundle,
    build_cast_roster_prompt_bundle,
    build_runtime_progression_plan_prompt_bundle,
    build_scenario_brief_prompt_bundle,
)
from simula.application.workflow.graphs.runtime.prompts.actor_turn_prompt import (
    PROMPT as ACTOR_PROPOSAL_PROMPT,
)
from simula.application.workflow.graphs.runtime.prompts.observe_step_prompt import (
    PROMPT as OBSERVE_STEP_PROMPT,
)
from simula.application.workflow.graphs.runtime.output_schema.bundles import (
    build_actor_action_proposal_prompt_bundle,
    build_observer_report_prompt_bundle,
)

def test_output_prompt_bundle_uses_compact_json_example() -> None:
    bundle = build_runtime_progression_plan_prompt_bundle()

    assert "Return one JSON object only." in bundle["format_rules"]
    assert "\n" not in bundle["output_example"]
    assert bundle["output_example"].startswith('{"max_steps":')


def test_ndjson_prompt_bundle_uses_single_line_example() -> None:
    bundle = build_cast_roster_item_ndjson_prompt_bundle()

    assert "Return one JSON object per line." in bundle["format_rules"]
    assert bundle["output_example"].count("\n") == 0
    assert bundle["output_example"].startswith('{"cast_id":')


def test_runtime_progression_prompt_smoke() -> None:
    prompt = DECIDE_RUNTIME_PROGRESSION_PROMPT.format(
        scenario_brief_json="{}",
        core_premise="제한된 시간 안에 공개 신호와 비공개 계산이 충돌한다.",
        max_steps=8,
        **build_runtime_progression_plan_prompt_bundle(),
    )

    assert "{max_steps}" not in prompt
    assert "{scenario_brief_json}" not in prompt
    assert "allowed_units" in prompt
    assert "default_unit" in prompt
    assert "selection_reason" in prompt


def test_action_catalog_example_uses_at_most_five_broad_actions() -> None:
    from simula.application.workflow.graphs.planning.output_schema.bundles import (
        build_action_catalog_prompt_bundle,
    )

    bundle = build_action_catalog_prompt_bundle(example_mode="compact")

    assert bundle["output_example"].count('"action_type"') <= 5
    assert "public_signal" in bundle["output_example"]
    assert "private_coordination" in bundle["output_example"]


def test_scenario_brief_prompt_smoke() -> None:
    prompt = SUMMARIZE_SCENARIO_BRIEF_PROMPT.format(
        scenario_text="A realistic coordination crisis.",
        max_steps=8,
        **build_scenario_brief_prompt_bundle(),
    )

    assert "{scenario_text}" not in prompt
    assert "Build one reusable scenario brief" in prompt
    assert "summary" in prompt


def test_generation_prompt_smoke() -> None:
    prompt = GENERATE_ACTOR_PROMPT.format(
        interpretation_json="{}",
        situation_json="{}",
        action_catalog_json="{}",
        coordination_frame_json="{}",
        actor_slot_index=1,
        target_actor_count=4,
        cast_item_json="{}",
        **build_actor_card_prompt_bundle(),
    )

    assert "{interpretation_json}" not in prompt
    assert "{action_catalog_json}" not in prompt
    assert "{coordination_frame_json}" not in prompt
    assert "cast_item_json" not in prompt
    assert "Preserve the given `cast_id` and `display_name` exactly." in prompt
    assert "Scenario:" not in prompt


def test_cast_roster_prompt_smoke_uses_structured_list_contract() -> None:
    prompt = BUILD_CAST_ROSTER_PROMPT.format(
        interpretation_json="{}",
        situation_json="{}",
        action_catalog_json="{}",
        **build_cast_roster_prompt_bundle(),
    )

    assert "{interpretation_json}" not in prompt
    assert "Return one JSON object with an `items` array." in prompt
    assert "Output NDJSON only." not in prompt
    assert "Scenario:" not in prompt


def test_actor_prompt_smoke_uses_compact_inputs_only() -> None:
    prompt = ACTOR_PROPOSAL_PROMPT.format(
        step_index=1,
        progression_plan_json="{}",
        simulation_clock_json="{}",
        actor_json="{}",
        focus_slice_json="{}",
        visible_action_context_json="[]",
        visible_actors_json="[]",
        unread_backlog_digest_json="null",
        runtime_guidance_json='{"available_actions":[]}',
        max_recipients_per_message=2,
        **build_actor_action_proposal_prompt_bundle(),
    )

    assert "{visible_action_context_json}" not in prompt
    assert "{unread_backlog_digest_json}" not in prompt
    assert "visible action context JSON:" in prompt
    assert "unread backlog digest JSON:" in prompt
    assert "recent visible activities JSON:" not in prompt
    assert "unread visible activities JSON:" not in prompt
    assert "Use short, direct Korean sentences" not in prompt


def test_coordinator_focus_prompt_smoke() -> None:
    prompt = BUILD_STEP_FOCUS_PLAN_PROMPT.format(
        step_index=1,
        focus_candidates_json="[]",
        coordination_frame_json="{}",
        situation_json="{}",
        simulation_clock_json="{}",
        previous_observer_summary="none",
        max_focus_slices_per_step=3,
        max_actor_calls_per_step=6,
        **build_step_focus_plan_prompt_bundle(),
    )

    assert "{focus_candidates_json}" not in prompt
    assert "{simulation_clock_json}" not in prompt
    assert "`selected_actor_ids` must match the union of `focus_actor_ids`." in prompt
    assert "action catalog JSON:" not in prompt
    assert "Use short, direct Korean sentences" not in prompt


def test_background_update_prompt_bundle_includes_step_index() -> None:
    from simula.application.workflow.graphs.coordinator.output_schema.bundles import (
        build_background_update_batch_prompt_bundle,
    )

    bundle = build_background_update_batch_prompt_bundle()

    assert '"step_index":2' in bundle["output_example"]


def test_step_adjudication_prompt_bundle_includes_step_time_advance_fields() -> None:
    from simula.application.workflow.graphs.coordinator.output_schema.bundles import (
        build_step_adjudication_prompt_bundle,
    )

    bundle = build_step_adjudication_prompt_bundle()

    assert '"elapsed_unit":"hour"' in bundle["output_example"]
    assert '"elapsed_amount":1' in bundle["output_example"]
    assert '"selection_reason"' in bundle["output_example"]


def test_observer_prompt_smoke_uses_prior_state_digest() -> None:
    prompt = OBSERVE_STEP_PROMPT.format(
        step_index=1,
        simulation_clock_json="{}",
        step_time_advance_json="{}",
        latest_activities_json="[]",
        current_intent_states_json="[]",
        latest_background_updates_json="[]",
        prior_state_digest_json="{}",
        **build_observer_report_prompt_bundle(),
    )

    assert "{prior_state_digest_json}" not in prompt
    assert "prior state digest JSON:" in prompt
    assert "recent actions JSON:" not in prompt
    assert "recent intent history JSON:" not in prompt
    assert "Use short, direct Korean sentences" in prompt
