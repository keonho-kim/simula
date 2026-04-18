"""Purpose:
- Provide compact planning prompt examples.
"""

from __future__ import annotations

from typing import Any

from simula.shared.prompts.output_schema_utils import (
    ExampleMode,
    build_object_prompt_bundle,
    build_simple_array_prompt_bundle,
)


def build_planning_analysis_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_object_prompt_bundle(
        example=_PLANNING_ANALYSIS_EXAMPLE,
        example_mode=example_mode,
    )


def build_cast_roster_outline_prompt_bundle(
    *,
    num_cast: int,
    allow_additional_cast: bool,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    bundle = build_simple_array_prompt_bundle(
        example_item=_CAST_ROSTER_OUTLINE_ITEM_EXAMPLE,
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
    return build_object_prompt_bundle(
        example=_EXECUTION_PLAN_FRAME_EXAMPLE,
        example_mode=example_mode,
    )


def build_situation_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_object_prompt_bundle(
        example=_SITUATION_EXAMPLE,
        example_mode=example_mode,
    )


def build_action_catalog_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_object_prompt_bundle(
        example=_ACTION_CATALOG_EXAMPLE,
        example_mode=example_mode,
    )


def build_coordination_frame_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_object_prompt_bundle(
        example=_COORDINATION_FRAME_EXAMPLE,
        example_mode=example_mode,
    )


def build_major_event_plan_batch_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_simple_array_prompt_bundle(
        example_item=_MAJOR_EVENT_PLAN_ITEM_EXAMPLE,
        example_mode=example_mode,
    )


def build_plan_cast_chunk_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_object_prompt_bundle(
        example=_PLAN_CAST_CHUNK_EXAMPLE,
        example_mode=example_mode,
    )


_PLANNING_ANALYSIS_EXAMPLE: dict[str, Any] = {
    "brief_summary": "<1 concise Korean sentence grounded only in the scenario text, within 25 words>",
    "premise": "<1 Korean sentence explaining the core scenario premise>",
    "time_scope": {
        "start": "<1 short scenario-grounded start point phrase>",
        "end": "<1 short scenario-grounded end point phrase>",
    },
    "key_pressures": ["<1 Korean sentence about one key pressure stated or strongly implied by the scenario>"],
    "progression_plan": {
        "max_rounds": 1,
        "allowed_elapsed_units": [
            "<choose one or more of minute, hour, day, week>",
        ],
        "default_elapsed_unit": "<choose exactly one of minute, hour, day, week>",
        "reason": "<1 Korean sentence explaining why the elapsed-time units fit this scenario>",
    },
}

_CAST_ROSTER_OUTLINE_ITEM_EXAMPLE: dict[str, Any] = {
    "slot_index": 1,
    "cast_id": "<stable snake_case or kebab-case cast identifier>",
    "display_name": "<1 short participant name or role label grounded in the scenario>",
}

_SITUATION_EXAMPLE: dict[str, Any] = {
    "simulation_objective": "<1 Korean sentence describing what the simulation should resolve>",
    "world_summary": "<1 Korean sentence summarizing the world and current state>",
    "initial_tensions": [
        "<1 Korean sentence about one initial tension grounded in the scenario>",
    ],
    "channel_guidance": {
        "public": "<1 Korean sentence on how public actions should be used in this scenario>",
        "private": "<1 Korean sentence on how private actions should be used in this scenario>",
        "group": "<1 Korean sentence on how group actions should be used in this scenario>",
    },
    "current_constraints": [
        "<1 Korean sentence about one current operational or narrative constraint>",
    ],
}

_ACTION_CATALOG_EXAMPLE: dict[str, Any] = {
    "actions": [
        {
            "action_type": "<short snake_case action identifier>",
            "label": "<1 short Korean action label>",
            "description": "<1 Korean sentence describing the action>",
            "supported_visibility": [
                "<choose one or more of public, private, group>",
            ],
            "requires_target": False,
        },
    ],
}

_COORDINATION_FRAME_EXAMPLE: dict[str, Any] = {
    "focus_policy": "<1 Korean sentence for selecting focus actors>",
    "background_policy": "<1 Korean sentence for background-only motion>",
    "max_focus_actors": 3,
}

_MAJOR_EVENT_PLAN_ITEM_EXAMPLE: dict[str, Any] = {
    "event_id": "<stable snake_case or kebab-case event identifier>",
    "title": "<1 short Korean title for a major scenario event>",
    "summary": "<1 Korean sentence describing what this event means>",
    "participant_cast_ids": ["<cast_id involved in this event>"],
    "earliest_round": 1,
    "latest_round": 2,
    "completion_action_types": ["<action_type that can complete this event>"],
    "completion_signals": ["<1 short Korean sentence or phrase that signals completion>"],
    "must_resolve": False,
}

_EXECUTION_PLAN_FRAME_EXAMPLE: dict[str, Any] = {
    "situation": _SITUATION_EXAMPLE,
    "action_catalog": _ACTION_CATALOG_EXAMPLE,
    "coordination_frame": _COORDINATION_FRAME_EXAMPLE,
    "major_events": [_MAJOR_EVENT_PLAN_ITEM_EXAMPLE],
}

_PLAN_CAST_CHUNK_EXAMPLE: dict[str, Any] = {
    "items": [
        {
            "cast_id": "<stable snake_case or kebab-case cast identifier>",
            "display_name": "<1 short participant name or role label grounded in the scenario>",
            "role_hint": "<1 short Korean role hint>",
            "group_name": "<1 short team, camp, faction, or participant group name>",
            "core_tension": "<1 Korean sentence describing this actor's core tension>",
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
