"""Purpose:
- Provide compact coordinator prompt examples.
"""

from __future__ import annotations

from typing import Any

from simula.shared.prompts.output_schema_utils import (
    ExampleMode,
    build_object_prompt_bundle,
    build_simple_array_prompt_bundle,
    build_simple_scalar_prompt_bundle,
)


def build_round_directive_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_object_prompt_bundle(
        example=_STEP_DIRECTIVE_EXAMPLE,
        example_mode=example_mode,
    )


def build_round_directive_focus_core_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_object_prompt_bundle(
        example=_ROUND_DIRECTIVE_FOCUS_CORE_EXAMPLE,
        example_mode=example_mode,
    )


def build_background_update_batch_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_simple_array_prompt_bundle(
        example_item=_BACKGROUND_UPDATE_EXAMPLE,
        example_mode=example_mode,
    )


def build_round_continuation_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    del example_mode
    return build_simple_scalar_prompt_bundle(
        example_value='<return "" to continue, or "no_progress" to stop before the next round>',
    )


def build_round_resolution_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_object_prompt_bundle(
        example=_STEP_RESOLUTION_EXAMPLE,
        example_mode=example_mode,
    )


def build_round_resolution_core_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_object_prompt_bundle(
        example=_ROUND_RESOLUTION_CORE_EXAMPLE,
        example_mode=example_mode,
    )


def build_major_event_update_batch_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_simple_array_prompt_bundle(
        example_item=_MAJOR_EVENT_UPDATE_EXAMPLE,
        example_mode=example_mode,
    )


def build_actor_intent_state_batch_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_simple_array_prompt_bundle(
        example_item=_ACTOR_INTENT_STATE_EXAMPLE,
        example_mode=example_mode,
    )


def build_round_resolution_narrative_bodies_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_object_prompt_bundle(
        example=_ROUND_RESOLUTION_NARRATIVE_BODIES_EXAMPLE,
        example_mode=example_mode,
    )


_ROUND_DIRECTIVE_FOCUS_CORE_EXAMPLE: dict[str, Any] = {
    "focus_summary": "<1 Korean sentence summarizing the direct focus for this round>",
    "reason": "<1 Korean sentence explaining why these actors were selected>",
    "focus_slices": [
        {
            "slice_id": "<stable slice identifier>",
            "title": "<1 short Korean slice title>",
            "focus_cast_ids": ["<cast_id included in this slice>"],
            "visibility": "<choose exactly one of public, private, group>",
            "stakes": "<within 2 Korean sentences describing what is at stake>",
            "reason": "<1 Korean sentence explaining why this slice matters now>",
        }
    ],
}

_BACKGROUND_UPDATE_EXAMPLE: dict[str, Any] = {
    "round_index": "<copy the current round index as an integer>",
    "cast_id": "<deferred cast_id>",
    "summary": "<1 Korean sentence describing deferred motion>",
    "pressure_level": "<choose exactly one of low, medium, high>",
}

_STEP_DIRECTIVE_EXAMPLE: dict[str, Any] = {
    "round_index": "<copy the current round index as an integer>",
    "focus_summary": "<1 Korean sentence summarizing the direct focus for this round>",
    "reason": "<1 Korean sentence explaining why these actors were selected>",
    "selected_cast_ids": ["<cast_id selected for direct focus>"],
    "deferred_cast_ids": ["<cast_id deferred to background motion>"],
    "focus_slices": [
        {
            "slice_id": "<stable slice identifier>",
            "title": "<1 short Korean slice title>",
            "focus_cast_ids": ["<cast_id included in this slice>"],
            "visibility": "<choose exactly one of public, private, group>",
            "stakes": "<within 2 Korean sentences describing what is at stake>",
            "reason": "<1 Korean sentence explaining why this slice matters now>",
        }
    ],
    "background_updates": [_BACKGROUND_UPDATE_EXAMPLE],
}

_STEP_RESOLUTION_EXAMPLE: dict[str, Any] = {
    "adopted_cast_ids": ["<cast_id whose proposal was adopted>"],
    "intent_states": [
        {
            "cast_id": "<cast_id>",
            "goal": "<1 Korean sentence describing the current goal>",
            "target_cast_ids": ["<cast_id string or an empty list>"],
            "confidence": "<float between 0.0 and 1.0>",
            "changed_from_previous": "<true or false>",
        }
    ],
    "event_updates": [
        {
            "event_id": "<major event id>",
            "status": "<choose one of pending, in_progress, completed, missed>",
            "progress_summary": "<one Korean sentence describing the event progress>",
            "matched_activity_ids": ["<activity_id from this round or an empty list>"],
        }
    ],
    "time_advance": {
        "elapsed_unit": "<choose exactly one of minute, hour, day, week>",
        "elapsed_amount": "<positive integer greater than or equal to 1>",
        "reason": "<1 Korean sentence explaining the elapsed-time choice>",
    },
    "observer_report": {
        "round_index": "<copy the current round index as an integer>",
        "summary": "<1 Korean sentence summarizing the round outcome>",
        "notable_events": ["<1 Korean sentence about one notable event from this round>"],
        "atmosphere": "<1 short Korean atmosphere label>",
        "momentum": "<choose exactly one of high, medium, low>",
        "world_state_summary": "<1 Korean sentence describing the updated world state>",
    },
    "actor_facing_scenario_digest": {
        "round_index": "<copy the current round index as an integer>",
        "current_pressures": ["<1 Korean sentence about one pressure shaping the next action>"],
        "next_step_notes": ["<1 Korean sentence about one plausible next move or change>"],
        "world_state_summary": "<same summary string as the top-level world_state_summary>",
    },
    "world_state_summary": "<1 Korean sentence summarizing the global state after resolution>",
    "stop_reason": '<return "" to continue, or "simulation_done" when this round completes the simulation>',
}

_ROUND_RESOLUTION_CORE_EXAMPLE: dict[str, Any] = {
    "adopted_cast_ids": ["<cast_id whose proposal was adopted>"],
    "time_advance": {
        "elapsed_unit": "<choose exactly one of minute, hour, day, week>",
        "elapsed_amount": "<positive integer greater than or equal to 1>",
        "reason": "<1 Korean sentence explaining the elapsed-time choice>",
    },
    "world_state_summary": "<1 Korean sentence summarizing the global state after resolution>",
    "stop_reason": '<return "" to continue, or "simulation_done" when this round completes the simulation>',
}

_MAJOR_EVENT_UPDATE_EXAMPLE: dict[str, Any] = {
    "event_id": "<major event id>",
    "status": "<choose one of pending, in_progress, completed, missed>",
    "progress_summary": "<1 Korean sentence describing the event progress>",
    "matched_activity_ids": ["<activity_id from this round or an empty list>"],
}

_ACTOR_INTENT_STATE_EXAMPLE: dict[str, Any] = {
    "cast_id": "<cast_id>",
    "goal": "<1 Korean sentence describing the current goal>",
    "target_cast_ids": ["<cast_id string or an empty list>"],
    "confidence": "<float between 0.0 and 1.0>",
    "changed_from_previous": "<true or false>",
}

_ROUND_RESOLUTION_NARRATIVE_BODIES_EXAMPLE: dict[str, Any] = {
    "observer_report": {
        "summary": "<1 Korean sentence summarizing the round outcome>",
        "notable_events": ["<1 Korean sentence about one notable event from this round>"],
        "atmosphere": "<1 short Korean atmosphere label>",
        "momentum": "<choose exactly one of high, medium, low>",
    },
    "actor_facing_scenario_digest": {
        "current_pressures": ["<1 Korean sentence about one pressure shaping the next action>"],
        "next_step_notes": ["<1 Korean sentence about one plausible next move or change>"],
    },
}
