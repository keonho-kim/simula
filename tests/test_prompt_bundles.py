"""Verify prompt bundles include explicit per-field length guidance."""

from __future__ import annotations

from simula.application.workflow.graphs.planning.output_schema.bundles import (
    build_action_catalog_prompt_bundle,
    build_planning_analysis_prompt_bundle,
)
from simula.application.workflow.graphs.planning.prompts.build_action_catalog_prompt import (
    PROMPT as BUILD_ACTION_CATALOG_PROMPT,
)
from simula.application.workflow.graphs.runtime.output_schema.bundles import (
    build_actor_action_narrative_prompt_bundle,
)
from simula.application.workflow.graphs.runtime.prompts.actor_action_narrative_prompt import (
    PROMPT as ACTOR_ACTION_NARRATIVE_PROMPT,
)


def test_action_catalog_bundle_includes_explicit_sentence_limits() -> None:
    bundle = build_action_catalog_prompt_bundle()

    assert "Do not exceed the per-field sentence or item limits" in bundle["format_rules"]
    assert "1 Korean sentence describing the action" in bundle["output_example"]
    assert "1 Korean sentence for how to choose from the action catalog" in bundle["output_example"]


def test_planning_analysis_bundle_uses_explicit_length_guidance() -> None:
    bundle = build_planning_analysis_prompt_bundle()

    assert "within 25 words" in bundle["output_example"]
    assert "1 Korean sentence about one key pressure" in bundle["output_example"]


def test_runtime_narrative_bundle_limits_detail_length() -> None:
    bundle = build_actor_action_narrative_prompt_bundle()

    assert "within 2 Korean sentences" in bundle["output_example"]
    assert "1 Korean spoken line" in bundle["output_example"]


def test_action_catalog_prompt_mentions_shape_guide_limits() -> None:
    assert (
        "Do not exceed the per-field sentence or item limits shown in the shape guide."
        in BUILD_ACTION_CATALOG_PROMPT
    )


def test_actor_narrative_prompt_mentions_shape_guide_limits() -> None:
    assert (
        "Do not exceed the per-field sentence or item limits shown in the shape guide."
        in ACTOR_ACTION_NARRATIVE_PROMPT.template
    )
