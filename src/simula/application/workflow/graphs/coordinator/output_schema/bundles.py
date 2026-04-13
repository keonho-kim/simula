"""Purpose:
- Provide compact coordinator prompt examples.
"""

from __future__ import annotations

from typing import Any

from simula.prompts.shared.output_schema_utils import ExampleMode, build_json_prompt_bundle


def build_round_directive_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_STEP_DIRECTIVE_EXAMPLE,
        example_mode=example_mode,
    )


def build_round_resolution_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_STEP_RESOLUTION_EXAMPLE,
        example_mode=example_mode,
    )


_STEP_DIRECTIVE_EXAMPLE: dict[str, Any] = {
    "round_index": "<copy the current round index as an integer>",
    "focus_summary": "<one Korean sentence summarizing the direct focus for this round>",
    "selection_reason": "<one Korean sentence explaining why these actors were selected>",
    "selected_actor_ids": ["<actor_id selected for direct focus>"],
    "deferred_actor_ids": ["<actor_id deferred to background motion>"],
    "focus_slices": [
        {
            "slice_id": "<stable slice identifier>",
            "title": "<short Korean slice title>",
            "focus_actor_ids": ["<actor_id included in this slice>"],
            "visibility": "<choose exactly one of public, private, group>",
            "stakes": "<one Korean sentence describing what is at stake>",
            "selection_reason": "<one Korean sentence explaining why this slice matters now>",
        }
    ],
    "background_updates": [
        {
            "round_index": "<copy the current round index as an integer>",
            "actor_id": "<deferred actor_id>",
            "summary": "<one Korean sentence describing deferred motion>",
            "pressure_level": "<choose exactly one of low, medium, high>",
            "future_hook": "<one Korean sentence describing a plausible next hook>",
        }
    ],
}

_STEP_RESOLUTION_EXAMPLE: dict[str, Any] = {
    "adopted_actor_ids": ["<actor_id whose proposal was adopted>"],
    "updated_intent_states": [
        {
            "actor_id": "<actor_id>",
            "current_intent": "<one Korean sentence describing the current intent>",
            "target_actor_ids": ["<actor_id string or an empty list>"],
            "supporting_action_type": "<action_type string>",
            "confidence": "<float between 0.0 and 1.0>",
            "changed_from_previous": "<true or false>",
        }
    ],
    "round_time_advance": {
        "elapsed_unit": "<choose exactly one of minute, hour, day, week>",
        "elapsed_amount": "<positive integer greater than or equal to 1>",
        "selection_reason": "<one Korean sentence explaining the elapsed-time choice>",
        "signals": ["<one Korean signal that supports the elapsed-time choice>"],
    },
    "observer_report": {
        "round_index": "<copy the current round index as an integer>",
        "summary": "<one Korean sentence summarizing the round outcome>",
        "notable_events": ["<one notable event from this round>"],
        "atmosphere": "<short Korean atmosphere label>",
        "momentum": "<choose exactly one of high, medium, low>",
        "world_state_summary": "<one Korean sentence describing the updated world state>",
    },
    "world_state_summary": "<one Korean sentence summarizing the global state after resolution>",
    "stop_reason": "<empty string to continue, or a short Korean stop reason>",
}
