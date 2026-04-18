"""Runtime actor-turn nodes."""

from __future__ import annotations

from typing import cast

from langgraph.runtime import Runtime
from langgraph.types import Overwrite, Send

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.runtime.nodes.actor_turn_defaults import (
    action_spec_by_type,
    assemble_actor_action_proposal,
    build_default_action_narrative as _build_default_action_narrative,
    build_default_action_proposal as _build_default_action_proposal,
    build_default_action_shell as _build_default_action_shell,
)
from simula.application.workflow.graphs.runtime.nodes.actor_turn_prompting import (
    actor_log_context,
    build_actor_action_narrative_prompt,
    build_actor_action_shell_prompt,
    log_actor_proposal_completed,
)
from simula.application.workflow.graphs.runtime.nodes.actor_turn_runtime import (
    build_actor_action_narrative_semantic_validator,
    build_actor_action_shell_semantic_coercer,
    build_actor_action_shell_semantic_validator,
    build_runtime_guidance,
    goal_snapshot,
    focus_slice_for_actor,
)
from simula.application.workflow.graphs.runtime.proposal_semantics import (
    normalize_actor_action_proposal,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.application.workflow.utils.prompt_projections import (
    build_actor_prompt_actor_view,
    build_actor_visible_actors_view,
    build_visible_action_context,
)
from simula.domain.activity.actions import recent_actions
from simula.domain.activity.feeds import (
    list_recent_visible_activities,
    list_unseen_activities,
)
from simula.domain.contracts import (
    ActionCatalog,
    ActorActionNarrative,
    ActorActionProposal,
    ActorActionShell,
)


def dispatch_selected_actor_proposals(
    state: SimulationWorkflowState,
) -> list[Send] | str:
    """선택된 actor action proposal 생성을 fan-out 한다."""

    if not state.get("selected_cast_ids"):
        return "resolve_round"

    return [
        Send(
            "generate_actor_proposal",
            {
                "plan": state["plan"],
                "round_index": state["round_index"],
                "progression_plan": state["plan"]["progression_plan"],
                "simulation_clock": state.get("simulation_clock", {}),
                "actor_proposal_task": build_actor_proposal_task(
                    state=state,
                    cast_id=str(cast_id),
                ),
            },
        )
        for cast_id in state["selected_cast_ids"]
    ]


def build_actor_proposal_task(
    *,
    state: SimulationWorkflowState,
    cast_id: str,
) -> dict[str, object]:
    """선택된 actor 하나에 대한 proposal task payload를 조립한다."""

    actors_by_id = {str(actor["cast_id"]): actor for actor in state["actors"]}
    action_catalog = ActionCatalog.model_validate(state["plan"]["action_catalog"])
    all_recent_actions = recent_actions(list(state.get("activities", [])), limit=12)
    actor = actors_by_id[cast_id]
    unread_visible_activities = list_unseen_activities(
        state["activity_feeds"],
        cast_id,
        state["activities"],
    )
    recent_visible_activities = list_recent_visible_activities(
        state["activity_feeds"],
        cast_id,
        all_recent_actions,
    )
    focus_slice = focus_slice_for_actor(state, cast_id)
    intent_snapshot = goal_snapshot(state, cast_id)
    visible_action_context, unread_backlog_digest = build_visible_action_context(
        unread_visible_activities=unread_visible_activities,
        recent_visible_activities=recent_visible_activities,
    )
    visible_actors = build_actor_visible_actors_view(
        actors=list(state["actors"]),
        cast_id=cast_id,
        focus_slice=focus_slice,
        goal_snapshot=intent_snapshot,
        visible_action_context=visible_action_context,
        selected_cast_ids=list(state.get("selected_cast_ids", [])),
    )
    runtime_guidance = build_runtime_guidance(
        state=state,
        cast_id=cast_id,
        action_catalog=action_catalog,
        goal_snapshot=intent_snapshot,
    )
    return {
        "actor": build_actor_prompt_actor_view(actor),
        "unread_activity_ids": [
            str(activity["activity_id"]) for activity in unread_visible_activities
        ],
        "visible_action_context": visible_action_context,
        "unread_backlog_digest": unread_backlog_digest,
        "visible_actors": visible_actors,
        "focus_slice": focus_slice,
        "runtime_guidance": runtime_guidance,
    }


async def generate_actor_proposal(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """actor 하나의 현재 round action proposal을 만든다."""

    actor_task = state["actor_proposal_task"]
    actor = actor_task["actor"]
    cast_id = str(actor["cast_id"])
    runtime_guidance = dict(actor_task.get("runtime_guidance", {}))
    visible_actors = [
        item
        for item in list(actor_task.get("visible_actors", []))
        if isinstance(item, dict)
    ]
    visible_action_context = [
        item
        for item in list(actor_task.get("visible_action_context", []))
        if isinstance(item, dict)
    ]
    default_proposal_payload = _build_default_action_proposal(
        actor=actor,
        visible_actors=visible_actors,
        runtime_guidance=runtime_guidance,
    )
    default_proposal = ActorActionProposal.model_validate(default_proposal_payload)
    available_actions = [
        cast(dict[str, object], item)
        for item in object_list(runtime_guidance.get("available_actions", []))
        if isinstance(item, dict)
    ]
    intent_snapshot = cast(
        dict[str, object],
        runtime_guidance.get("goal_snapshot", {}),
    )

    shell_prompt = build_actor_action_shell_prompt(
        state=state,
        actor=actor,
        focus_slice=dict(actor_task.get("focus_slice", {})),
        visible_action_context=list(actor_task.get("visible_action_context", [])),
        unread_backlog_digest=actor_task.get("unread_backlog_digest"),
        visible_actors=visible_actors,
        runtime_guidance=runtime_guidance,
        max_recipients_per_message=runtime.context.settings.runtime.max_recipients_per_message,
    )
    shell, shell_meta = await runtime.context.llms.ainvoke_object_with_meta(
        "actor",
        shell_prompt,
        ActorActionShell,
        failure_policy="default",
        default_payload=_build_default_action_shell(
            actor=actor,
            visible_actors=visible_actors,
            runtime_guidance=runtime_guidance,
        ),
        semantic_validator=build_actor_action_shell_semantic_validator(
            actor=actor,
            visible_actors=visible_actors,
            runtime_guidance=runtime_guidance,
            max_recipients_per_message=runtime.context.settings.runtime.max_recipients_per_message,
        ),
        semantic_coercer=build_actor_action_shell_semantic_coercer(
            actor=actor,
            visible_actors=visible_actors,
            visible_action_context=visible_action_context,
            runtime_guidance=runtime_guidance,
            max_recipients_per_message=runtime.context.settings.runtime.max_recipients_per_message,
        ),
        log_context=actor_log_context(
            state,
            actor,
            task_key="actor_action_shell",
            schema=ActorActionShell,
        ),
    )
    total_parse_failures = int(shell_meta.parse_failure_count)
    total_duration_seconds = float(shell_meta.duration_seconds)
    if shell_meta.forced_default:
        proposal = default_proposal
        forced_default = True
    else:
        selected_action_spec = action_spec_by_type(
            available_actions=available_actions,
            action_type=shell.action_type,
        )
        narrative_prompt = build_actor_action_narrative_prompt(
            state=state,
            actor=actor,
            focus_slice=dict(actor_task.get("focus_slice", {})),
            visible_action_context=visible_action_context,
            visible_actors=visible_actors,
            runtime_guidance=runtime_guidance,
            shell=shell,
            selected_action_spec=selected_action_spec,
        )
        narrative, narrative_meta = await runtime.context.llms.ainvoke_object_with_meta(
            "actor",
            narrative_prompt,
            ActorActionNarrative,
            failure_policy="default",
            default_payload=_build_default_action_narrative(
                runtime_guidance=runtime_guidance,
                shell=shell,
            ),
            semantic_validator=build_actor_action_narrative_semantic_validator(
                actor=actor,
                visible_actors=visible_actors,
                runtime_guidance=runtime_guidance,
                shell=shell,
                max_recipients_per_message=runtime.context.settings.runtime.max_recipients_per_message,
            ),
            log_context=actor_log_context(
                state,
                actor,
                task_key="actor_action_narrative",
                schema=ActorActionNarrative,
                action_type=shell.action_type,
            ),
        )
        total_parse_failures += int(narrative_meta.parse_failure_count)
        total_duration_seconds += float(narrative_meta.duration_seconds)
        if narrative_meta.forced_default:
            proposal = default_proposal
            forced_default = True
        else:
            proposal = assemble_actor_action_proposal(
                shell=shell,
                narrative=narrative,
            )
            proposal = normalize_actor_action_proposal(
                proposal=proposal,
                source_cast_id=cast_id,
                visible_actors=visible_actors,
                goal_snapshot=intent_snapshot,
            )
            forced_default = False

    log_actor_proposal_completed(
        logger=runtime.context.logger,
        round_index=int(state["round_index"]),
        actor=actor,
        proposal=proposal,
        forced_default=forced_default,
        duration_seconds=total_duration_seconds,
    )
    return {
        "pending_actor_proposals": [
            {
                "cast_id": cast_id,
                "unread_activity_ids": list(actor_task.get("unread_activity_ids", [])),
                "proposal": {} if forced_default else proposal.model_dump(mode="json"),
                "forced_idle": forced_default,
                "parse_failure_count": total_parse_failures,
                "latency_seconds": total_duration_seconds,
            }
        ],
    }


def reduce_actor_proposals(state: SimulationWorkflowState) -> dict[str, object]:
    """actor order 기준으로 proposal 결과를 정렬한다."""

    active_order = {
        cast_id: index for index, cast_id in enumerate(state.get("selected_cast_ids", []))
    }
    ordered_results = sorted(
        state.get("pending_actor_proposals", []),
        key=lambda item: active_order.get(str(item["cast_id"]), 10_000),
    )
    return {"pending_actor_proposals": Overwrite(value=ordered_results)}


def object_list(value: object) -> list[object]:
    if not isinstance(value, list):
        return []
    return list(value)


def string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]
