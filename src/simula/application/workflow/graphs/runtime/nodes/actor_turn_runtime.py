"""Runtime context and semantic helpers for actor turns."""

from __future__ import annotations

from typing import Any, cast

from simula.application.workflow.graphs.runtime.proposal_contract import (
    validate_actor_action_narrative_semantics,
    validate_actor_action_shell_semantics,
)
from simula.application.workflow.graphs.runtime.proposal_semantics import (
    normalize_actor_action_proposal,
)
from simula.application.workflow.utils.prompt_projections import (
    build_actor_available_actions_view,
    build_actor_runtime_guidance_view,
)
from simula.domain.contracts import ActionCatalog, ActorActionProposal, ActorActionShell
from simula.domain.reporting.reports import latest_observer_summary


def normalize_actor_action_shell(
    *,
    shell: ActorActionShell,
    source_cast_id: str,
    visible_actors: list[dict[str, object]],
    visible_action_context: list[dict[str, object]],
    goal_snapshot: dict[str, object],
) -> ActorActionShell:
    normalized = normalize_actor_action_proposal(
        proposal=ActorActionProposal(
            action_type=shell.action_type,
            goal="shell normalization",
            summary="shell normalization",
            detail="shell normalization",
            utterance="",
            visibility=shell.visibility,
            target_cast_ids=list(shell.target_cast_ids),
        ),
        source_cast_id=source_cast_id,
        visible_actors=visible_actors,
        goal_snapshot=goal_snapshot,
    )
    return ActorActionShell(
        action_type=normalized.action_type,
        visibility=normalized.visibility,
        target_cast_ids=list(normalized.target_cast_ids),
    )


def build_runtime_guidance(
    *,
    state,
    cast_id: str,
    action_catalog: ActionCatalog,
    goal_snapshot: dict[str, object],
) -> dict[str, object]:
    situation = cast(dict[str, object], state.get("plan", {}).get("situation", {}))
    interpretation = cast(
        dict[str, object],
        state.get("plan", {}).get("interpretation", {}),
    )
    previous_report = cast(
        dict[str, object],
        list(state.get("observer_reports", []))[-1]
        if state.get("observer_reports")
        else {},
    )
    actor = next(item for item in state["actors"] if str(item["cast_id"]) == cast_id)
    available_actions = filter_action_catalog_for_actor(
        actor=cast(dict[str, object], actor),
        action_catalog=action_catalog,
    )
    return build_actor_runtime_guidance_view(
        simulation_objective=situation.get("simulation_objective", ""),
        scenario_premise=interpretation.get("premise", ""),
        key_pressures=interpretation.get("key_pressures", []),
        world_state_summary=state.get("world_state_summary", ""),
        previous_observer_summary=latest_observer_summary(
            list(state.get("observer_reports", []))
        ),
        previous_observer_momentum=previous_report.get("momentum", ""),
        previous_observer_atmosphere=previous_report.get("atmosphere", ""),
        actor_facing_scenario_digest=state.get("actor_facing_scenario_digest", {}),
        channel_guidance=cast(dict[str, object], situation.get("channel_guidance", {})),
        current_constraints=object_list(situation.get("current_constraints", [])),
        goal_snapshot=goal_snapshot,
        available_actions=available_actions,
    )


def filter_action_catalog_for_actor(
    *,
    actor: dict[str, object],
    action_catalog: ActionCatalog,
) -> list[dict[str, object]]:
    preferred_action_types = {
        str(item) for item in string_list(actor.get("preferred_action_types"))
    }
    role_text = " ".join(
        [
            str(actor.get("role", "")),
            str(actor.get("public_profile", "")),
            str(actor.get("private_goal", "")),
        ]
    )

    matched: list[dict[str, object]] = []
    fallback: list[dict[str, object]] = []
    for action in action_catalog.actions:
        dumped = action.model_dump(mode="json")
        fallback.append(dumped)
        if action.action_type in preferred_action_types:
            matched.append(dumped)
            continue
        if action.label and action.label in role_text:
            matched.append(dumped)
            continue
    return build_actor_available_actions_view(
        matched_actions=matched,
        fallback_actions=fallback,
    )


def goal_snapshot(state, cast_id: str) -> dict[str, object]:
    for snapshot in list(state.get("actor_intent_states", [])):
        if str(snapshot.get("cast_id", "")) == cast_id:
            return cast(dict[str, object], snapshot)
    return {}


def focus_slice_for_actor(state, cast_id: str) -> dict[str, object]:
    focus_plan = cast(dict[str, object], state.get("round_focus_plan", {}) or {})
    for raw_focus_slice in object_list(focus_plan.get("focus_slices", [])):
        if not isinstance(raw_focus_slice, dict):
            continue
        focus_slice = cast(dict[str, object], raw_focus_slice)
        if cast_id in string_list(focus_slice.get("focus_cast_ids", [])):
            return focus_slice
    return {}


def build_actor_action_shell_semantic_validator(
    *,
    actor: dict[str, Any],
    visible_actors: list[dict[str, object]],
    runtime_guidance: dict[str, object],
    max_recipients_per_message: int,
):
    cast_id = str(actor.get("cast_id", ""))
    available_actions = [
        cast(dict[str, object], item)
        for item in object_list(runtime_guidance.get("available_actions", []))
        if isinstance(item, dict)
    ]
    valid_target_cast_ids = [
        str(item.get("cast_id", ""))
        for item in visible_actors
        if str(item.get("cast_id", "")).strip()
    ]

    def validator(shell: ActorActionShell) -> list[str]:
        return validate_actor_action_shell_semantics(
            shell=shell,
            cast_id=cast_id,
            available_actions=available_actions,
            valid_target_cast_ids=valid_target_cast_ids,
            visible_actors=visible_actors,
            goal_snapshot=cast(
                dict[str, object],
                runtime_guidance.get("goal_snapshot", {}),
            ),
            max_target_count=max_recipients_per_message,
        )

    return validator


def build_actor_action_shell_semantic_coercer(
    *,
    actor: dict[str, Any],
    visible_actors: list[dict[str, object]],
    visible_action_context: list[dict[str, object]],
    runtime_guidance: dict[str, object],
    max_recipients_per_message: int,
):
    cast_id = str(actor.get("cast_id", ""))
    available_actions = [
        cast(dict[str, object], item)
        for item in object_list(runtime_guidance.get("available_actions", []))
        if isinstance(item, dict)
    ]
    available_by_type = {
        str(item.get("action_type", "")).strip(): item for item in available_actions
    }
    valid_target_cast_ids = [
        str(item.get("cast_id", ""))
        for item in visible_actors
        if str(item.get("cast_id", "")).strip()
    ]

    def coercer(shell: ActorActionShell) -> tuple[ActorActionShell, list[str]]:
        action_spec = available_by_type.get(shell.action_type)
        if action_spec is None:
            return shell, []
        supported_visibility = [
            str(item) for item in object_list(action_spec.get("supported_visibility", []))
        ]
        if shell.visibility not in supported_visibility:
            return shell, []
        normalized = normalize_actor_action_shell(
            shell=shell,
            source_cast_id=cast_id,
            visible_actors=visible_actors,
            visible_action_context=visible_action_context,
            goal_snapshot=cast(
                dict[str, object],
                runtime_guidance.get("goal_snapshot", {}),
            ),
        )
        reasons = _build_shell_coercion_reasons(
            original=shell,
            normalized=normalized,
            source_cast_id=cast_id,
            valid_target_cast_ids=valid_target_cast_ids,
        )
        clamped_targets = list(normalized.target_cast_ids[:max_recipients_per_message])
        if clamped_targets != list(normalized.target_cast_ids):
            reasons.append("target_count_clamped")
        coerced = ActorActionShell(
            action_type=normalized.action_type,
            visibility=normalized.visibility,
            target_cast_ids=clamped_targets,
        )
        if coerced == shell:
            return coerced, []
        return coerced, reasons

    return coercer


def build_actor_action_narrative_semantic_validator(
    *,
    actor: dict[str, Any],
    visible_actors: list[dict[str, object]],
    runtime_guidance: dict[str, object],
    shell: ActorActionShell,
    max_recipients_per_message: int,
):
    cast_id = str(actor.get("cast_id", ""))
    available_actions = [
        cast(dict[str, object], item)
        for item in object_list(runtime_guidance.get("available_actions", []))
        if isinstance(item, dict)
    ]
    valid_target_cast_ids = [
        str(item.get("cast_id", ""))
        for item in visible_actors
        if str(item.get("cast_id", "")).strip()
    ]

    def validator(narrative) -> list[str]:
        return validate_actor_action_narrative_semantics(
            narrative=narrative,
            shell=shell,
            cast_id=cast_id,
            available_actions=available_actions,
            valid_target_cast_ids=valid_target_cast_ids,
            visible_actors=visible_actors,
            goal_snapshot=cast(
                dict[str, object],
                runtime_guidance.get("goal_snapshot", {}),
            ),
            max_target_count=max_recipients_per_message,
        )

    return validator


def object_list(value: object) -> list[object]:
    if not isinstance(value, list):
        return []
    return list(value)


def string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]


def _build_shell_coercion_reasons(
    *,
    original: ActorActionShell,
    normalized: ActorActionShell,
    source_cast_id: str,
    valid_target_cast_ids: list[str],
) -> list[str]:
    reasons: list[str] = []
    original_targets = [str(item).strip() for item in original.target_cast_ids]
    valid_target_set = {cast_id for cast_id in valid_target_cast_ids if cast_id != source_cast_id}
    if any(target == source_cast_id for target in original_targets):
        reasons.append("self_target_removed")
    if len(original_targets) != len(set(original_targets)):
        reasons.append("duplicate_targets_removed")
    if any(target and target not in valid_target_set for target in original_targets):
        reasons.append("invalid_targets_removed")
    if not original_targets and normalized.target_cast_ids:
        reasons.append("target_inferred_from_context")
    return reasons
