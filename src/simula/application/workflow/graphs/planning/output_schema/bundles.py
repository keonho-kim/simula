"""Purpose:
- Provide compact planning prompt examples.
"""

from __future__ import annotations

from typing import Any

from simula.prompts.shared.output_schema_utils import ExampleMode, build_json_prompt_bundle


def build_planning_analysis_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_PLANNING_ANALYSIS_EXAMPLE,
        example_mode=example_mode,
    )


def build_cast_roster_outline_prompt_bundle(
    *,
    num_cast: int,
    allow_additional_cast: bool,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    bundle = build_json_prompt_bundle(
        example=_CAST_ROSTER_OUTLINE_EXAMPLE,
        example_mode=example_mode,
    )
    bundle["cast_roster_policy"] = _build_cast_roster_policy_text(
        num_cast=num_cast,
        allow_additional_cast=allow_additional_cast,
    )
    return bundle


def build_execution_plan_frame_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_EXECUTION_PLAN_FRAME_EXAMPLE,
        example_mode=example_mode,
    )


def build_plan_cast_chunk_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_PLAN_CAST_CHUNK_EXAMPLE,
        example_mode=example_mode,
    )


_PLANNING_ANALYSIS_EXAMPLE: dict[str, Any] = {
    "brief_summary": "<one concise Korean summary grounded only in the scenario text>",
    "premise": "<one Korean sentence explaining the core scenario premise>",
    "time_scope": {
        "start": "<scenario-grounded start point>",
        "end": "<scenario-grounded end point>",
    },
    "public_context": ["<one public-facing pressure or interaction pattern>"],
    "private_context": ["<one private coordination or hidden-pressure pattern>"],
    "key_pressures": ["<one key pressure stated or strongly implied by the scenario>"],
    "progression_plan": {
        "max_rounds": 1,
        "allowed_elapsed_units": [
            "<choose one or more of minute, hour, day, week>",
        ],
        "default_elapsed_unit": "<choose exactly one of minute, hour, day, week>",
        "pacing_guidance": [
            "<one Korean sentence describing how elapsed time should move between rounds>",
        ],
        "selection_reason": "<one Korean sentence explaining why the elapsed-time units fit this scenario>",
    },
}

_CAST_ROSTER_OUTLINE_EXAMPLE: dict[str, Any] = {
    "items": [
        {
            "slot_index": 1,
            "cast_id": "<stable snake_case or kebab-case cast identifier>",
            "display_name": "<participant name or role label grounded in the scenario>",
        }
    ]
}

_EXECUTION_PLAN_FRAME_EXAMPLE: dict[str, Any] = {
    "situation": {
        "simulation_objective": "<one Korean sentence describing what the simulation should resolve>",
        "world_summary": "<one Korean sentence summarizing the world and current state>",
        "initial_tensions": [
            "<one initial tension grounded in the scenario>",
        ],
        "channel_guidance": {
            "public": "<how public actions should be used in this scenario>",
            "private": "<how private actions should be used in this scenario>",
            "group": "<how group actions should be used in this scenario>",
        },
        "current_constraints": [
            "<one current operational or narrative constraint>",
        ],
    },
    "action_catalog": {
        "actions": [
            {
                "action_type": "<short snake_case action identifier>",
                "label": "<short Korean action label>",
                "description": "<one Korean sentence describing the action>",
                "supported_visibility": [
                    "<choose one or more of public, private, group>",
                ],
                "requires_target": False,
                "supports_utterance": True,
            },
        ],
        "selection_guidance": [
            "<one Korean sentence for how to choose from the action catalog>",
        ],
    },
    "coordination_frame": {
        "focus_selection_rules": [
            "<one Korean rule for selecting focus actors>",
        ],
        "background_motion_rules": [
            "<one Korean rule for background-only motion>",
        ],
        "focus_archetypes": [
            "<one short Korean focus archetype label>",
        ],
        "attention_shift_rules": [
            "<one Korean rule for changing who gets attention>",
        ],
        "budget_guidance": [
            "<one Korean rule for direct-call budget per round>",
        ],
    },
    "major_events": [
        {
            "event_id": "<stable snake_case or kebab-case event identifier>",
            "title": "<short Korean title for a major scenario event>",
            "summary": "<one Korean sentence describing what this event means>",
            "participant_cast_ids": ["<cast_id involved in this event>"],
            "earliest_round": 1,
            "latest_round": 2,
            "completion_action_types": ["<action_type that can complete this event>"],
            "completion_signals": ["<one short Korean phrase that signals completion>"],
            "required_before_end": False,
        }
    ],
}

_PLAN_CAST_CHUNK_EXAMPLE: dict[str, Any] = {
    "items": [
        {
            "cast_id": "<stable snake_case or kebab-case cast identifier>",
            "display_name": "<participant name or role label grounded in the scenario>",
            "role_hint": "<short Korean role hint>",
            "group_name": "<team, camp, faction, or participant group name>",
            "core_tension": "<one Korean sentence describing this actor's core tension>",
        }
    ]
}


def _build_cast_roster_policy_text(
    *,
    num_cast: int,
    allow_additional_cast: bool,
) -> str:
    if allow_additional_cast:
        return (
            f"- `num_cast` is {num_cast}.\n"
            "- `allow_additional_cast` is true.\n"
            f"- Include at least {num_cast} cast entries in `items`.\n"
            "- Prefer named or clearly implied scenario participants first.\n"
            "- You may add more cast entries only if the scenario structure genuinely needs them."
        )
    return (
        f"- `num_cast` is {num_cast}.\n"
        "- `allow_additional_cast` is false.\n"
        f"- Include exactly {num_cast} cast entries in `items`.\n"
        "- Prefer named or clearly implied scenario participants first.\n"
        "- Do not add extra cast entries beyond the requested count."
    )
