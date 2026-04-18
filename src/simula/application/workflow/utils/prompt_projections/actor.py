"""Actor-turn prompt projections."""

from __future__ import annotations

from collections import Counter

from simula.application.workflow.utils.prompt_projections.base import (
    ACTOR_ACTION_CONTEXT_LIMIT,
    ACTOR_AVAILABLE_ACTION_LIMIT,
    ACTOR_VISIBLE_ACTOR_LIMIT,
    SHORT_DESCRIPTION_LIMIT,
    SHORT_GUIDANCE_LIMIT,
    WORLD_STATE_SUMMARY_LIMIT,
    action_related_actor_ids,
    compact_action_digest,
    compact_action_option,
    compact_actor_facing_scenario_digest,
    compact_actor_reference,
    compact_channel_guidance,
    compact_intent_snapshot,
    dedupe_activities,
    string_list,
    top_counter_values,
    truncate_string_list,
    truncate_text,
)


def build_actor_prompt_actor_view(actor: dict[str, object]) -> dict[str, object]:
    """actor prompt에 넣을 actor 카드 축약본을 만든다."""

    return {
        "cast_id": str(actor.get("cast_id", "")),
        "display_name": str(actor.get("display_name", "")),
        "role": str(actor.get("role", "")),
        "group_name": actor.get("group_name"),
        "public_profile": truncate_text(actor.get("public_profile", ""), 180),
        "private_goal": truncate_text(actor.get("private_goal", ""), 180),
        "speaking_style": truncate_text(actor.get("speaking_style", ""), 120),
        "baseline_attention_tier": str(actor.get("baseline_attention_tier", "")),
        "story_function": truncate_text(actor.get("story_function", ""), 120),
        "preferred_action_types": string_list(actor.get("preferred_action_types", [])),
        "action_bias_notes": truncate_string_list(
            actor.get("action_bias_notes", []),
            limit=2,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
    }


def build_actor_visible_actors_view(
    *,
    actors: list[dict[str, object]],
    cast_id: str,
    focus_slice: dict[str, object],
    goal_snapshot: dict[str, object],
    visible_action_context: list[dict[str, object]],
    selected_cast_ids: list[str],
    limit: int = ACTOR_VISIBLE_ACTOR_LIMIT,
) -> list[dict[str, object]]:
    """actor prompt에 넣을 상대 actor 목록을 우선순위 기준으로 줄인다."""

    actors_by_id = {
        str(actor.get("cast_id", "")): actor
        for actor in actors
        if str(actor.get("cast_id", "")).strip()
    }
    ordered_ids: list[str] = []
    candidate_sets = [
        [
            candidate
            for candidate in string_list(focus_slice.get("focus_cast_ids", []))
            if candidate != cast_id
        ],
        [
            candidate
            for candidate in string_list(goal_snapshot.get("target_cast_ids", []))
            if candidate != cast_id
        ],
        action_related_actor_ids(
            visible_action_context=visible_action_context,
            cast_id=cast_id,
        ),
        [candidate for candidate in selected_cast_ids if candidate != cast_id],
    ]
    for candidates in candidate_sets:
        for candidate in candidates:
            if candidate not in actors_by_id or candidate in ordered_ids:
                continue
            ordered_ids.append(candidate)
            if len(ordered_ids) >= limit:
                return [
                    compact_actor_reference(actors_by_id[item]) for item in ordered_ids
                ]
    return [compact_actor_reference(actors_by_id[item]) for item in ordered_ids]


def build_visible_action_context(
    *,
    unread_visible_activities: list[dict[str, object]],
    recent_visible_activities: list[dict[str, object]],
    limit: int = ACTOR_ACTION_CONTEXT_LIMIT,
) -> tuple[list[dict[str, object]], dict[str, object]]:
    """actor prompt용 visible action context와 unread backlog digest를 만든다."""

    deduped_unread = dedupe_activities(unread_visible_activities)
    deduped_recent = dedupe_activities(recent_visible_activities)
    selected: list[dict[str, object]] = []
    seen_ids: set[str] = set()
    included_unread_count = 0

    for activity in deduped_unread:
        activity_id = str(activity.get("activity_id", "")) or repr(activity)
        if activity_id in seen_ids:
            continue
        selected.append(compact_action_digest(activity))
        seen_ids.add(activity_id)
        included_unread_count += 1
        if len(selected) >= limit:
            break

    if len(selected) < limit:
        for activity in deduped_recent:
            activity_id = str(activity.get("activity_id", "")) or repr(activity)
            if activity_id in seen_ids:
                continue
            selected.append(compact_action_digest(activity))
            seen_ids.add(activity_id)
            if len(selected) >= limit:
                break

    omitted_unread = deduped_unread[included_unread_count:]
    digest = _build_unread_backlog_digest(
        unread_visible_activities=deduped_unread,
        omitted_unread=omitted_unread,
    )
    return selected, digest


def build_actor_runtime_guidance_view(
    *,
    simulation_objective: object,
    scenario_premise: object,
    key_pressures: object,
    world_state_summary: object,
    previous_observer_summary: object,
    previous_observer_momentum: object,
    previous_observer_atmosphere: object,
    actor_facing_scenario_digest: object,
    channel_guidance: object,
    current_constraints: object,
    goal_snapshot: object,
    available_actions: list[dict[str, object]],
) -> dict[str, object]:
    """actor prompt용 runtime guidance 축약본을 만든다."""

    return {
        "simulation_objective": truncate_text(simulation_objective, 160),
        "scenario_premise": truncate_text(scenario_premise, 160),
        "key_pressures": truncate_string_list(
            key_pressures,
            limit=3,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
        "world_state_summary": truncate_text(
            world_state_summary,
            WORLD_STATE_SUMMARY_LIMIT,
        ),
        "previous_observer_summary": truncate_text(
            previous_observer_summary,
            160,
        ),
        "previous_observer_momentum": str(previous_observer_momentum or "").strip(),
        "previous_observer_atmosphere": truncate_text(
            previous_observer_atmosphere,
            40,
        ),
        "actor_facing_scenario_digest": compact_actor_facing_scenario_digest(
            actor_facing_scenario_digest
        ),
        "channel_guidance": compact_channel_guidance(channel_guidance),
        "current_constraints": truncate_string_list(
            current_constraints,
            limit=3,
            text_limit=SHORT_GUIDANCE_LIMIT,
        ),
        "goal_snapshot": compact_intent_snapshot(goal_snapshot),
        "available_actions": available_actions[:ACTOR_AVAILABLE_ACTION_LIMIT],
    }


def build_actor_available_actions_view(
    *,
    matched_actions: list[dict[str, object]],
    fallback_actions: list[dict[str, object]],
    limit: int = ACTOR_AVAILABLE_ACTION_LIMIT,
) -> list[dict[str, object]]:
    """actor prompt용 available action 목록을 compact하게 만든다."""

    source = matched_actions if matched_actions else fallback_actions[:limit]
    compact = [compact_action_option(item) for item in source]
    return compact[:limit]


def _build_unread_backlog_digest(
    *,
    unread_visible_activities: list[dict[str, object]],
    omitted_unread: list[dict[str, object]],
) -> dict[str, object]:
    unread_count = len(unread_visible_activities)
    omitted_count = len(omitted_unread)
    if unread_count == 0 or omitted_count == 0:
        return {}
    return {
        "unread_count": unread_count,
        "omitted_count": omitted_count,
        "top_sources": top_counter_values(
            Counter(
                str(item.get("source_cast_id", ""))
                for item in omitted_unread
                if str(item.get("source_cast_id", "")).strip()
            )
        ),
        "top_threads": top_counter_values(
            Counter(
                str(item.get("thread_id", ""))
                for item in omitted_unread
                if str(item.get("thread_id", "")).strip()
            )
        ),
        "top_action_types": top_counter_values(
            Counter(
                str(item.get("action_type", ""))
                for item in omitted_unread
                if str(item.get("action_type", "")).strip()
            )
        ),
    }
