"""Verify prompt bundles include explicit per-field length guidance."""

from __future__ import annotations

from simula.application.workflow.graphs.planning.prompts.action_catalog_prompt import (
    ACTION_CATALOG_EXAMPLE,
    PROMPT as ACTION_CATALOG_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.major_event_plan_batch_prompt import (
    PROMPT as MAJOR_EVENT_PLAN_BATCH_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.planning_analysis_prompt import (
    PLANNING_ANALYSIS_EXAMPLE,
)
from simula.application.workflow.graphs.runtime.prompts.scene_delta_prompt import (
    PROMPT as SCENE_DELTA_PROMPT,
    SCENE_DELTA_EXAMPLE,
)
from simula.shared.prompts.output_schema_utils import (
    object_prompt_bundle,
)


def test_action_catalog_bundle_includes_explicit_sentence_limits() -> None:
    bundle = object_prompt_bundle(example=ACTION_CATALOG_EXAMPLE)

    assert (
        "Do not exceed the per-field sentence or item limits" in bundle["format_rules"]
    )
    assert "1 Korean sentence describing the action" in bundle["output_example"]
    assert "choose one or more of public, private, group" in bundle["output_example"]


def test_planning_analysis_bundle_uses_explicit_length_guidance() -> None:
    bundle = object_prompt_bundle(example=PLANNING_ANALYSIS_EXAMPLE)

    assert "within 25 words" in bundle["output_example"]
    assert "1 Korean sentence about one key pressure" in bundle["output_example"]


def test_runtime_scene_delta_bundle_uses_candidate_choice_contract() -> None:
    bundle = object_prompt_bundle(example=SCENE_DELTA_EXAMPLE)

    assert "\n  \"selected_event_id\"" in bundle["output_example"]
    assert "scene_beats" in bundle["output_example"]
    assert "chosen_actions" not in bundle["output_example"]
    assert "candidate_id from candidate_table" in bundle["output_example"]
    assert "matched_activity_ids" in bundle["output_example"]
    assert "activity_id from scene beats, or return [] when none" in bundle["output_example"]
    assert "brief rationale for scene beats" in bundle["output_example"]
    assert "include the key even when the value is [] or \"\"" in bundle["format_rules"]


def test_action_catalog_prompt_mentions_shape_guide_limits() -> None:
    assert (
        "Do not exceed the per-field sentence or item limits shown in the shape guide."
        in ACTION_CATALOG_PROMPT.template
    )


def test_major_event_prompt_requires_valid_action_type_reuse() -> None:
    assert "Valid action types:" in MAJOR_EVENT_PLAN_BATCH_PROMPT.template
    assert (
        "Copy completion_action_types values exactly"
        in MAJOR_EVENT_PLAN_BATCH_PROMPT.template
    )
    assert (
        "completion_signals` must be a JSON array"
        in MAJOR_EVENT_PLAN_BATCH_PROMPT.template
    )
    assert "{valid_action_types_json}" in MAJOR_EVENT_PLAN_BATCH_PROMPT.template


def test_scene_delta_prompt_mentions_candidate_table_limits() -> None:
    prompt = SCENE_DELTA_PROMPT.format(
        compact_input_json='{"candidates":[]}',
        **object_prompt_bundle(example=SCENE_DELTA_EXAMPLE),
    )

    assert "scene_beats must contain only candidate_id values" in prompt
    assert "matched_activity_ids is required" in prompt
    assert "never omit the key" in prompt
