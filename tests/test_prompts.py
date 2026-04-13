"""Purpose:
- Smoke test live prompt assets against the compact graph contracts.
"""

from __future__ import annotations

from simula.application.workflow.graphs.coordinator.output_schema.bundles import (
    build_step_directive_prompt_bundle,
    build_step_resolution_prompt_bundle,
)
from simula.application.workflow.graphs.coordinator.prompts.adjudicate_step_focus_prompt import (
    PROMPT as STEP_RESOLUTION_PROMPT,
)
from simula.application.workflow.graphs.coordinator.prompts.build_step_focus_plan_prompt import (
    PROMPT as STEP_DIRECTIVE_PROMPT,
)
from simula.application.workflow.graphs.finalization.output_schema.bundles import (
    build_final_report_sections_prompt_bundle,
)
from simula.application.workflow.graphs.finalization.prompts.write_final_report_bundle_prompt import (
    PROMPT as FINAL_REPORT_BUNDLE_PROMPT,
)
from simula.application.workflow.graphs.generation.output_schema.bundles import (
    build_actor_card_prompt_bundle,
)
from simula.application.workflow.graphs.generation.prompts.generate_actor_prompt import (
    PROMPT as GENERATE_ACTOR_PROMPT,
)
from simula.application.workflow.graphs.planning.output_schema.bundles import (
    build_execution_plan_prompt_bundle,
    build_planning_analysis_prompt_bundle,
)
from simula.application.workflow.graphs.planning.prompts.build_execution_plan_prompt import (
    PROMPT as BUILD_EXECUTION_PLAN_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.build_planning_analysis_prompt import (
    PROMPT as BUILD_PLANNING_ANALYSIS_PROMPT,
)
from simula.application.workflow.graphs.runtime.output_schema.bundles import (
    build_actor_action_proposal_prompt_bundle,
)
from simula.application.workflow.graphs.runtime.prompts.actor_turn_prompt import (
    PROMPT as ACTOR_PROPOSAL_PROMPT,
)


def test_output_prompt_bundle_uses_compact_json_example() -> None:
    bundle = build_planning_analysis_prompt_bundle()

    assert "Return one JSON object only." in bundle["format_rules"]
    assert "\n" not in bundle["output_example"]
    assert bundle["output_example"].startswith('{"brief_summary":')


def test_planning_analysis_prompt_smoke() -> None:
    prompt = BUILD_PLANNING_ANALYSIS_PROMPT.format(
        scenario_text="A realistic coordination crisis.",
        max_steps=8,
        **build_planning_analysis_prompt_bundle(),
    )

    assert "{scenario_text}" not in prompt
    assert "brief_summary" in prompt
    assert "progression_plan" in prompt
    assert "do not infer a concrete value" in prompt
    assert "Do not import outside genre knowledge" in prompt
    assert "Do not turn the scenario into observation questions" in prompt


def test_execution_plan_prompt_smoke() -> None:
    prompt = BUILD_EXECUTION_PLAN_PROMPT.format(
        planning_analysis_json="{}",
        max_steps=8,
        **build_execution_plan_prompt_bundle(create_all_participants=True),
    )

    assert "{planning_analysis_json}" not in prompt
    assert "cast_roster" in prompt
    assert "action_catalog" in prompt
    assert "Cast roster policy:" in prompt
    assert "`create_all_participants` is true" in prompt
    assert "Do not drop, merge, or summarize away participants" in prompt


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

    assert "Preserve the given `cast_id` and `display_name` exactly." in prompt
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
        unread_backlog_digest_json="{}",
        runtime_guidance_json='{"available_actions":[]}',
        max_recipients_per_message=2,
        **build_actor_action_proposal_prompt_bundle(),
    )

    assert "visible action context JSON:" in prompt
    assert "unread backlog digest JSON:" in prompt
    assert "set `utterance` to an empty string" in prompt


def test_step_directive_prompt_smoke() -> None:
    prompt = STEP_DIRECTIVE_PROMPT.format(
        step_index=1,
        focus_candidates_json="[]",
        deferred_actors_json="[]",
        coordination_frame_json="{}",
        situation_json="{}",
        simulation_clock_json="{}",
        previous_observer_summary="none",
        max_focus_slices_per_step=3,
        max_actor_calls_per_step=6,
        **build_step_directive_prompt_bundle(),
    )

    assert "{focus_candidates_json}" not in prompt
    assert "`selected_actor_ids` must match the union" in prompt
    assert "background_updates" in prompt


def test_step_resolution_prompt_smoke() -> None:
    prompt = STEP_RESOLUTION_PROMPT.format(
        step_index=1,
        step_focus_plan_json="{}",
        pending_actor_proposals_json="[]",
        latest_background_updates_json="[]",
        latest_activities_json="[]",
        actor_intent_states_json="[]",
        simulation_clock_json="{}",
        progression_plan_json="{}",
        world_state_summary="state",
        **build_step_resolution_prompt_bundle(),
    )

    assert "observer_report" in prompt
    assert "stop_reason" in prompt


def test_final_report_bundle_prompt_smoke() -> None:
    prompt = FINAL_REPORT_BUNDLE_PROMPT.format(
        scenario_text="scenario",
        final_report_json="{}",
        report_projection_json="{}",
        **build_final_report_sections_prompt_bundle(),
    )

    assert "actor_results_rows" in prompt
    assert "timeline_section" in prompt
    assert "conclusion_section" in prompt
