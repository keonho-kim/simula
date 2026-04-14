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
    if proposal.visibility in {"private", "group"} and not effective_target_cast_ids:
        issues.append(
            f"visibility `{proposal.visibility}` 는 target_cast_ids가 비어 있으면 안 됩니다."
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

    return {
        "cast_id": cast_id,
        "actor_display_name": actor_display_name,
        "available_actions": available_actions,
        "valid_target_cast_ids": valid_target_cast_ids,
        "visible_actors": visible_actors,
        "current_intent_target_cast_ids": current_intent_target_cast_ids,
        "recent_visible_actions": recent_visible_actions,
        "thread_family_guidance": {
            "date_selection": "same pair/group date line",
            "private_confession": "same confession or private emotional line",
            "choice_pressure": "same choice or commitment pressure line",
            "public_conversation": "same ongoing public conversation line",
        },
        "max_target_count": max_target_count,
    }


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]
