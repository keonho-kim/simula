"""Default proposal and selection helpers for actor turns."""

from __future__ import annotations

from typing import Any, cast

from simula.domain.contracts import ActorActionNarrative, ActorActionProposal, ActorActionShell


def assemble_actor_action_proposal(
    *,
    shell: ActorActionShell,
    narrative: ActorActionNarrative,
) -> ActorActionProposal:
    return ActorActionProposal(
        action_type=shell.action_type,
        goal=narrative.goal,
        summary=narrative.summary,
        detail=narrative.detail,
        utterance=narrative.utterance,
        visibility=shell.visibility,
        target_cast_ids=list(shell.target_cast_ids),
    )


def build_default_action_proposal(
    *,
    actor: dict[str, Any],
    visible_actors: list[dict[str, object]],
    runtime_guidance: dict[str, object],
) -> dict[str, object]:
    available_actions = [
        cast(dict[str, object], item)
        for item in object_list(runtime_guidance.get("available_actions", []))
        if isinstance(item, dict)
    ]
    cast_id = str(actor.get("cast_id", ""))
    target_cast_ids = default_target_cast_ids(
        cast_id=cast_id,
        visible_actors=visible_actors,
        runtime_guidance=runtime_guidance,
    )
    selected_action = select_default_action(
        available_actions,
        has_targets=bool(target_cast_ids),
    )
    supported_visibility = string_list(selected_action.get("supported_visibility"))
    target_cast_ids = clamp_target_cast_ids_for_action(
        target_cast_ids,
        selected_action=selected_action,
    )
    visibility = select_default_visibility(
        supported_visibility=supported_visibility,
        has_targets=bool(target_cast_ids),
    )
    intent_snapshot = cast(
        dict[str, object],
        runtime_guidance.get("goal_snapshot", {}),
    )
    goal = fallback_non_empty_text(
        intent_snapshot.get("goal"),
        "현재 상황을 조금 더 파악한다.",
    )
    digest = cast(
        dict[str, object],
        runtime_guidance.get("actor_facing_scenario_digest", {}),
    )
    next_step_notes = string_list(digest.get("next_step_notes", []))
    summary = "이번 단계에는 즉시 큰 움직임보다 상황 파악에 집중한다."
    detail = (
        "지금 단계에서는 급하게 새로운 조치를 밀어붙이기보다, 현재 action 흐름과 상대 반응을 더 살핀다."
    )
    if next_step_notes:
        summary = f"이번 단계에는 {next_step_notes[0]} 방향으로 반응을 정리한다."
    return {
        "action_type": fallback_non_empty_text(
            selected_action.get("action_type"),
            "observe",
        ),
        "goal": goal,
        "summary": summary,
        "detail": detail,
        "utterance": "",
        "visibility": visibility,
        "target_cast_ids": target_cast_ids,
    }


def build_default_action_shell(
    *,
    actor: dict[str, Any],
    visible_actors: list[dict[str, object]],
    runtime_guidance: dict[str, object],
) -> dict[str, object]:
    available_actions = [
        cast(dict[str, object], item)
        for item in object_list(runtime_guidance.get("available_actions", []))
        if isinstance(item, dict)
    ]
    cast_id = str(actor.get("cast_id", ""))
    target_cast_ids = default_target_cast_ids(
        cast_id=cast_id,
        visible_actors=visible_actors,
        runtime_guidance=runtime_guidance,
    )
    selected_action = select_default_action(
        available_actions,
        has_targets=bool(target_cast_ids),
    )
    supported_visibility = string_list(selected_action.get("supported_visibility"))
    target_cast_ids = clamp_target_cast_ids_for_action(
        target_cast_ids,
        selected_action=selected_action,
    )
    visibility = select_default_visibility(
        supported_visibility=supported_visibility,
        has_targets=bool(target_cast_ids),
    )
    return {
        "action_type": fallback_non_empty_text(
            selected_action.get("action_type"),
            "observe",
        ),
        "visibility": visibility,
        "target_cast_ids": target_cast_ids,
    }


def build_default_action_narrative(
    *,
    runtime_guidance: dict[str, object],
    shell: ActorActionShell,
) -> dict[str, object]:
    intent_snapshot = cast(
        dict[str, object],
        runtime_guidance.get("goal_snapshot", {}),
    )
    goal = fallback_non_empty_text(
        intent_snapshot.get("goal"),
        "현재 상황을 조금 더 파악한다.",
    )
    digest = cast(
        dict[str, object],
        runtime_guidance.get("actor_facing_scenario_digest", {}),
    )
    next_step_notes = string_list(digest.get("next_step_notes", []))
    summary = "이번 단계에는 즉시 큰 움직임보다 상황 파악에 집중한다."
    detail = (
        "지금 단계에서는 급하게 새로운 조치를 밀어붙이기보다, 현재 action 흐름과 상대 반응을 더 살핀다."
    )
    if next_step_notes:
        summary = f"이번 단계에는 {next_step_notes[0]} 방향으로 반응을 정리한다."
    return {
        "goal": goal,
        "summary": summary,
        "detail": detail,
        "utterance": "",
    }


def action_spec_by_type(
    *,
    available_actions: list[dict[str, object]],
    action_type: str,
) -> dict[str, object]:
    for action in available_actions:
        if str(action.get("action_type", "")).strip() == action_type:
            return dict(action)
    return {
        "action_type": action_type,
        "supported_visibility": ["public"],
        "requires_target": False,
    }


def select_default_action(
    available_actions: list[dict[str, object]],
    *,
    has_targets: bool,
) -> dict[str, object]:
    if not has_targets:
        for action in available_actions:
            if supports_solo_private_action(action):
                return action
        for action in available_actions:
            if supports_solo_public_action(action):
                return action
    for action in available_actions:
        if not bool(action.get("requires_target")):
            return action
    if available_actions:
        return available_actions[0]
    return {
        "action_type": "observe",
        "supported_visibility": ["public"],
        "requires_target": False,
    }


def select_default_visibility(
    *,
    supported_visibility: list[str],
    has_targets: bool,
) -> str:
    if has_targets:
        for visibility in ("private", "group", "public"):
            if visibility in supported_visibility:
                return visibility
    if "private" in supported_visibility:
        return "private"
    if "public" in supported_visibility:
        return "public"
    if "group" in supported_visibility:
        return "group"
    return "public"


def supports_solo_private_action(action: dict[str, object]) -> bool:
    return (
        not bool(action.get("requires_target"))
        and "private" in string_list(action.get("supported_visibility"))
    )


def supports_solo_public_action(action: dict[str, object]) -> bool:
    return (
        not bool(action.get("requires_target"))
        and "public" in string_list(action.get("supported_visibility"))
    )


def default_target_cast_ids(
    *,
    cast_id: str,
    visible_actors: list[dict[str, object]],
    runtime_guidance: dict[str, object],
) -> list[str]:
    intent_snapshot = cast(
        dict[str, object],
        runtime_guidance.get("goal_snapshot", {}),
    )
    intent_targets = [
        candidate
        for candidate in string_list(intent_snapshot.get("target_cast_ids", []))
        if candidate and candidate != cast_id
    ]
    if intent_targets:
        return intent_targets[:1]

    focus_slice = cast(dict[str, object], runtime_guidance.get("focus_slice", {}))
    focus_targets = [
        candidate
        for candidate in string_list(focus_slice.get("focus_cast_ids", []))
        if candidate and candidate != cast_id
    ]
    if focus_targets:
        return focus_targets[:1]

    visible_target_ids = [
        str(candidate.get("cast_id", ""))
        for candidate in visible_actors
        if str(candidate.get("cast_id", "")).strip()
        and str(candidate.get("cast_id", "")) != cast_id
    ]
    if visible_target_ids:
        return visible_target_ids[:1]
    return []


def object_list(value: object) -> list[object]:
    if not isinstance(value, list):
        return []
    return list(value)


def string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]


def fallback_non_empty_text(value: object, default: str) -> str:
    text = str(value or "").strip()
    if text:
        return text
    return default


def clamp_target_cast_ids_for_action(
    target_cast_ids: list[str],
    *,
    selected_action: dict[str, object],
) -> list[str]:
    del selected_action
    return list(target_cast_ids[:2])
