"""Purpose:
- Validate actor proposal semantics against the runtime action catalog.

Description:
- Keep prompt-time proposal checks close to the runtime graph.
- Reuse the same contract checks before action adoption.
"""

from __future__ import annotations

from simula.application.workflow.graphs.runtime.proposal_semantics import (
    infer_target_cast_ids,
)
from simula.domain.contracts import ActorActionProposal

_ACTOR_PROPOSAL_TARGET_RULES: tuple[str, ...] = (
    "For `group` visibility, `target_cast_ids` must contain at least one real visible other actor `cast_id`.",
    "For `private` visibility, `target_cast_ids` may be empty only for a solo self-directed action. If the action is aimed at a concrete visible other actor, include that real `cast_id`.",
    "Never include your own `cast_id` in `target_cast_ids` or `intent_target_cast_ids`.",
    "`target_cast_ids` and `intent_target_cast_ids` may contain only real visible other actor `cast_id` values from `visible actors JSON`.",
    "If no valid visible other actor is involved, you may use `private` visibility and leave both target arrays empty for a solo action. Use `public` with empty targets only for room-wide or broadcast actions.",
)


def actor_proposal_target_rule_lines() -> tuple[str, ...]:
    """Return the shared actor target contract for prompts and fixer retries."""

    return _ACTOR_PROPOSAL_TARGET_RULES


def validate_actor_action_proposal_semantics(
    *,
    proposal: ActorActionProposal,
    cast_id: str,
    available_actions: list[dict[str, object]],
    valid_target_cast_ids: list[str],
    visible_actors: list[dict[str, object]],
    current_intent_snapshot: dict[str, object],
    max_target_count: int,
) -> list[str]:
    """Return semantic contract violations for one actor proposal."""

    issues: list[str] = []
    available_by_type = {
        str(item.get("action_type", "")): item for item in available_actions
    }
    action_spec = available_by_type.get(proposal.action_type)
    if action_spec is None:
        return [
            f"action_type `{proposal.action_type}` 는 runtime_guidance.available_actions 안에 있어야 합니다."
        ]

    supported_visibility = _string_list(action_spec.get("supported_visibility", []))
    requires_target = bool(action_spec.get("requires_target", False))
    supports_utterance = bool(action_spec.get("supports_utterance", False))
    valid_target_set = {
        target_id for target_id in valid_target_cast_ids if target_id != cast_id
    }
    effective_target_cast_ids = proposal.target_cast_ids or infer_target_cast_ids(
        proposal=proposal,
        source_cast_id=cast_id,
        visible_actors=visible_actors,
        current_intent_snapshot=current_intent_snapshot,
    )
    effective_intent_target_cast_ids = (
        proposal.intent_target_cast_ids or list(effective_target_cast_ids)
    )

    if proposal.visibility not in supported_visibility:
        issues.append(
            f"visibility `{proposal.visibility}` 는 action_type `{proposal.action_type}` 에서 지원되지 않습니다."
        )
    if requires_target and not effective_target_cast_ids:
        issues.append(
            f"action_type `{proposal.action_type}` 는 target_cast_ids가 필요합니다."
        )
    if proposal.visibility == "group" and not effective_target_cast_ids:
        issues.append(
            "visibility `group` 는 target_cast_ids가 비어 있으면 안 됩니다."
        )
    if proposal.utterance.strip() and not supports_utterance:
        issues.append(
            f"action_type `{proposal.action_type}` 는 utterance를 지원하지 않습니다."
        )
    if len(effective_target_cast_ids) > max_target_count:
        issues.append(
            f"target_cast_ids 는 최대 {max_target_count}명까지만 허용됩니다."
        )
    if len(set(effective_target_cast_ids)) != len(effective_target_cast_ids):
        issues.append("target_cast_ids 는 중복 없이 구성해야 합니다.")

    invalid_targets = [
        target_id
        for target_id in effective_target_cast_ids
        if target_id not in valid_target_set
    ]
    if invalid_targets:
        issues.append(
            "target_cast_ids 는 visible actor 중 실제 상대 cast_id만 써야 합니다: "
            + ", ".join(invalid_targets)
        )

    invalid_intent_targets = [
        target_id
        for target_id in effective_intent_target_cast_ids
        if target_id not in valid_target_set
    ]
    if invalid_intent_targets:
        issues.append(
            "intent_target_cast_ids 는 visible actor 중 실제 상대 cast_id만 써야 합니다: "
            + ", ".join(invalid_intent_targets)
        )

    return issues


def build_actor_proposal_repair_context(
    *,
    cast_id: str,
    actor_display_name: str,
    available_actions: list[dict[str, object]],
    valid_target_cast_ids: list[str],
    visible_actors: list[dict[str, object]],
    current_intent_target_cast_ids: list[str],
    recent_visible_actions: list[dict[str, object]],
    max_target_count: int,
) -> dict[str, object]:
    """Build compact repair context for fixer retries."""

    valid_visible_other_targets = [
        target_id
        for target_id in valid_target_cast_ids
        if target_id.strip() and target_id.strip() != cast_id
    ]
    current_valid_intent_targets = [
        target_id
        for target_id in current_intent_target_cast_ids
        if target_id in valid_visible_other_targets
    ]
    action_types_requiring_target = [
        str(item.get("action_type", "")).strip()
        for item in available_actions
        if bool(item.get("requires_target", False))
        and str(item.get("action_type", "")).strip()
    ]
    solo_private_action_types = [
        str(item.get("action_type", "")).strip()
        for item in available_actions
        if not bool(item.get("requires_target", False))
        and "private" in _string_list(item.get("supported_visibility", []))
        and str(item.get("action_type", "")).strip()
    ]
    repair_guidance = list(actor_proposal_target_rule_lines())
    if valid_visible_other_targets:
        repair_guidance.append(
            "Valid visible other actor `cast_id` values for this turn: "
            + ", ".join(valid_visible_other_targets)
            + "."
        )
    else:
        repair_guidance.append("No visible other actor can be targeted in this turn.")
    if solo_private_action_types:
        repair_guidance.append(
            "These action types may stay solo with `private` visibility and empty target arrays: "
            + ", ".join(solo_private_action_types)
            + "."
        )
        repair_guidance.append(
            "If the repaired action is solo or self-directed, prefer `private` visibility and leave both target arrays empty."
        )
    else:
        repair_guidance.append(
            "No solo `private` action is supported for this turn. Use `public` with empty target arrays only for a broadcast action."
        )
    if current_valid_intent_targets:
        repair_guidance.append(
            "Current intent already points to these valid targets: "
            + ", ".join(current_valid_intent_targets)
            + "."
        )
    elif current_intent_target_cast_ids:
        repair_guidance.append(
            "Current intent target ids are not valid for this turn. Do not copy them into the repaired JSON."
        )
    else:
        repair_guidance.append(
            "Current intent does not provide a valid visible other target for this turn."
        )
    if action_types_requiring_target:
        repair_guidance.append(
            "These action types still require a valid target: "
            + ", ".join(action_types_requiring_target)
            + "."
        )
    repair_guidance.append(
        f"Do not return more than {max_target_count} target cast_id value(s)."
    )

    return {
        "cast_id": cast_id,
        "actor_display_name": actor_display_name,
        "available_actions": available_actions,
        "valid_target_cast_ids": valid_visible_other_targets,
        "visible_actors": visible_actors,
        "current_intent_target_cast_ids": current_valid_intent_targets,
        "recent_visible_actions": recent_visible_actions,
        "thread_family_guidance": {
            "date_selection": "same pair/group date line",
            "private_confession": "same confession or private emotional line",
            "choice_pressure": "same choice or commitment pressure line",
            "public_conversation": "same ongoing public conversation line",
        },
        "max_target_count": max_target_count,
        "repair_guidance": repair_guidance,
    }


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]
