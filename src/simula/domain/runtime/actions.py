"""목적:
- runtime round의 순수 action 상태 전이 규칙을 제공한다.

설명:
- actor action proposal 결과를 canonical action과 actor feed 상태에 반영하는
  규칙을 workflow 계층 밖으로 분리한다.

사용한 설계 패턴:
- 순수 상태 전이 함수 패턴

연관된 다른 모듈/구조:
- simula.application.workflow.graphs.runtime.nodes.actor_turn
- simula.domain.activity.actions
- simula.domain.activity.feeds
"""

from __future__ import annotations

from typing import TypedDict

from pydantic import ValidationError

from simula.domain.activity.actions import create_canonical_action
from simula.domain.activity.feeds import (
    build_visibility_scope,
    mark_seen_activities,
    route_activity,
    sanitize_targets,
)
from simula.domain.contracts import ActionCatalog, ActorActionProposal


class RoutedRoundState(TypedDict):
    """proposal 결과를 action 상태로 반영한 결과다."""

    activity_feeds: dict[str, dict[str, object]]
    activities: list[dict[str, object]]
    latest_round_activities: list[dict[str, object]]
    forced_idle_count: int
    parse_failure_count: int


class ActorProposalPayload(TypedDict):
    """actor action proposal 결과 payload다."""

    cast_id: str
    unread_activity_ids: list[str]
    proposal: dict[str, object]
    forced_idle: bool
    parse_failure_count: int
    latency_seconds: float


def apply_actor_proposals(
    *,
    run_id: str,
    round_index: int,
    actors: list[dict[str, object]],
    activity_feeds: dict[str, dict[str, object]],
    activities: list[dict[str, object]],
    action_catalog: dict[str, object],
    pending_actor_proposals: list[ActorProposalPayload],
    max_targets_per_activity: int,
) -> RoutedRoundState:
    """병렬 actor action proposal 결과를 feed/action 상태에 반영한다."""

    updated_feeds = dict(activity_feeds)
    all_activities = list(activities)
    latest_round_activities: list[dict[str, object]] = []
    forced_idle_count = 0
    parse_failure_count = 0
    catalog = ActionCatalog.model_validate(action_catalog)
    action_catalog_by_type = {item.action_type: item for item in catalog.actions}

    for proposal_result in pending_actor_proposals:
        cast_id = str(proposal_result["cast_id"])
        forced_idle_count += int(bool(proposal_result["forced_idle"]))
        parse_failure_count += proposal_result["parse_failure_count"]
        mark_seen_activities(
            updated_feeds,
            cast_id,
            proposal_result["unread_activity_ids"],
        )

        try:
            proposal = ActorActionProposal.model_validate(proposal_result["proposal"])
        except (ValidationError, ValueError, TypeError):
            continue

        if proposal.action_type not in action_catalog_by_type:
            raise ValueError(
                f"cast `{cast_id}` 가 action catalog 밖의 action_type "
                f"`{proposal.action_type}` 를 제안했습니다."
            )
        action_spec = action_catalog_by_type[proposal.action_type]

        target_cast_ids = sanitize_targets(
            proposal.target_cast_ids,
            source_cast_id=cast_id,
            actors=actors,
            visibility=proposal.visibility,
            max_targets=max_targets_per_activity,
        )
        if proposal.visibility not in action_spec.supported_visibility:
            raise ValueError(
                f"action_type `{proposal.action_type}` 는 visibility "
                f"`{proposal.visibility}` 를 지원하지 않습니다."
            )
        if action_spec.requires_target and not target_cast_ids:
            raise ValueError(
                f"action_type `{proposal.action_type}` 는 target_cast_ids가 필요합니다."
            )
        if len(target_cast_ids) > max_targets_per_activity:
            raise ValueError(
                f"action_type `{proposal.action_type}` 는 최대 {max_targets_per_activity}명의 target_cast_ids만 허용합니다."
            )
        thread_id = ""
        if target_cast_ids:
            thread_id = _infer_thread_id(
                proposal=proposal,
                source_cast_id=cast_id,
                target_cast_ids=target_cast_ids,
                visible_action_context=all_activities[-12:],
            )

        action = create_canonical_action(
            run_id=run_id,
            round_index=round_index,
            source_cast_id=cast_id,
            visibility=proposal.visibility,
            target_cast_ids=target_cast_ids,
            visibility_scope=build_visibility_scope(
                cast_id,
                target_cast_ids,
                proposal.visibility,
            ),
            action_type=proposal.action_type.strip(),
            goal=proposal.goal.strip(),
            summary=proposal.summary.strip(),
            detail=proposal.detail.strip(),
            utterance=proposal.utterance.strip(),
            thread_id=thread_id,
        )
        action_payload = action.model_dump(mode="json")
        all_activities.append(action_payload)
        latest_round_activities.append(action_payload)
        updated_feeds = route_activity(updated_feeds, action_payload)

    return {
        "activity_feeds": updated_feeds,
        "activities": all_activities,
        "latest_round_activities": latest_round_activities,
        "forced_idle_count": forced_idle_count,
        "parse_failure_count": parse_failure_count,
    }


def _infer_thread_id(
    *,
    proposal: ActorActionProposal,
    source_cast_id: str,
    target_cast_ids: list[str],
    visible_action_context: list[dict[str, object]],
) -> str:
    if not target_cast_ids:
        return ""

    current_family = _classify_thread_family(proposal.action_type)
    current_participants = tuple(sorted({source_cast_id, *target_cast_ids}))
    for action in visible_action_context:
        thread_id = str(action.get("thread_id", "")).strip()
        if not thread_id:
            continue
        action_family = _classify_thread_family(str(action.get("action_type", "")))
        action_participants = tuple(
            sorted(
                {
                    str(action.get("source_cast_id", "")).strip(),
                    *[
                        str(cast_id).strip()
                        for cast_id in list(action.get("target_cast_ids", []))
                    ],
                }
            )
        )
        if action_participants == current_participants and action_family == current_family:
            return thread_id

    scope = "pair" if len(current_participants) == 2 else "group"
    return f"{scope}:{'+'.join(current_participants)}:{current_family}"


def _classify_thread_family(action_type: str) -> str:
    lowered = action_type.strip().lower()
    if "date" in lowered:
        return "date_selection"
    if "confide" in lowered or "confession" in lowered:
        return "private_confession"
    if "choice" in lowered or "choose" in lowered:
        return "choice_pressure"
    if (
        "conversation" in lowered
        or "dialogue" in lowered
        or "discussion" in lowered
        or "speech" in lowered
        or "statement" in lowered
    ):
        return "public_conversation"
    return lowered or "interaction"


def apply_adopted_actor_proposals(
    *,
    run_id: str,
    round_index: int,
    actors: list[dict[str, object]],
    activity_feeds: dict[str, dict[str, object]],
    activities: list[dict[str, object]],
    action_catalog: dict[str, object],
    pending_actor_proposals: list[ActorProposalPayload],
    adopted_cast_ids: list[str],
    max_targets_per_activity: int,
) -> RoutedRoundState:
    """채택된 actor proposal만 canonical action으로 반영한다."""

    adopted_set = {str(cast_id) for cast_id in adopted_cast_ids}
    selected_proposals = [
        proposal
        for proposal in pending_actor_proposals
        if str(proposal["cast_id"]) in adopted_set
    ]
    return apply_actor_proposals(
        run_id=run_id,
        round_index=round_index,
        actors=actors,
        activity_feeds=activity_feeds,
        activities=activities,
        action_catalog=action_catalog,
        pending_actor_proposals=selected_proposals,
        max_targets_per_activity=max_targets_per_activity,
    )
