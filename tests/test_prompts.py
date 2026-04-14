"""Purpose:
- Smoke test the active prompt assets against the current compact contracts.
"""

from __future__ import annotations

from simula.application.workflow.graphs.coordinator.output_schema.bundles import (
    build_round_directive_prompt_bundle,
    build_round_resolution_prompt_bundle,
)
from simula.application.workflow.graphs.coordinator.prompts.round_directive_prompt import (
    PROMPT as ROUND_DIRECTIVE_PROMPT,
)
from simula.application.workflow.graphs.coordinator.prompts.round_resolution_prompt import (
    PROMPT as ROUND_RESOLUTION_PROMPT,
)
from simula.application.workflow.graphs.finalization.output_schema.bundles import (
    build_final_report_sections_prompt_bundle,
)
from simula.application.workflow.graphs.finalization.prompts.write_final_report_bundle_prompt import (
    PROMPT as FINAL_REPORT_BUNDLE_PROMPT,
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


def test_planning_analysis_prompt_smoke() -> None:
    prompt = BUILD_PLANNING_ANALYSIS_PROMPT.format(
        scenario_text="A realistic coordination crisis.",
        max_rounds=8,
        **build_planning_analysis_prompt_bundle(),
    )

    assert "progression_plan.max_rounds" in prompt
    assert "allowed_elapsed_units" in prompt
    assert "Do not import outside genre knowledge" in prompt
    assert '"brief_summary":"<one concise Korean summary grounded only in the scenario text>"' in prompt


def test_execution_plan_prompt_smoke() -> None:
    prompt = BUILD_EXECUTION_PLAN_PROMPT.format(
        scenario_text="Scenario text",
        planning_analysis_json="{}",
        max_rounds=8,
        num_cast=14,
        allow_additional_cast="false",
        **build_execution_plan_prompt_bundle(
            num_cast=14,
            allow_additional_cast=False,
        ),
    )

    assert "cast_roster" in prompt
    assert "Include exactly 14 cast entries" in prompt
    assert '"display_name":"<participant name or role label grounded in the scenario>"' in prompt


def test_actor_prompt_smoke_uses_compact_inputs_only() -> None:
    prompt = ACTOR_PROPOSAL_PROMPT.format(
        round_index=1,
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

    assert "A `round` is one outer simulation cycle." in prompt
    assert "visible action context JSON:" in prompt
    assert '"action_type":"<choose one action_type from runtime_guidance.available_actions>"' in prompt


def test_round_prompts_smoke() -> None:
    directive_prompt = ROUND_DIRECTIVE_PROMPT.format(
        round_index=1,
        focus_candidates_json="[]",
        deferred_actors_json="[]",
        coordination_frame_json="{}",
        situation_json="{}",
        simulation_clock_json="{}",
        previous_observer_summary="none",
        max_focus_slices_per_step=3,
        max_actor_calls_per_step=6,
        **build_round_directive_prompt_bundle(),
    )
    resolution_prompt = ROUND_RESOLUTION_PROMPT.format(
        round_index=1,
        round_focus_plan_json="{}",
        pending_actor_proposals_json="[]",
        latest_background_updates_json="[]",
        latest_activities_json="[]",
        actor_intent_states_json="[]",
        actor_facing_scenario_digest_json="{}",
        simulation_clock_json="{}",
        progression_plan_json="{}",
        world_state_summary="state",
        **build_round_resolution_prompt_bundle(),
    )

    assert "selected_cast_ids" in directive_prompt
    assert '"confidence":"<float between 0.0 and 1.0>"' in resolution_prompt
    assert '"thought":"<one Korean sentence explaining why this actor chose the direction now>"' in resolution_prompt


def test_final_report_bundle_prompt_smoke() -> None:
    prompt = FINAL_REPORT_BUNDLE_PROMPT.format(
        scenario_text="scenario",
        final_report_json="{}",
        report_projection_json="{}",
        **build_final_report_sections_prompt_bundle(),
    )

    assert "timeline_section" in prompt
    assert '"major_events_section":"- <one bullet summarizing a major event>"' in prompt
