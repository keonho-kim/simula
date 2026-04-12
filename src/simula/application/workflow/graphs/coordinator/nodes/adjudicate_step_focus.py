"""목적:
- step adjudication 노드를 제공한다.

설명:
- adopted action, intent, time, world state 갱신을 한 번에 확정한다.

사용한 설계 패턴:
- single node module 패턴
"""

from __future__ import annotations

import json
import time
from typing import cast

from langgraph.runtime import Runtime
from langgraph.types import Overwrite

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.utils.coercion import as_string_list
from simula.application.workflow.utils.prompt_projections import (
    WORLD_STATE_SUMMARY_LIMIT,
    build_compact_background_updates,
    build_compact_pending_actor_proposals,
    build_progression_plan_prompt_view,
    build_relevant_intent_states,
    truncate_text,
)
from simula.application.workflow.graphs.coordinator.prompts.adjudicate_step_focus_prompt import (
    PROMPT as ADJUDICATE_STEP_FOCUS_PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.domain.contracts import (
    ActorIntentSnapshot,
    ObserverEventProposal,
    RuntimeProgressionPlan,
    StepAdjudication,
)
from simula.domain.runtime_steps import (
    ActorProposalPayload,
    apply_adopted_actor_proposals,
)
from simula.prompts.shared.output_examples import build_output_prompt_bundle


async def adjudicate_step_focus(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """actor proposal 채택과 intent/time/world 상태 정리를 확정한다."""

    pending_actor_proposals = cast(
        list[dict[str, object]],
        list(state.get("pending_actor_proposals", [])),
    )
    latest_background_updates = list(state.get("latest_background_updates", []))
    relevant_actor_ids = [
        *list(state.get("selected_actor_ids", [])),
        *_proposal_related_actor_ids(pending_actor_proposals),
        *[
            str(item.get("actor_id", ""))
            for item in latest_background_updates
            if str(item.get("actor_id", "")).strip()
        ],
    ]
    prompt = ADJUDICATE_STEP_FOCUS_PROMPT.format(
        step_index=state["step_index"],
        step_focus_plan_json=json.dumps(
            state.get("step_focus_plan", {}),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        pending_actor_proposals_json=json.dumps(
            build_compact_pending_actor_proposals(pending_actor_proposals),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        actor_intent_states_json=json.dumps(
            build_relevant_intent_states(
                list(state.get("actor_intent_states", [])),
                relevant_actor_ids=relevant_actor_ids,
            ),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        latest_background_updates_json=json.dumps(
            build_compact_background_updates(latest_background_updates),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        simulation_clock_json=json.dumps(
            state.get("simulation_clock", {}),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        progression_plan_json=json.dumps(
            build_progression_plan_prompt_view(state["plan"]["progression_plan"]),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        world_state_summary=truncate_text(
            state.get("world_state_summary", ""),
            WORLD_STATE_SUMMARY_LIMIT,
        ),
        **build_output_prompt_bundle(StepAdjudication),
    )
    default_payload = _build_default_step_adjudication_payload(state)
    adjudication, meta = await runtime.context.llms.ainvoke_structured_with_meta(
        "coordinator",
        prompt,
        StepAdjudication,
        allow_default_on_failure=True,
        default_payload=default_payload,
        log_context={
            "scope": "step-adjudication",
            "step_index": int(state["step_index"]),
        },
    )
    applied = apply_adopted_actor_proposals(
        run_id=state["run_id"],
        step_index=int(state["step_index"]),
        actors=list(state.get("actors", [])),
        activity_feeds=dict(state.get("activity_feeds", {})),
        activities=list(state.get("activities", [])),
        action_catalog=cast(dict[str, object], state["plan"]["action_catalog"]),
        pending_actor_proposals=cast(
            list[ActorProposalPayload],
            list(state.get("pending_actor_proposals", [])),
        ),
        adopted_actor_ids=list(adjudication.adopted_actor_ids),
        max_targets_per_activity=runtime.context.settings.runtime.max_recipients_per_message,
    )

    latest_step_actions = list(applied["latest_step_activities"])
    if adjudication.event_action is not None:
        event_payload = _build_event_action_payload(
            state=state,
            event_action=adjudication.event_action.model_dump(mode="json"),
        )
        latest_step_actions.append(event_payload)
        applied["activities"].append(event_payload)
        applied["activity_feeds"] = _route_event_activity(
            dict(applied["activity_feeds"]),
            event_payload,
        )

    clock = _build_updated_clock(
        state=state,
        step_time_advance=adjudication.step_time_advance.model_dump(mode="json"),
    )
    runtime.context.logger.info(
        "step %s 채택 완료 | adopted action %s건 | background update %s건",
        state["step_index"],
        len(latest_step_actions),
        len(list(state.get("latest_background_updates", []))),
    )
    return {
        "activity_feeds": applied["activity_feeds"],
        "activities": applied["activities"],
        "latest_step_activities": latest_step_actions,
        "pending_actor_proposals": Overwrite(value=[]),
        "actor_intent_states": [
            item.model_dump(mode="json") for item in adjudication.updated_intent_states
        ],
        "intent_history": list(state.get("intent_history", []))
        + [
            {
                "step_index": int(state["step_index"]),
                "actor_intent_states": [
                    item.model_dump(mode="json")
                    for item in adjudication.updated_intent_states
                ],
            }
        ],
        "pending_step_time_advance": clock["step_time_advance"],
        "simulation_clock": clock["simulation_clock"],
        "step_time_history": list(state.get("step_time_history", []))
        + [clock["step_time_advance"]],
        "world_state_summary": adjudication.world_state_summary_hint,
        "parse_failures": int(state.get("parse_failures", 0))
        + applied["parse_failure_count"]
        + meta.parse_failure_count,
        "forced_idles": int(state.get("forced_idles", 0))
        + applied["forced_idle_count"],
        "last_step_latency_seconds": time.perf_counter()
        - float(state.get("current_step_started_at", 0.0)),
    }


def _build_default_step_adjudication_payload(
    state: SimulationWorkflowState,
) -> dict[str, object]:
    previous_by_actor = {
        str(item.get("actor_id", "")): item
        for item in list(state.get("actor_intent_states", []))
    }
    proposal_by_actor = {
        str(item.get("actor_id", "")): cast(dict[str, object], item.get("proposal", {}))
        for item in list(state.get("pending_actor_proposals", []))
        if isinstance(item.get("proposal", {}), dict)
    }
    snapshots = []
    for actor in list(state.get("actors", [])):
        actor_id = str(actor.get("actor_id", ""))
        previous = previous_by_actor.get(actor_id, {})
        proposal = proposal_by_actor.get(actor_id)
        current_intent = str(
            previous.get("current_intent", actor.get("private_goal", ""))
        )
        supporting_action_type = str(
            previous.get("supporting_action_type", "initial_state")
        )
        changed = False
        if proposal:
            current_intent = (
                str(proposal.get("intent", current_intent)).strip() or current_intent
            )
            supporting_action_type = (
                str(proposal.get("action_type", supporting_action_type)).strip()
                or supporting_action_type
            )
            changed = current_intent != str(previous.get("current_intent", "")).strip()
        snapshots.append(
            ActorIntentSnapshot(
                actor_id=actor_id,
                current_intent=current_intent or "현재 상황을 더 관찰한다.",
                target_actor_ids=as_string_list(
                    (proposal or previous).get("intent_target_actor_ids")
                    or (proposal or previous).get("target_actor_ids")
                    or []
                ),
                supporting_action_type=supporting_action_type or "initial_state",
                confidence=0.6,
                changed_from_previous=changed,
            ).model_dump(mode="json")
        )

    adopted_actor_ids = [
        str(item.get("actor_id", ""))
        for item in list(state.get("pending_actor_proposals", []))
        if str(item.get("actor_id", "")) in set(state.get("selected_actor_ids", []))
        and not bool(item.get("forced_idle"))
        and isinstance(item.get("proposal", {}), dict)
        and item.get("proposal", {})
    ]
    return {
        "adopted_actor_ids": adopted_actor_ids[:2],
        "rejected_action_notes": [],
        "updated_intent_states": snapshots,
        "step_time_advance": _default_step_time_advance(state),
        "background_updates": list(state.get("latest_background_updates", [])),
        "event_action": None,
        "world_state_summary_hint": str(
            state.get("world_state_summary", "현재 시뮬레이션 압력은 유지되고 있다.")
        ),
    }


def _proposal_related_actor_ids(
    pending_actor_proposals: list[dict[str, object]],
) -> list[str]:
    related: list[str] = []
    for item in pending_actor_proposals:
        proposal = cast(dict[str, object], item.get("proposal", {}))
        if not isinstance(proposal, dict):
            continue
        for actor_id in as_string_list(
            proposal.get("target_actor_ids", [])
        ) + as_string_list(proposal.get("intent_target_actor_ids", [])):
            if actor_id not in related:
                related.append(actor_id)
    return related


def _default_step_time_advance(state: SimulationWorkflowState) -> dict[str, object]:
    plan = RuntimeProgressionPlan.model_validate(state["plan"]["progression_plan"])
    elapsed_unit = "minute" if "minute" in plan.allowed_units else plan.default_unit
    elapsed_amount = 30 if elapsed_unit == "minute" else 1
    return {
        "elapsed_unit": elapsed_unit,
        "elapsed_amount": elapsed_amount,
        "selection_reason": "이번 단계에는 큰 시간 점프보다 기본 진행 단위를 따른다.",
        "signals": ["기본 pacing 적용"],
    }


def _build_updated_clock(
    *,
    state: SimulationWorkflowState,
    step_time_advance: dict[str, object],
) -> dict[str, dict[str, object]]:
    previous_clock = cast(dict[str, object], state.get("simulation_clock", {}))
    elapsed_unit = str(step_time_advance["elapsed_unit"])
    elapsed_amount = int(str(step_time_advance["elapsed_amount"]))
    if elapsed_unit == "minute":
        elapsed_minutes = elapsed_amount
    elif elapsed_unit == "hour":
        elapsed_minutes = elapsed_amount * 60
    elif elapsed_unit == "day":
        elapsed_minutes = elapsed_amount * 60 * 24
    else:
        elapsed_minutes = elapsed_amount * 60 * 24 * 7
    total_elapsed_minutes = (
        int(str(previous_clock.get("total_elapsed_minutes", 0))) + elapsed_minutes
    )
    elapsed_label = (
        f"{elapsed_amount}"
        f"{'분' if elapsed_unit == 'minute' else '시간' if elapsed_unit == 'hour' else '일' if elapsed_unit == 'day' else '주'}"
    )
    total_label = _elapsed_minutes_label(total_elapsed_minutes)
    record = {
        "step_index": int(state["step_index"]),
        "elapsed_unit": elapsed_unit,
        "elapsed_amount": elapsed_amount,
        "elapsed_minutes": elapsed_minutes,
        "elapsed_label": elapsed_label,
        "total_elapsed_minutes": total_elapsed_minutes,
        "total_elapsed_label": total_label,
        "selection_reason": str(step_time_advance["selection_reason"]),
        "signals": as_string_list(step_time_advance.get("signals", [])),
    }
    clock = {
        "total_elapsed_minutes": total_elapsed_minutes,
        "total_elapsed_label": total_label,
        "last_elapsed_minutes": elapsed_minutes,
        "last_elapsed_label": elapsed_label,
        "last_advanced_step_index": int(state["step_index"]),
    }
    return cast(
        dict[str, dict[str, object]],
        {
            "step_time_advance": record,
            "simulation_clock": clock,
        },
    )


def _build_event_action_payload(
    *,
    state: SimulationWorkflowState,
    event_action: dict[str, object],
) -> dict[str, object]:
    from simula.domain.activities import create_canonical_action

    action = create_canonical_action(
        run_id=state["run_id"],
        step_index=int(state["step_index"]),
        source_actor_id="coordinator",
        visibility="public",
        target_actor_ids=[],
        visibility_scope=["all"],
        action_type=str(event_action.get("action_type", "")).strip(),
        intent=str(event_action.get("intent", "")).strip(),
        intent_target_actor_ids=[],
        action_summary=str(event_action.get("action_summary", "")).strip(),
        action_detail=str(event_action.get("action_detail", "")).strip(),
        utterance=str(event_action.get("utterance")).strip()
        if event_action.get("utterance") is not None
        else None,
        thread_id=cast(str | None, event_action.get("thread_id")),
    )
    return action.model_dump(mode="json")


def _route_event_activity(
    activity_feeds: dict[str, dict[str, object]],
    event_payload: dict[str, object],
) -> dict[str, dict[str, object]]:
    from simula.domain.activity_feeds import route_activity

    return route_activity(activity_feeds, event_payload)


def _elapsed_minutes_label(total_elapsed_minutes: int) -> str:
    if total_elapsed_minutes <= 0:
        return "0분"
    minutes = total_elapsed_minutes
    weeks, minutes = divmod(minutes, 60 * 24 * 7)
    days, minutes = divmod(minutes, 60 * 24)
    hours, minutes = divmod(minutes, 60)
    parts: list[str] = []
    if weeks:
        parts.append(f"{weeks}주")
    if days:
        parts.append(f"{days}일")
    if hours:
        parts.append(f"{hours}시간")
    if minutes:
        parts.append(f"{minutes}분")
    return " ".join(parts)
