"""Purpose:
- Validate actor proposal semantics against the runtime action catalog.

Description:
- Keep prompt-time proposal checks close to the runtime graph.
- Reuse the same contract checks before action adoption.
"""

from __future__ import annotations

from simula.domain.contracts import ActorActionProposal


def validate_actor_action_proposal_semantics(
    *,
    proposal: ActorActionProposal,
    actor_id: str,
    available_actions: list[dict[str, object]],
    valid_target_actor_ids: list[str],
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
        target_id for target_id in valid_target_actor_ids if target_id != actor_id
    }

    if proposal.visibility not in supported_visibility:
        issues.append(
            f"visibility `{proposal.visibility}` 는 action_type `{proposal.action_type}` 에서 지원되지 않습니다."
        )
    if requires_target and not proposal.target_actor_ids:
        issues.append(
            f"action_type `{proposal.action_type}` 는 target_actor_ids가 필요합니다."
        )
    if proposal.visibility in {"private", "group"} and not proposal.target_actor_ids:
        issues.append(
            f"visibility `{proposal.visibility}` 는 target_actor_ids가 비어 있으면 안 됩니다."
        )
    if proposal.utterance.strip() and not supports_utterance:
        issues.append(
            f"action_type `{proposal.action_type}` 는 utterance를 지원하지 않습니다."
        )
    if len(proposal.target_actor_ids) > max_target_count:
        issues.append(
            f"target_actor_ids 는 최대 {max_target_count}명까지만 허용됩니다."
        )
    if len(set(proposal.target_actor_ids)) != len(proposal.target_actor_ids):
        issues.append("target_actor_ids 는 중복 없이 구성해야 합니다.")

    invalid_targets = [
        target_id
        for target_id in proposal.target_actor_ids
        if target_id not in valid_target_set
    ]
    if invalid_targets:
        issues.append(
            "target_actor_ids 는 visible actor 중 실제 상대 actor_id만 써야 합니다: "
            + ", ".join(invalid_targets)
        )

    invalid_intent_targets = [
        target_id
        for target_id in proposal.intent_target_actor_ids
        if target_id not in valid_target_set
    ]
    if invalid_intent_targets:
        issues.append(
            "intent_target_actor_ids 는 visible actor 중 실제 상대 actor_id만 써야 합니다: "
            + ", ".join(invalid_intent_targets)
        )

    return issues


def build_actor_proposal_repair_context(
    *,
    actor_id: str,
    available_actions: list[dict[str, object]],
    valid_target_actor_ids: list[str],
    max_target_count: int,
) -> dict[str, object]:
    """Build compact repair context for fixer retries."""

    return {
        "actor_id": actor_id,
        "available_actions": available_actions,
        "valid_target_actor_ids": valid_target_actor_ids,
        "max_target_count": max_target_count,
    }


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]
