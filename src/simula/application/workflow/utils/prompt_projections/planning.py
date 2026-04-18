"""Planning, generation, and focus-selection prompt projections."""

from __future__ import annotations

from typing import cast

from simula.application.workflow.utils.prompt_projections.base import (
    DEFERRED_ACTOR_LIMIT,
    SHORT_DESCRIPTION_LIMIT,
    SHORT_GUIDANCE_LIMIT,
    compact_action_catalog_entry,
    compact_actor_reference,
    compact_channel_guidance,
    int_value,
    truncate_string_list,
    truncate_text,
)


def build_generation_interpretation_view(
    interpretation: dict[str, object],
) -> dict[str, object]:
    """generation prompt용 interpretation 축약본을 만든다."""

    return {
        "premise": truncate_text(interpretation.get("premise", ""), 160),
        "key_pressures": truncate_string_list(
            interpretation.get("key_pressures", []),
            limit=3,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
    }


def build_planning_interpretation_view(
    interpretation: dict[str, object],
) -> dict[str, object]:
    """planning 후반 prompt용 interpretation 축약본을 만든다."""

    time_scope = cast(dict[str, object], interpretation.get("time_scope", {}))
    compact_time_scope: dict[str, object] = {}
    if time_scope:
        compact_time_scope = {
            "start": truncate_text(time_scope.get("start", ""), 80),
            "end": truncate_text(time_scope.get("end", ""), 80),
        }
    return {
        "premise": truncate_text(interpretation.get("premise", ""), 180),
        "time_scope": compact_time_scope,
        "key_pressures": truncate_string_list(
            interpretation.get("key_pressures", []),
            limit=4,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
    }


def build_generation_situation_view(
    situation: dict[str, object],
) -> dict[str, object]:
    """generation prompt용 situation 축약본을 만든다."""

    return {
        "simulation_objective": truncate_text(
            situation.get("simulation_objective", ""),
            160,
        ),
        "world_summary": truncate_text(situation.get("world_summary", ""), 180),
        "initial_tensions": truncate_string_list(
            situation.get("initial_tensions", []),
            limit=3,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
    }


def build_planning_situation_view(
    situation: dict[str, object],
) -> dict[str, object]:
    """planning 후반 prompt용 situation 축약본을 만든다."""

    return {
        "simulation_objective": truncate_text(
            situation.get("simulation_objective", ""),
            180,
        ),
        "world_summary": truncate_text(situation.get("world_summary", ""), 220),
        "initial_tensions": truncate_string_list(
            situation.get("initial_tensions", []),
            limit=4,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
        "channel_guidance": compact_channel_guidance(
            situation.get("channel_guidance", {})
        ),
        "current_constraints": truncate_string_list(
            situation.get("current_constraints", []),
            limit=4,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
    }


def build_compact_action_catalog_view(
    action_catalog: dict[str, object],
    *,
    limit: int,
) -> dict[str, object]:
    """prompt용 compact action catalog를 만든다."""

    actions = []
    raw_actions = action_catalog.get("actions", [])
    if isinstance(raw_actions, list):
        actions = [
            compact_action_catalog_entry(item)
            for item in raw_actions[:limit]
            if isinstance(item, dict)
        ]
    return {
        "actions": actions,
    }


def build_planning_coordination_frame_view(
    coordination_frame: dict[str, object],
) -> dict[str, object]:
    """planning/generation 공용 coordination frame 축약본을 만든다."""

    return {
        "focus_policy": truncate_text(
            coordination_frame.get("focus_policy", ""),
            140,
        ),
        "background_policy": truncate_text(
            coordination_frame.get("background_policy", ""),
            140,
        ),
        "max_focus_actors": int_value(coordination_frame.get("max_focus_actors", 0)),
    }


def build_generation_coordination_frame_view(
    coordination_frame: dict[str, object],
) -> dict[str, object]:
    """generation prompt용 coordination frame 축약본을 만든다."""

    return build_planning_coordination_frame_view(coordination_frame)


def build_focus_candidates_prompt_view(
    focus_candidates: list[dict[str, object]],
) -> list[dict[str, object]]:
    """focus plan prompt용 후보 actor view를 만든다."""

    return [
        {
            "cast_id": str(item.get("cast_id", "")),
            "display_name": str(item.get("display_name", "")),
            "baseline_attention_tier": str(item.get("baseline_attention_tier", "")),
            "story_function": truncate_text(item.get("story_function", ""), 120),
            "candidate_score": item.get("candidate_score"),
            "unseen_count": int_value(item.get("unseen_count", 0)),
            "targeted_count": int_value(item.get("targeted_count", 0)),
            "thread_count": int_value(item.get("thread_count", 0)),
            "intent_shift": bool(item.get("intent_shift", False)),
            "background_pressure": item.get("background_pressure"),
        }
        for item in focus_candidates
    ]


def build_focus_plan_coordination_frame_view(
    coordination_frame: dict[str, object],
) -> dict[str, object]:
    """focus 계획용 coordination frame 축약본을 만든다."""

    return build_planning_coordination_frame_view(coordination_frame)


def build_focus_plan_situation_view(
    situation: dict[str, object],
) -> dict[str, object]:
    """focus 계획용 situation 축약본을 만든다."""

    return {
        "simulation_objective": truncate_text(
            situation.get("simulation_objective", ""),
            160,
        ),
        "world_summary": truncate_text(situation.get("world_summary", ""), 180),
        "initial_tensions": truncate_string_list(
            situation.get("initial_tensions", []),
            limit=3,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
        "channel_guidance": compact_channel_guidance(
            situation.get("channel_guidance", {})
        ),
        "current_constraints": truncate_string_list(
            situation.get("current_constraints", []),
            limit=3,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
    }


def build_deferred_actor_views(
    deferred_actors: list[dict[str, object]],
    *,
    limit: int = DEFERRED_ACTOR_LIMIT,
) -> list[dict[str, object]]:
    """background update prompt용 deferred actor 축약본을 만든다."""

    return [compact_actor_reference(item) for item in deferred_actors[:limit]]


def build_background_coordination_frame_view(
    coordination_frame: dict[str, object],
) -> dict[str, object]:
    """background update prompt용 coordination frame 축약본을 만든다."""

    return {
        "background_policy": truncate_text(
            coordination_frame.get("background_policy", ""),
            140,
        ),
    }
