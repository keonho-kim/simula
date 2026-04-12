"""목적:
- actor action proposal 관련 runtime 노드를 제공한다.

설명:
- active actor fan-out, action proposal 생성, 결과 reduce, action 상태 반영을 담당한다.

사용한 설계 패턴:
- send fan-out + reduce 패턴
"""

from __future__ import annotations

import json
import time
from typing import Any, cast

from langgraph.runtime import Runtime
from langgraph.types import Overwrite, Send

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.runtime.prompts.actor_turn_prompt import (
    PROMPT as ACTOR_PROPOSAL_PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.activities import recent_actions
from simula.domain.activity_feeds import (
    list_recent_visible_activities,
    list_unseen_activities,
)
from simula.domain.contracts import ActionCatalog, ActorActionProposal
from simula.domain.reporting import latest_observer_summary
from simula.domain.runtime_steps import ActorProposalPayload, apply_actor_proposals
from simula.prompts.shared.output_examples import build_output_prompt_bundle


def dispatch_selected_actor_proposals(
    state: SimulationWorkflowState,
) -> list[Send] | str:
    """선택된 actor action proposal 생성을 fan-out 한다."""

    if not state.get("selected_actor_ids"):
        return "reduce_actor_proposals"

    actors_by_id = {str(actor["actor_id"]): actor for actor in state["actors"]}
    action_catalog = ActionCatalog.model_validate(state["plan"]["action_catalog"])
    visible_actors_by_id = {
        actor_id: [
            candidate
            for candidate in state["actors"]
            if str(candidate["actor_id"]) != actor_id
        ]
        for actor_id in state["selected_actor_ids"]
    }
    all_recent_actions = recent_actions(list(state.get("activities", [])), limit=12)
    return [
        Send(
            "generate_actor_proposal",
            {
                "step_index": state["step_index"],
                "progression_plan": state["plan"]["progression_plan"],
                "simulation_clock": state.get("simulation_clock", {}),
                "actor_proposal_task": {
                    "actor": actors_by_id[actor_id],
                    "unread_visible_activities": list_unseen_activities(
                        state["activity_feeds"],
                        actor_id,
                        state["activities"],
                    ),
                    "recent_visible_activities": list_recent_visible_activities(
                        state["activity_feeds"],
                        actor_id,
                        all_recent_actions,
                    ),
                    "visible_actors": visible_actors_by_id[actor_id],
                    "focus_slice": _focus_slice_for_actor(state, actor_id),
                    "runtime_guidance": _build_runtime_guidance(
                        state=state,
                        actor_id=actor_id,
                        action_catalog=action_catalog,
                    ),
                },
            },
        )
        for actor_id in state["selected_actor_ids"]
    ]


dispatch_actor_proposals = dispatch_selected_actor_proposals


async def generate_actor_proposal(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """actor 하나의 현재 step action proposal을 만든다."""

    actor_task = state["actor_proposal_task"]
    actor = actor_task["actor"]
    actor_id = str(actor["actor_id"])
    unread_visible_activities = list(actor_task.get("unread_visible_activities", []))
    runtime_guidance = dict(actor_task.get("runtime_guidance", {}))

    prompt = _build_actor_proposal_prompt(
        state=state,
        actor=actor,
        unread_visible_activities=unread_visible_activities,
        recent_visible_activities=list(actor_task.get("recent_visible_activities", [])),
        visible_actors=list(actor_task.get("visible_actors", [])),
        runtime_guidance=runtime_guidance,
        max_recipients_per_message=runtime.context.settings.runtime.max_recipients_per_message,
    )
    proposal, meta = await runtime.context.llms.ainvoke_structured_with_meta(
        "actor",
        prompt,
        ActorActionProposal,
        allow_default_on_failure=True,
        default_payload=_build_default_action_proposal(
            actor=actor,
            visible_actors=list(actor_task.get("visible_actors", [])),
            runtime_guidance=runtime_guidance,
        ),
        log_context=_actor_log_context(state, actor),
    )
    _log_actor_proposal_completed(
        logger=runtime.context.logger,
        step_index=int(state["step_index"]),
        actor=actor,
        proposal=proposal,
        forced_default=bool(meta.forced_default),
        duration_seconds=float(meta.duration_seconds),
    )
    proposal_payload: dict[str, object]
    if meta.forced_default:
        proposal_payload = {}
    else:
        proposal_payload = proposal.model_dump(mode="json")
    return {
        "pending_actor_proposals": [
            {
                "actor_id": actor_id,
                "unread_activity_ids": [
                    str(activity["activity_id"])
                    for activity in unread_visible_activities
                ],
                "proposal": proposal_payload,
                "forced_idle": meta.forced_default,
                "parse_failure_count": meta.parse_failure_count,
                "latency_seconds": meta.duration_seconds,
            }
        ],
    }


def reduce_actor_proposals(state: SimulationWorkflowState) -> dict[str, object]:
    """actor order 기준으로 proposal 결과를 정렬한다."""

    active_order = {
        actor_id: index
        for index, actor_id in enumerate(state.get("selected_actor_ids", []))
    }
    ordered_results = sorted(
        state.get("pending_actor_proposals", []),
        key=lambda item: active_order.get(str(item["actor_id"]), 10_000),
    )
    return {
        "pending_actor_proposals": Overwrite(value=ordered_results),
    }


def route_step_activities(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """병렬 actor action proposal 결과를 step action 상태로 반영한다."""

    routed = apply_actor_proposals(
        run_id=state["run_id"],
        step_index=state["step_index"],
        actors=list(state["actors"]),
        activity_feeds=dict(state["activity_feeds"]),
        activities=list(state.get("activities", [])),
        action_catalog=cast(dict[str, object], state["plan"]["action_catalog"]),
        pending_actor_proposals=cast(
            list[ActorProposalPayload],
            list(state.get("pending_actor_proposals", [])),
        ),
        max_targets_per_activity=runtime.context.settings.runtime.max_recipients_per_message,
    )
    step_latency = time.perf_counter() - float(
        state.get("current_step_started_at", 0.0)
    )
    runtime.context.logger.info(
        "step %s 정리 완료, action %s건",
        state["step_index"],
        len(routed["latest_step_activities"]),
    )
    return {
        "activity_feeds": routed["activity_feeds"],
        "activities": routed["activities"],
        "latest_step_activities": routed["latest_step_activities"],
        "pending_actor_proposals": Overwrite(value=[]),
        "forced_idles": int(state.get("forced_idles", 0)) + routed["forced_idle_count"],
        "parse_failures": int(state.get("parse_failures", 0))
        + routed["parse_failure_count"],
        "last_step_latency_seconds": step_latency,
    }


def _build_actor_proposal_prompt(
    *,
    state: SimulationWorkflowState,
    actor: dict[str, Any],
    unread_visible_activities: list[dict[str, object]],
    recent_visible_activities: list[dict[str, object]],
    visible_actors: list[dict[str, object]],
    runtime_guidance: dict[str, object],
    max_recipients_per_message: int,
) -> str:
    return ACTOR_PROPOSAL_PROMPT.format(
        step_index=state["step_index"],
        progression_plan_json=json.dumps(
            state.get("progression_plan", {}),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        simulation_clock_json=json.dumps(
            state.get("simulation_clock", {}),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        actor_json=json.dumps(actor, ensure_ascii=False, separators=(",", ":")),
        focus_slice_json=json.dumps(
            actor_task_focus_slice(
                actor_task_focus=runtime_guidance.get("focus_slice")
            ),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        recent_visible_activities_json=json.dumps(
            recent_visible_activities,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        visible_actors_json=json.dumps(
            visible_actors,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        unread_visible_activities_json=json.dumps(
            unread_visible_activities,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        runtime_guidance_json=json.dumps(
            runtime_guidance,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        max_recipients_per_message=max_recipients_per_message,
        **build_output_prompt_bundle(ActorActionProposal),
    )


def _actor_log_context(
    state: SimulationWorkflowState,
    actor: dict[str, Any],
) -> dict[str, object]:
    return {
        "step_index": int(state["step_index"]),
        "simulation_clock_label": str(
            cast(dict[str, object], state.get("simulation_clock", {})).get(
                "total_elapsed_label",
                "0분",
            )
        ),
        "actor_id": str(actor["actor_id"]),
        "actor_display_name": actor.get("display_name"),
    }


def _build_runtime_guidance(
    *,
    state: SimulationWorkflowState,
    actor_id: str,
    action_catalog: ActionCatalog,
) -> dict[str, object]:
    """actor prompt에 넘길 compact 실행 맥락을 만든다."""

    situation = cast(dict[str, object], state.get("plan", {}).get("situation", {}))
    previous_report = cast(
        dict[str, object],
        list(state.get("observer_reports", []))[-1]
        if state.get("observer_reports")
        else {},
    )
    actor = next(item for item in state["actors"] if str(item["actor_id"]) == actor_id)
    available_actions = _filter_action_catalog_for_actor(
        actor=cast(dict[str, object], actor),
        action_catalog=action_catalog,
    )
    return {
        "simulation_objective": str(situation.get("simulation_objective", "")),
        "world_state_summary": str(state.get("world_state_summary", "")),
        "previous_observer_summary": latest_observer_summary(
            list(state.get("observer_reports", []))
        ),
        "previous_observer_momentum": str(previous_report.get("momentum", "")),
        "previous_observer_atmosphere": str(previous_report.get("atmosphere", "")),
        "channel_guidance": cast(
            dict[str, object], situation.get("channel_guidance", {})
        ),
        "current_constraints": _object_list(situation.get("current_constraints", [])),
        "focus_slice": _focus_slice_for_actor(state, actor_id),
        "current_intent_snapshot": _current_intent_snapshot(state, actor_id),
        "available_actions": available_actions,
        "action_selection_guidance": action_catalog.selection_guidance,
    }


def _filter_action_catalog_for_actor(
    *,
    actor: dict[str, object],
    action_catalog: ActionCatalog,
) -> list[dict[str, object]]:
    preferred_action_types = {
        str(item) for item in _string_list(actor.get("preferred_action_types"))
    }
    role_text = " ".join(
        [
            str(actor.get("role", "")),
            str(actor.get("public_profile", "")),
            str(actor.get("private_goal", "")),
        ]
    )
    group_name = str(actor.get("group_name", "")).strip()

    matched: list[dict[str, object]] = []
    fallback: list[dict[str, object]] = []
    for action in action_catalog.actions:
        dumped = action.model_dump(mode="json")
        fallback.append(dumped)
        if action.action_type in preferred_action_types:
            matched.append(dumped)
            continue
        if group_name and group_name in action.group_hints:
            matched.append(dumped)
            continue
        if any(hint and hint in role_text for hint in action.role_hints):
            matched.append(dumped)
            continue

    if matched:
        return matched
    return fallback


def _current_intent_snapshot(
    state: SimulationWorkflowState,
    actor_id: str,
) -> dict[str, object]:
    for snapshot in list(state.get("actor_intent_states", [])):
        if str(snapshot.get("actor_id", "")) == actor_id:
            return cast(dict[str, object], snapshot)
    return {}


def _focus_slice_for_actor(
    state: SimulationWorkflowState,
    actor_id: str,
) -> dict[str, object]:
    focus_plan = cast(dict[str, object], state.get("step_focus_plan", {}) or {})
    for raw_focus_slice in _object_list(focus_plan.get("focus_slices", [])):
        if not isinstance(raw_focus_slice, dict):
            continue
        focus_slice = cast(dict[str, object], raw_focus_slice)
        if actor_id in _string_list(focus_slice.get("focus_actor_ids", [])):
            return focus_slice
    return {}


def actor_task_focus_slice(*, actor_task_focus: object) -> dict[str, object]:
    """actor prompt에 직접 넣을 focus slice를 정리한다."""

    if isinstance(actor_task_focus, dict):
        return cast(dict[str, object], actor_task_focus)
    return {}


def _build_default_action_proposal(
    *,
    actor: dict[str, Any],
    visible_actors: list[dict[str, object]],
    runtime_guidance: dict[str, object],
) -> dict[str, object]:
    available_actions = [
        cast(dict[str, object], item)
        for item in _object_list(runtime_guidance.get("available_actions", []))
        if isinstance(item, dict)
    ]
    actor_id = str(actor.get("actor_id", ""))
    target_actor_ids = _default_target_actor_ids(
        actor_id=actor_id,
        visible_actors=visible_actors,
        runtime_guidance=runtime_guidance,
    )
    selected_action = _select_default_action(
        available_actions,
        has_targets=bool(target_actor_ids),
    )
    supported_visibility = _string_list(selected_action.get("supported_visibility"))
    visibility = _select_default_visibility(
        supported_visibility=supported_visibility,
        has_targets=bool(target_actor_ids),
    )
    intent_snapshot = cast(
        dict[str, object],
        runtime_guidance.get("current_intent_snapshot", {}),
    )
    current_intent = str(
        intent_snapshot.get("current_intent", "현재 상황을 조금 더 파악한다.")
    )
    intent_target_actor_ids = _string_list(intent_snapshot.get("target_actor_ids", []))
    if visibility == "public":
        target_actor_ids = []
    if not intent_target_actor_ids:
        intent_target_actor_ids = list(target_actor_ids)
    return {
        "action_type": str(selected_action.get("action_type", "observe")),
        "intent": current_intent,
        "intent_target_actor_ids": intent_target_actor_ids,
        "action_summary": "이번 단계에는 즉시 큰 움직임보다 상황 파악에 집중한다.",
        "action_detail": "지금 단계에서는 급하게 새로운 조치를 밀어붙이기보다, 현재 action 흐름과 상대 반응을 더 살핀다.",
        "utterance": None,
        "visibility": visibility,
        "target_actor_ids": target_actor_ids,
        "thread_id": None,
        "expected_outcome": "다음 단계 판단에 필요한 단서를 더 확보한다.",
    }


def _select_default_action(
    available_actions: list[dict[str, object]],
    *,
    has_targets: bool,
) -> dict[str, object]:
    if not has_targets:
        for action in available_actions:
            if "public" in _string_list(action.get("supported_visibility")) and not bool(
                action.get("supports_utterance")
            ):
                return action
        for action in available_actions:
            if "public" in _string_list(action.get("supported_visibility")):
                return action
    for action in available_actions:
        if not bool(action.get("requires_target")) and not bool(
            action.get("supports_utterance")
        ):
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
        "supports_utterance": False,
    }


def _select_default_visibility(
    *,
    supported_visibility: list[str],
    has_targets: bool,
) -> str:
    if has_targets:
        for visibility in ("private", "group", "public"):
            if visibility in supported_visibility:
                return visibility
    if "public" in supported_visibility:
        return "public"
    for visibility in ("private", "group"):
        if visibility in supported_visibility:
            return visibility
    return "public"


def _default_target_actor_ids(
    *,
    actor_id: str,
    visible_actors: list[dict[str, object]],
    runtime_guidance: dict[str, object],
) -> list[str]:
    intent_snapshot = cast(
        dict[str, object],
        runtime_guidance.get("current_intent_snapshot", {}),
    )
    intent_targets = [
        candidate
        for candidate in _string_list(intent_snapshot.get("target_actor_ids", []))
        if candidate and candidate != actor_id
    ]
    if intent_targets:
        return intent_targets[:1]

    focus_slice = cast(dict[str, object], runtime_guidance.get("focus_slice", {}))
    focus_targets = [
        candidate
        for candidate in _string_list(focus_slice.get("focus_actor_ids", []))
        if candidate and candidate != actor_id
    ]
    if focus_targets:
        return focus_targets[:1]

    visible_target_ids = [
        str(candidate.get("actor_id", ""))
        for candidate in visible_actors
        if str(candidate.get("actor_id", "")).strip()
        and str(candidate.get("actor_id", "")) != actor_id
    ]
    if visible_target_ids:
        return visible_target_ids[:1]
    return []


def _object_list(value: object) -> list[object]:
    if not isinstance(value, list):
        return []
    return list(value)


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]


def _log_actor_proposal_completed(
    *,
    logger: Any,
    step_index: int,
    actor: dict[str, Any],
    proposal: ActorActionProposal,
    forced_default: bool,
    duration_seconds: float,
) -> None:
    actor_name = str(actor.get("display_name") or actor.get("actor_id") or "actor")
    if forced_default:
        logger.info(
            "%s action 정리 완료 | step %s | 기본 대기 적용 | 소요 %.2fs",
            actor_name,
            step_index,
            duration_seconds,
        )
        return

    logger.info(
        "%s action 정리 완료 | step %s | %s | %s | 대상 %s | %s | 소요 %.2fs",
        actor_name,
        step_index,
        proposal.action_type,
        _visibility_label(proposal.visibility),
        _target_preview(proposal.target_actor_ids),
        _truncate_text(proposal.action_summary, 72),
        duration_seconds,
    )


def _target_preview(target_actor_ids: list[str]) -> str:
    if not target_actor_ids:
        return "직접 대상 없음"
    if len(target_actor_ids) <= 3:
        return ", ".join(target_actor_ids)
    head = ", ".join(target_actor_ids[:3])
    return f"{head} 외 {len(target_actor_ids) - 3}명"


def _visibility_label(visibility: str) -> str:
    labels = {
        "public": "공개 action",
        "private": "비공개 action",
        "group": "일부 공개 action",
    }
    return labels.get(visibility, "action")


def _truncate_text(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "…"
