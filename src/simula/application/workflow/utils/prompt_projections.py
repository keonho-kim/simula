"""목적:
- LLM prompt 입력용 compact projection 규칙을 제공한다.

설명:
- 풍부한 실행 상태와 저장 스키마는 유지하되, prompt에는 역할별 최소 정보만 넣도록
  공용 projection 함수를 모은다.

사용한 설계 패턴:
- prompt projection 유틸 패턴

연관된 다른 모듈/구조:
- simula.application.workflow.graphs.runtime.nodes
- simula.application.workflow.graphs.coordinator.nodes
- simula.application.workflow.graphs.generation.nodes
"""

from __future__ import annotations

from collections import Counter
from typing import Iterable, cast

ACTOR_VISIBLE_ACTOR_LIMIT = 6
ACTOR_ACTION_CONTEXT_LIMIT = 6
ACTOR_AVAILABLE_ACTION_LIMIT = 5
GENERATION_ACTION_LIMIT = 5
DEFERRED_ACTOR_LIMIT = 8
INTENT_STATE_LIMIT = 10
WORLD_STATE_SUMMARY_LIMIT = 220
PREVIOUS_SUMMARY_LIMIT = 160
LAST_FOCUS_SUMMARY_LIMIT = 120
ACTION_SUMMARY_LIMIT = 120
ACTION_DETAIL_LIMIT = 180
UTTERANCE_LIMIT = 120
EXPECTED_OUTCOME_LIMIT = 120
SHORT_GUIDANCE_LIMIT = 80
SHORT_DESCRIPTION_LIMIT = 100


def truncate_text(value: object, limit: int) -> str:
    """긴 텍스트를 prompt 예산에 맞게 줄인다."""

    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"


def build_actor_prompt_actor_view(actor: dict[str, object]) -> dict[str, object]:
    """actor prompt에 넣을 actor 카드 축약본을 만든다."""

    return {
        "actor_id": str(actor.get("actor_id", "")),
        "display_name": str(actor.get("display_name", "")),
        "role": str(actor.get("role", "")),
        "group_name": actor.get("group_name"),
        "public_profile": truncate_text(actor.get("public_profile", ""), 180),
        "private_goal": truncate_text(actor.get("private_goal", ""), 180),
        "speaking_style": truncate_text(actor.get("speaking_style", ""), 120),
        "baseline_attention_tier": str(actor.get("baseline_attention_tier", "")),
        "story_function": truncate_text(actor.get("story_function", ""), 120),
        "preferred_action_types": _string_list(actor.get("preferred_action_types", [])),
        "action_bias_notes": _truncate_string_list(
            actor.get("action_bias_notes", []),
            limit=2,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
    }


def build_actor_visible_actors_view(
    *,
    actors: list[dict[str, object]],
    actor_id: str,
    focus_slice: dict[str, object],
    current_intent_snapshot: dict[str, object],
    visible_action_context: list[dict[str, object]],
    selected_actor_ids: list[str],
    limit: int = ACTOR_VISIBLE_ACTOR_LIMIT,
) -> list[dict[str, object]]:
    """actor prompt에 넣을 상대 actor 목록을 우선순위 기준으로 줄인다."""

    actors_by_id = {
        str(actor.get("actor_id", "")): actor
        for actor in actors
        if str(actor.get("actor_id", "")).strip()
    }
    ordered_ids: list[str] = []
    candidate_sets = [
        [
            candidate
            for candidate in _string_list(focus_slice.get("focus_actor_ids", []))
            if candidate != actor_id
        ],
        [
            candidate
            for candidate in _string_list(
                current_intent_snapshot.get("target_actor_ids", [])
            )
            if candidate != actor_id
        ],
        _action_related_actor_ids(
            visible_action_context=visible_action_context,
            actor_id=actor_id,
        ),
        [candidate for candidate in selected_actor_ids if candidate != actor_id],
    ]
    for candidates in candidate_sets:
        for candidate in candidates:
            if candidate not in actors_by_id:
                continue
            if candidate in ordered_ids:
                continue
            ordered_ids.append(candidate)
            if len(ordered_ids) >= limit:
                return [
                    _compact_actor_reference(actors_by_id[item]) for item in ordered_ids
                ]
    return [_compact_actor_reference(actors_by_id[item]) for item in ordered_ids]


def build_visible_action_context(
    *,
    unread_visible_activities: list[dict[str, object]],
    recent_visible_activities: list[dict[str, object]],
    limit: int = ACTOR_ACTION_CONTEXT_LIMIT,
) -> tuple[list[dict[str, object]], dict[str, object]]:
    """actor prompt용 visible action context와 unread backlog digest를 만든다."""

    deduped_unread = _dedupe_activities(unread_visible_activities)
    deduped_recent = _dedupe_activities(recent_visible_activities)
    selected: list[dict[str, object]] = []
    seen_ids: set[str] = set()
    included_unread_count = 0

    for activity in deduped_unread:
        activity_id = _activity_key(activity)
        if activity_id in seen_ids:
            continue
        selected.append(_compact_action_digest(activity))
        seen_ids.add(activity_id)
        included_unread_count += 1
        if len(selected) >= limit:
            break

    if len(selected) < limit:
        for activity in deduped_recent:
            activity_id = _activity_key(activity)
            if activity_id in seen_ids:
                continue
            selected.append(_compact_action_digest(activity))
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
    world_state_summary: object,
    previous_observer_summary: object,
    previous_observer_momentum: object,
    previous_observer_atmosphere: object,
    channel_guidance: object,
    current_constraints: object,
    current_intent_snapshot: object,
    available_actions: list[dict[str, object]],
    action_selection_guidance: object,
) -> dict[str, object]:
    """actor prompt용 runtime guidance 축약본을 만든다."""

    return {
        "simulation_objective": truncate_text(simulation_objective, 160),
        "world_state_summary": truncate_text(
            world_state_summary,
            WORLD_STATE_SUMMARY_LIMIT,
        ),
        "previous_observer_summary": truncate_text(
            previous_observer_summary,
            PREVIOUS_SUMMARY_LIMIT,
        ),
        "previous_observer_momentum": str(previous_observer_momentum or "").strip(),
        "previous_observer_atmosphere": truncate_text(
            previous_observer_atmosphere,
            40,
        ),
        "channel_guidance": _compact_channel_guidance(channel_guidance),
        "current_constraints": _truncate_string_list(
            current_constraints,
            limit=3,
            text_limit=SHORT_GUIDANCE_LIMIT,
        ),
        "current_intent_snapshot": _compact_intent_snapshot(current_intent_snapshot),
        "available_actions": available_actions[:ACTOR_AVAILABLE_ACTION_LIMIT],
        "action_selection_guidance": _truncate_string_list(
            action_selection_guidance,
            limit=3,
            text_limit=SHORT_GUIDANCE_LIMIT,
        ),
    }


def build_actor_available_actions_view(
    *,
    matched_actions: list[dict[str, object]],
    fallback_actions: list[dict[str, object]],
    limit: int = ACTOR_AVAILABLE_ACTION_LIMIT,
) -> list[dict[str, object]]:
    """actor prompt용 available action 목록을 compact하게 만든다."""

    source = matched_actions if matched_actions else fallback_actions[:limit]
    compact = [_compact_action_option(item) for item in source]
    return compact[:limit]


def build_generation_interpretation_view(
    interpretation: dict[str, object],
) -> dict[str, object]:
    """generation prompt용 interpretation 축약본을 만든다."""

    return {
        "premise": truncate_text(interpretation.get("premise", ""), 160),
        "key_pressures": _truncate_string_list(
            interpretation.get("key_pressures", []),
            limit=3,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
        "public_context": _truncate_string_list(
            interpretation.get("public_context", []),
            limit=2,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
        "private_context": _truncate_string_list(
            interpretation.get("private_context", []),
            limit=2,
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
        "key_pressures": _truncate_string_list(
            interpretation.get("key_pressures", []),
            limit=4,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
        "public_context": _truncate_string_list(
            interpretation.get("public_context", []),
            limit=3,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
        "private_context": _truncate_string_list(
            interpretation.get("private_context", []),
            limit=3,
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
        "initial_tensions": _truncate_string_list(
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
        "initial_tensions": _truncate_string_list(
            situation.get("initial_tensions", []),
            limit=4,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
        "channel_guidance": _compact_channel_guidance(
            situation.get("channel_guidance", {})
        ),
        "current_constraints": _truncate_string_list(
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

    actions = [
        _compact_action_catalog_entry(item)
        for item in _dict_list(action_catalog.get("actions", []))[:limit]
    ]
    return {
        "actions": actions,
        "selection_guidance": _truncate_string_list(
            action_catalog.get("selection_guidance", []),
            limit=3,
            text_limit=SHORT_GUIDANCE_LIMIT,
        ),
    }


def build_planning_coordination_frame_view(
    coordination_frame: dict[str, object],
) -> dict[str, object]:
    """planning/generation 공용 coordination frame 축약본을 만든다."""

    return {
        "focus_selection_rules": _truncate_string_list(
            coordination_frame.get("focus_selection_rules", []),
            limit=2,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
        "background_motion_rules": _truncate_string_list(
            coordination_frame.get("background_motion_rules", []),
            limit=2,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
        "focus_archetypes": _truncate_string_list(
            coordination_frame.get("focus_archetypes", []),
            limit=3,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
        "attention_shift_rules": _truncate_string_list(
            coordination_frame.get("attention_shift_rules", []),
            limit=2,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
        "budget_guidance": _truncate_string_list(
            coordination_frame.get("budget_guidance", []),
            limit=2,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
    }


def build_generation_coordination_frame_view(
    coordination_frame: dict[str, object],
) -> dict[str, object]:
    """generation prompt용 coordination frame 축약본을 만든다."""

    compact = build_planning_coordination_frame_view(coordination_frame)
    return {
        "focus_archetypes": compact["focus_archetypes"],
        "attention_shift_rules": compact["attention_shift_rules"],
        "budget_guidance": compact["budget_guidance"],
    }


def build_focus_candidates_prompt_view(
    focus_candidates: list[dict[str, object]],
) -> list[dict[str, object]]:
    """focus plan prompt용 후보 actor view를 만든다."""

    return [
        {
            "actor_id": str(item.get("actor_id", "")),
            "display_name": str(item.get("display_name", "")),
            "baseline_attention_tier": str(item.get("baseline_attention_tier", "")),
            "story_function": truncate_text(item.get("story_function", ""), 120),
            "candidate_score": item.get("candidate_score"),
            "unseen_count": _int_value(item.get("unseen_count", 0)),
            "targeted_count": _int_value(item.get("targeted_count", 0)),
            "thread_count": _int_value(item.get("thread_count", 0)),
            "intent_shift": bool(item.get("intent_shift", False)),
            "background_pressure": item.get("background_pressure"),
        }
        for item in focus_candidates
    ]


def build_focus_plan_coordination_frame_view(
    coordination_frame: dict[str, object],
) -> dict[str, object]:
    """focus 계획용 coordination frame 축약본을 만든다."""

    return {
        "focus_selection_rules": _truncate_string_list(
            coordination_frame.get("focus_selection_rules", []),
            limit=2,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
        "attention_shift_rules": _truncate_string_list(
            coordination_frame.get("attention_shift_rules", []),
            limit=2,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
        "budget_guidance": _truncate_string_list(
            coordination_frame.get("budget_guidance", []),
            limit=1,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
    }


def build_focus_plan_situation_view(
    situation: dict[str, object],
) -> dict[str, object]:
    """focus 계획용 situation 축약본을 만든다."""

    return {
        "simulation_objective": truncate_text(
            situation.get("simulation_objective", ""),
            160,
        ),
        "initial_tensions": _truncate_string_list(
            situation.get("initial_tensions", []),
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

    return [_compact_actor_reference(item) for item in deferred_actors[:limit]]


def build_background_coordination_frame_view(
    coordination_frame: dict[str, object],
) -> dict[str, object]:
    """background update prompt용 coordination frame 축약본을 만든다."""

    return {
        "background_motion_rules": _truncate_string_list(
            coordination_frame.get("background_motion_rules", []),
            limit=3,
            text_limit=SHORT_DESCRIPTION_LIMIT,
        ),
    }


def build_relevant_intent_states(
    actor_intent_states: list[dict[str, object]],
    *,
    relevant_actor_ids: Iterable[str],
    limit: int = INTENT_STATE_LIMIT,
) -> list[dict[str, object]]:
    """prompt용 관련 actor intent subset을 만든다."""

    target_ids = [item for item in relevant_actor_ids if item]
    if not target_ids:
        return []
    selected: list[dict[str, object]] = []
    selected_ids: set[str] = set()
    target_set = set(target_ids)
    for snapshot in actor_intent_states:
        actor_id = str(snapshot.get("actor_id", ""))
        if actor_id not in target_set or actor_id in selected_ids:
            continue
        selected.append(_compact_intent_snapshot(snapshot))
        selected_ids.add(actor_id)
        if len(selected) >= limit:
            break
    return selected


def build_compact_pending_actor_proposals(
    pending_actor_proposals: list[dict[str, object]],
) -> list[dict[str, object]]:
    """adjudication prompt용 actor proposal 축약본을 만든다."""

    compact: list[dict[str, object]] = []
    for item in pending_actor_proposals:
        proposal = item.get("proposal", {})
        compact.append(
            {
                "actor_id": str(item.get("actor_id", "")),
                "forced_idle": bool(item.get("forced_idle", False)),
                "proposal": _compact_action_proposal_for_prompt(proposal),
            }
        )
    return compact


def build_progression_plan_prompt_view(
    progression_plan: dict[str, object],
) -> dict[str, object]:
    """prompt용 progression plan 축약본을 만든다."""

    return {
        "max_rounds": progression_plan.get("max_rounds"),
        "allowed_elapsed_units": _string_list(progression_plan.get("allowed_elapsed_units", [])),
        "default_elapsed_unit": progression_plan.get("default_elapsed_unit"),
    }


def build_compact_background_updates(
    background_updates: list[dict[str, object]],
) -> list[dict[str, object]]:
    """prompt용 background update 축약본을 만든다."""

    return [
        {
            "round_index": _int_value(item.get("round_index", 0)),
            "actor_id": str(item.get("actor_id", "")),
            "summary": truncate_text(item.get("summary", ""), 140),
            "pressure_level": str(item.get("pressure_level", "")),
            "future_hook": truncate_text(item.get("future_hook", ""), 120),
        }
        for item in background_updates
    ]


def build_prior_state_digest(
    *,
    observer_reports: list[dict[str, object]],
    world_state_summary: object,
    round_focus_history: list[dict[str, object]],
    simulation_clock: dict[str, object],
) -> dict[str, object]:
    """observer prompt용 직전 상태 digest를 만든다."""

    previous_summary = ""
    if observer_reports:
        previous_summary = str(observer_reports[-1].get("summary", ""))
    last_focus_summary = ""
    if round_focus_history:
        last_focus_summary = str(round_focus_history[-1].get("focus_summary", ""))
    return {
        "previous_observer_summary": truncate_text(
            previous_summary,
            PREVIOUS_SUMMARY_LIMIT,
        ),
        "previous_world_state_summary": truncate_text(
            world_state_summary,
            WORLD_STATE_SUMMARY_LIMIT,
        ),
        "last_focus_summary": truncate_text(
            last_focus_summary,
            LAST_FOCUS_SUMMARY_LIMIT,
        ),
        "simulation_clock_label": str(
            simulation_clock.get("total_elapsed_label", "0분")
        ),
    }


def _compact_actor_reference(actor: dict[str, object]) -> dict[str, object]:
    return {
        "actor_id": str(actor.get("actor_id", "")),
        "display_name": str(actor.get("display_name", "")),
        "role": truncate_text(actor.get("role", ""), 100),
        "group_name": actor.get("group_name"),
        "baseline_attention_tier": str(actor.get("baseline_attention_tier", "")),
        "story_function": truncate_text(actor.get("story_function", ""), 120),
    }


def _compact_action_digest(activity: dict[str, object]) -> dict[str, object]:
    return {
        "activity_id": str(activity.get("activity_id", "")),
        "round_index": _int_value(activity.get("round_index", 0)),
        "source_actor_id": str(activity.get("source_actor_id", "")),
        "target_actor_ids": _string_list(activity.get("target_actor_ids", [])),
        "visibility": str(activity.get("visibility", "")),
        "action_type": str(activity.get("action_type", "")),
        "action_summary": truncate_text(
            activity.get("action_summary", ""), ACTION_SUMMARY_LIMIT
        ),
        "utterance": _optional_truncated_text(
            activity.get("utterance"),
            UTTERANCE_LIMIT,
        ),
        "thread_id": _optional_string(activity.get("thread_id")),
    }


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
        "top_sources": _top_counter_values(
            Counter(
                str(item.get("source_actor_id", ""))
                for item in omitted_unread
                if str(item.get("source_actor_id", "")).strip()
            )
        ),
        "top_threads": _top_counter_values(
            Counter(
                str(item.get("thread_id", ""))
                for item in omitted_unread
                if str(item.get("thread_id", "")).strip()
            )
        ),
        "top_action_types": _top_counter_values(
            Counter(
                str(item.get("action_type", ""))
                for item in omitted_unread
                if str(item.get("action_type", "")).strip()
            )
        ),
    }


def _compact_channel_guidance(value: object) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    return {
        str(key): truncate_text(item, SHORT_DESCRIPTION_LIMIT)
        for key, item in value.items()
    }


def _compact_intent_snapshot(snapshot: object) -> dict[str, object]:
    if not isinstance(snapshot, dict):
        return {}
    dumped = cast(dict[str, object], snapshot)
    return {
        "actor_id": str(dumped.get("actor_id", "")),
        "current_intent": truncate_text(dumped.get("current_intent", ""), 140),
        "target_actor_ids": _string_list(dumped.get("target_actor_ids", [])),
        "supporting_action_type": str(dumped.get("supporting_action_type", "")),
        "confidence": dumped.get("confidence"),
        "changed_from_previous": bool(dumped.get("changed_from_previous", False)),
    }


def _compact_action_option(action: dict[str, object]) -> dict[str, object]:
    label = truncate_text(action.get("label", ""), 40)
    description = truncate_text(action.get("description", ""), SHORT_DESCRIPTION_LIMIT)
    usage_hint = label
    if description:
        usage_hint = f"{label}: {description}" if label else description
    return {
        "action_type": str(action.get("action_type", "")),
        "supported_visibility": _string_list(action.get("supported_visibility", [])),
        "requires_target": bool(action.get("requires_target", False)),
        "supports_utterance": bool(action.get("supports_utterance", False)),
        "usage_hint": usage_hint,
    }


def _compact_action_catalog_entry(action: dict[str, object]) -> dict[str, object]:
    return {
        "action_type": str(action.get("action_type", "")),
        "label": truncate_text(action.get("label", ""), 40),
        "description": truncate_text(
            action.get("description", ""), SHORT_DESCRIPTION_LIMIT
        ),
        "supported_visibility": _string_list(action.get("supported_visibility", [])),
        "requires_target": bool(action.get("requires_target", False)),
        "supports_utterance": bool(action.get("supports_utterance", False)),
    }


def _compact_action_proposal_for_prompt(proposal: object) -> dict[str, object]:
    if not isinstance(proposal, dict):
        return {}
    dumped = cast(dict[str, object], proposal)
    return {
        "action_type": str(dumped.get("action_type", "")),
        "intent": truncate_text(dumped.get("intent", ""), 140),
        "intent_target_actor_ids": _string_list(
            dumped.get("intent_target_actor_ids", [])
        ),
        "action_summary": truncate_text(
            dumped.get("action_summary", ""),
            ACTION_SUMMARY_LIMIT,
        ),
        "action_detail": truncate_text(
            dumped.get("action_detail", ""),
            ACTION_DETAIL_LIMIT,
        ),
        "utterance": _optional_truncated_text(dumped.get("utterance"), UTTERANCE_LIMIT),
        "visibility": str(dumped.get("visibility", "")),
        "target_actor_ids": _string_list(dumped.get("target_actor_ids", [])),
        "thread_id": _optional_string(dumped.get("thread_id")),
    }


def _action_related_actor_ids(
    *,
    visible_action_context: list[dict[str, object]],
    actor_id: str,
) -> list[str]:
    ordered_ids: list[str] = []
    for action in visible_action_context:
        source_actor_id = str(action.get("source_actor_id", ""))
        if (
            source_actor_id
            and source_actor_id != actor_id
            and source_actor_id not in ordered_ids
        ):
            ordered_ids.append(source_actor_id)
        for target_actor_id in _string_list(action.get("target_actor_ids", [])):
            if target_actor_id == actor_id or target_actor_id in ordered_ids:
                continue
            ordered_ids.append(target_actor_id)
    return ordered_ids


def _dedupe_activities(
    activities: list[dict[str, object]],
) -> list[dict[str, object]]:
    seen: set[str] = set()
    deduped: list[dict[str, object]] = []
    for activity in activities:
        activity_key = _activity_key(activity)
        if activity_key in seen:
            continue
        seen.add(activity_key)
        deduped.append(activity)
    return deduped


def _activity_key(activity: dict[str, object]) -> str:
    activity_id = str(activity.get("activity_id", "")).strip()
    if activity_id:
        return activity_id
    return "|".join(
        [
            str(activity.get("round_index", "")),
            str(activity.get("source_actor_id", "")),
            str(activity.get("action_type", "")),
            str(activity.get("thread_id", "")),
        ]
    )


def _top_counter_values(counter: Counter[str], *, limit: int = 3) -> list[str]:
    return [item for item, _ in counter.most_common(limit)]


def _truncate_string_list(
    value: object,
    *,
    limit: int,
    text_limit: int,
) -> list[str]:
    return [truncate_text(item, text_limit) for item in _string_list(value)[:limit]]


def _optional_string(value: object) -> str:
    text = str(value or "").strip()
    return text


def _optional_truncated_text(value: object, limit: int) -> str:
    text = str(value or "").strip()
    return truncate_text(text, limit) if text else ""


def _int_value(value: object) -> int:
    try:
        return int(str(value))
    except TypeError, ValueError:
        return 0


def _dict_list(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, object], item) for item in value if isinstance(item, dict)]


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value if str(item).strip()]
