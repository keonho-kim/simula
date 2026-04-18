"""Purpose:
- Resolve one runtime round in a single required bundle.
"""

from __future__ import annotations

import json
import time
from typing import cast

from langgraph.runtime import Runtime
from langgraph.types import Overwrite

from simula.shared.logging.llm import build_llm_log_context
from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.coordinator.nodes.resolve_round_defaults import (
    build_default_round_resolution_core_payload,
    build_default_round_resolution_narrative_bodies_payload,
    build_default_round_resolution_payload as _build_default_round_resolution_payload,
)
from simula.application.workflow.graphs.coordinator.nodes.resolve_round_state import (
    build_event_memory_history_entry,
    build_updated_clock as _build_updated_clock,
    filter_invalid_adopted_cast_ids,
    merge_actor_intent_states,
    pending_proposals_as_activity_hints,
)
from simula.application.workflow.graphs.coordinator.nodes.resolve_round_validation import (
    build_round_resolution_core_repair_context,
    validate_actor_intent_state_batch_semantics,
    validate_major_event_update_batch_semantics,
    validate_round_resolution_core_semantics,
)
from simula.application.workflow.graphs.coordinator.output_schema.bundles import (
    build_actor_intent_state_batch_prompt_bundle,
    build_major_event_update_batch_prompt_bundle,
    build_round_resolution_core_prompt_bundle,
    build_round_resolution_narrative_bodies_prompt_bundle,
)
from simula.application.workflow.graphs.coordinator.prompts.actor_intent_state_batch_prompt import (
    PROMPT as ACTOR_INTENT_STATE_BATCH_PROMPT,
)
from simula.application.workflow.graphs.coordinator.prompts.major_event_update_batch_prompt import (
    PROMPT as MAJOR_EVENT_UPDATE_BATCH_PROMPT,
)
from simula.application.workflow.graphs.coordinator.prompts.round_resolution_core_prompt import (
    PROMPT as ROUND_RESOLUTION_CORE_PROMPT,
)
from simula.application.workflow.graphs.coordinator.prompts.round_resolution_narrative_bodies_prompt import (
    PROMPT as ROUND_RESOLUTION_NARRATIVE_BODIES_PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.application.workflow.utils.prompt_projections import (
    WORLD_STATE_SUMMARY_LIMIT,
    build_compact_background_updates,
    build_compact_pending_actor_proposals,
    build_event_memory_prompt_view,
    build_planning_coordination_frame_view,
    build_planning_situation_view,
    build_progression_plan_prompt_view,
    build_relevant_intent_states,
    build_visible_action_context,
    truncate_text,
)
from simula.shared.io.streaming import record_simulation_log_event
from simula.domain.contracts import (
    ActorFacingScenarioDigest,
    ActorIntentSnapshot,
    MajorEventUpdate,
    ObserverReport,
    RoundResolution,
    RoundResolutionCore,
    RoundResolutionNarrativeBodies,
)
from simula.domain.event_memory import (
    apply_event_updates,
    build_transition_event_updates,
    evaluate_round_event_updates,
    hard_stop_round,
    has_required_unresolved_events,
    sanitize_event_updates,
)
from simula.domain.reporting.events import (
    build_round_actions_adopted_event,
    build_round_event_memory_updated_event,
    build_round_observer_report_event,
    build_time_advanced_event,
)
from simula.domain.runtime.actions import (
    ActorProposalPayload,
    apply_adopted_actor_proposals,
)
from simula.domain.runtime.policy import next_stagnation_steps
from simula.domain.scenario.time import TimeUnit, duration_label


async def resolve_round(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Resolve adopted actions, observer summary, time, persistence, and stop state."""

    pending_actor_proposals = cast(
        list[dict[str, object]],
        list(state["pending_actor_proposals"]),
    )
    plan = cast(dict[str, object], state.get("plan", {}))
    latest_background_updates = list(state["latest_background_updates"])
    latest_action_views, _ = build_visible_action_context(
        unread_visible_activities=[],
        recent_visible_activities=list(state["latest_round_activities"]),
        limit=6,
    )
    pending_event_match_hints = evaluate_round_event_updates(
        dict(state.get("event_memory", {})),
        latest_round_activities=pending_proposals_as_activity_hints(
            pending_actor_proposals
        ),
        current_round_index=int(state["round_index"]),
    )
    relevant_cast_ids = [
        *list(state["selected_cast_ids"]),
        *[
            str(item.get("cast_id", ""))
            for item in latest_background_updates
            if str(item.get("cast_id", "")).strip()
        ],
    ]
    round_focus_plan_json = json.dumps(
        state["round_focus_plan"],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    pending_actor_proposals_json = json.dumps(
        build_compact_pending_actor_proposals(pending_actor_proposals),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    latest_background_updates_json = json.dumps(
        build_compact_background_updates(latest_background_updates),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    latest_activities_json = json.dumps(
        latest_action_views,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    situation_json = json.dumps(
        build_planning_situation_view(cast(dict[str, object], plan.get("situation", {}))),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    coordination_frame_json = json.dumps(
        build_planning_coordination_frame_view(
            cast(dict[str, object], plan.get("coordination_frame", {}))
        ),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    actor_intent_states_json = json.dumps(
        build_relevant_intent_states(
            list(state["actor_intent_states"]),
            relevant_cast_ids=relevant_cast_ids,
        ),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    actor_facing_scenario_digest_json = json.dumps(
        state.get("actor_facing_scenario_digest", {}),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    simulation_clock_json = json.dumps(
        state["simulation_clock"],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    progression_plan_json = json.dumps(
        build_progression_plan_prompt_view(cast(dict[str, object], plan["progression_plan"])),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    event_memory_json = json.dumps(
        build_event_memory_prompt_view(state.get("event_memory", {}), limit=5),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    event_match_hints_json = json.dumps(
        pending_event_match_hints,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    truncated_world_state_summary = truncate_text(
        state["world_state_summary"],
        WORLD_STATE_SUMMARY_LIMIT,
    )
    default_payload = _build_default_round_resolution_payload(
        state,
        event_updates=pending_event_match_hints["suggested_updates"],
    )
    total_parse_failures = 0
    total_duration_seconds = 0.0

    core_prompt = ROUND_RESOLUTION_CORE_PROMPT.format(
        round_index=state["round_index"],
        round_focus_plan_json=round_focus_plan_json,
        pending_actor_proposals_json=pending_actor_proposals_json,
        latest_background_updates_json=latest_background_updates_json,
        latest_activities_json=latest_activities_json,
        situation_json=situation_json,
        coordination_frame_json=coordination_frame_json,
        simulation_clock_json=simulation_clock_json,
        stagnation_rounds=int(state["stagnation_rounds"]),
        progression_plan_json=progression_plan_json,
        event_memory_json=event_memory_json,
        world_state_summary=truncated_world_state_summary,
        **build_round_resolution_core_prompt_bundle(),
    )
    resolution_core, core_meta = await runtime.context.llms.ainvoke_object_with_meta(
        "coordinator",
        core_prompt,
        RoundResolutionCore,
        default_payload=build_default_round_resolution_core_payload(
            default_resolution=default_payload
        ),
        semantic_validator=lambda parsed: validate_round_resolution_core_semantics(
            resolution_core=parsed,
            pending_actor_proposals=pending_actor_proposals,
        ),
        repair_context=build_round_resolution_core_repair_context(
            pending_actor_proposals=pending_actor_proposals,
        ),
        log_context=build_llm_log_context(
            scope="round-resolution",
            phase="runtime",
            task_key="round_resolution_core",
            task_label="라운드 해소",
            artifact_key="round_resolution",
            artifact_label="round_resolution",
            schema=RoundResolutionCore,
            round_index=int(state["round_index"]),
        ),
    )
    total_parse_failures += int(core_meta.parse_failure_count)
    total_duration_seconds += float(core_meta.duration_seconds)
    forced_default = bool(core_meta.forced_default)
    if forced_default:
        resolution = RoundResolution.model_validate(default_payload)
    else:
        event_batch_prompt = MAJOR_EVENT_UPDATE_BATCH_PROMPT.format(
            round_index=state["round_index"],
            resolution_core_json=json.dumps(
                resolution_core.model_dump(mode="json"),
                ensure_ascii=False,
                separators=(",", ":"),
            ),
            pending_actor_proposals_json=pending_actor_proposals_json,
            latest_activities_json=latest_activities_json,
            event_memory_json=event_memory_json,
            event_match_hints_json=event_match_hints_json,
            **build_major_event_update_batch_prompt_bundle(),
        )
        event_update_batch, event_meta = await runtime.context.llms.ainvoke_simple_with_meta(
            "coordinator",
            event_batch_prompt,
            list[MajorEventUpdate],
            failure_policy="default",
            default_value=[
                MajorEventUpdate.model_validate(item)
                for item in pending_event_match_hints["suggested_updates"]
            ],
            semantic_validator=lambda parsed: validate_major_event_update_batch_semantics(
                major_event_update_batch=parsed,
                event_memory=cast(dict[str, object], state.get("event_memory", {})),
            ),
            log_context=build_llm_log_context(
                scope="round-resolution",
                phase="runtime",
                task_key="round_resolution_event_updates",
                task_label="라운드 해소",
                artifact_key="round_resolution",
                artifact_label="round_resolution",
                contract_kind="simple",
                output_type_name="list[MajorEventUpdate]",
                round_index=int(state["round_index"]),
            ),
        )
        total_parse_failures += int(event_meta.parse_failure_count)
        total_duration_seconds += float(event_meta.duration_seconds)
        forced_default = bool(event_meta.forced_default)
        if forced_default:
            resolution = RoundResolution.model_validate(default_payload)
        else:
            intent_batch_prompt = ACTOR_INTENT_STATE_BATCH_PROMPT.format(
                round_index=state["round_index"],
                resolution_core_json=json.dumps(
                    resolution_core.model_dump(mode="json"),
                    ensure_ascii=False,
                    separators=(",", ":"),
                ),
                round_focus_plan_json=round_focus_plan_json,
                pending_actor_proposals_json=pending_actor_proposals_json,
                latest_background_updates_json=latest_background_updates_json,
                actors_json=json.dumps(
                    list(state["actors"]),
                    ensure_ascii=False,
                    separators=(",", ":"),
                ),
                actor_intent_states_json=actor_intent_states_json,
                **build_actor_intent_state_batch_prompt_bundle(),
            )
            intent_batch, intent_meta = await runtime.context.llms.ainvoke_simple_with_meta(
                "coordinator",
                intent_batch_prompt,
                list[ActorIntentSnapshot],
                failure_policy="default",
                default_value=[],
                semantic_validator=lambda parsed: validate_actor_intent_state_batch_semantics(
                    actor_intent_state_batch=parsed,
                    actors=list(state["actors"]),
                ),
                log_context=build_llm_log_context(
                    scope="round-resolution",
                    phase="runtime",
                    task_key="round_resolution_intent_states",
                    task_label="라운드 해소",
                    artifact_key="round_resolution",
                    artifact_label="round_resolution",
                    contract_kind="simple",
                    output_type_name="list[ActorIntentSnapshot]",
                    round_index=int(state["round_index"]),
                ),
            )
            total_parse_failures += int(intent_meta.parse_failure_count)
            total_duration_seconds += float(intent_meta.duration_seconds)
            forced_default = bool(intent_meta.forced_default)
            if forced_default:
                resolution = RoundResolution.model_validate(default_payload)
            else:
                narrative_bodies_prompt = ROUND_RESOLUTION_NARRATIVE_BODIES_PROMPT.format(
                    round_index=state["round_index"],
                    resolution_core_json=json.dumps(
                        resolution_core.model_dump(mode="json"),
                        ensure_ascii=False,
                        separators=(",", ":"),
                    ),
                    event_updates_json=json.dumps(
                        [item.model_dump(mode="json") for item in event_update_batch],
                        ensure_ascii=False,
                        separators=(",", ":"),
                    ),
                    intent_states_json=json.dumps(
                        [item.model_dump(mode="json") for item in intent_batch],
                        ensure_ascii=False,
                        separators=(",", ":"),
                    ),
                    latest_background_updates_json=latest_background_updates_json,
                    latest_activities_json=latest_activities_json,
                    situation_json=situation_json,
                    coordination_frame_json=coordination_frame_json,
                    actor_facing_scenario_digest_json=actor_facing_scenario_digest_json,
                    world_state_summary=resolution_core.world_state_summary,
                    **build_round_resolution_narrative_bodies_prompt_bundle(),
                )
                narrative_bodies, narrative_meta = (
                    await runtime.context.llms.ainvoke_object_with_meta(
                        "coordinator",
                        narrative_bodies_prompt,
                        RoundResolutionNarrativeBodies,
                        failure_policy="default",
                        default_payload=build_default_round_resolution_narrative_bodies_payload(
                            default_resolution=default_payload
                        ),
                        log_context=build_llm_log_context(
                            scope="round-resolution",
                            phase="runtime",
                            task_key="round_resolution_narrative_bodies",
                            task_label="라운드 해소",
                            artifact_key="round_resolution",
                            artifact_label="round_resolution",
                            schema=RoundResolutionNarrativeBodies,
                            round_index=int(state["round_index"]),
                        ),
                    )
                )
                total_parse_failures += int(narrative_meta.parse_failure_count)
                total_duration_seconds += float(narrative_meta.duration_seconds)
                forced_default = bool(narrative_meta.forced_default)
                if forced_default:
                    resolution = RoundResolution.model_validate(default_payload)
                else:
                    resolution = RoundResolution(
                        adopted_cast_ids=list(resolution_core.adopted_cast_ids),
                        intent_states=list(intent_batch),
                        event_updates=list(event_update_batch),
                        time_advance=resolution_core.time_advance,
                        observer_report=ObserverReport(
                            round_index=int(state["round_index"]),
                            summary=narrative_bodies.observer_report.summary,
                            notable_events=list(
                                narrative_bodies.observer_report.notable_events
                            ),
                            atmosphere=narrative_bodies.observer_report.atmosphere,
                            momentum=narrative_bodies.observer_report.momentum,
                            world_state_summary=resolution_core.world_state_summary,
                        ),
                        actor_facing_scenario_digest=ActorFacingScenarioDigest(
                            round_index=int(state["round_index"]),
                            current_pressures=list(
                                narrative_bodies.actor_facing_scenario_digest.current_pressures
                            ),
                            next_step_notes=list(
                                narrative_bodies.actor_facing_scenario_digest.next_step_notes
                            ),
                            world_state_summary=resolution_core.world_state_summary,
                        ),
                        world_state_summary=resolution_core.world_state_summary,
                        stop_reason=resolution_core.stop_reason,
                    )

    valid_adopted_cast_ids, invalid_adoption_errors = filter_invalid_adopted_cast_ids(
        adopted_cast_ids=list(resolution.adopted_cast_ids),
        pending_actor_proposals=cast(
            list[ActorProposalPayload],
            list(state["pending_actor_proposals"]),
        ),
        actors=list(state["actors"]),
        actor_intent_states=list(state.get("actor_intent_states", [])),
        action_catalog=cast(dict[str, object], state["plan"]["action_catalog"]),
        max_targets_per_activity=runtime.context.settings.runtime.max_recipients_per_message,
    )
    applied = apply_adopted_actor_proposals(
        run_id=state["run_id"],
        round_index=int(state["round_index"]),
        actors=list(state["actors"]),
        activity_feeds=dict(state["activity_feeds"]),
        activities=list(state["activities"]),
        action_catalog=cast(dict[str, object], state["plan"]["action_catalog"]),
        pending_actor_proposals=cast(
            list[ActorProposalPayload],
            list(state["pending_actor_proposals"]),
        ),
        adopted_cast_ids=valid_adopted_cast_ids,
        max_targets_per_activity=runtime.context.settings.runtime.max_recipients_per_message,
    )
    applied_event_hints = evaluate_round_event_updates(
        dict(state.get("event_memory", {})),
        latest_round_activities=list(applied["latest_round_activities"]),
        current_round_index=int(state["round_index"]),
    )
    sanitized_event_updates = sanitize_event_updates(
        dict(state.get("event_memory", {})),
        proposed_updates=[
            item.model_dump(mode="json") for item in resolution.event_updates
        ],
        latest_round_activities=list(applied["latest_round_activities"]),
        evaluation_hints=applied_event_hints,
    )
    next_event_memory = apply_event_updates(
        dict(state.get("event_memory", {})),
        event_updates=sanitized_event_updates,
        current_round_index=int(state["round_index"]),
    )
    clock = _build_updated_clock(
        state=state,
        time_advance=resolution.time_advance.model_dump(mode="json"),
    )
    report_payload = resolution.observer_report.model_dump(mode="json")
    observer_reports = list(state["observer_reports"]) + [report_payload]
    stagnation_rounds = next_stagnation_steps(
        previous_stagnation_steps=int(state["stagnation_rounds"]),
        latest_activities=list(applied["latest_round_activities"]),
        momentum=resolution.observer_report.momentum,
    )
    stop_reason = resolution.stop_reason
    planned_max_rounds = int(state.get("planned_max_rounds", state["max_rounds"]))
    hard_stop = hard_stop_round(
        configured_max_rounds=int(state["max_rounds"]),
        planned_max_rounds=planned_max_rounds,
    )
    if (
        stop_reason == "simulation_done"
        and has_required_unresolved_events(next_event_memory)
        and int(state["round_index"]) < hard_stop
    ):
        stop_reason = ""
    if stop_reason == "simulation_done" and has_required_unresolved_events(next_event_memory):
        next_event_memory = apply_event_updates(
            next_event_memory,
            event_updates=[],
            current_round_index=int(state["round_index"]),
            finalize_unresolved_as_missed=True,
        )
    actual_event_updates = build_transition_event_updates(
        dict(state.get("event_memory", {})),
        next_event_memory,
    )
    stop_requested = bool(stop_reason)
    digest = resolution.actor_facing_scenario_digest
    runtime.context.logger.info(
        "ROUND %s 해소\n채택: %s명 | 사건 %s건 | 시간 +%s | stop %s\n사건: %s\n압력: %s",
        state["round_index"],
        len(list(resolution.adopted_cast_ids)),
        len(actual_event_updates),
        _round_elapsed_label(clock["time_advance"]),
        stop_reason or "continue",
        _event_summary_preview(resolution),
        ", ".join(digest.current_pressures[:2]) or "-",
    )
    runtime.context.store.save_round_artifacts(
        state["run_id"],
        activities=list(applied["latest_round_activities"]),
        observer_report=report_payload,
    )
    record_simulation_log_event(
        runtime.context,
        build_time_advanced_event(
            run_id=str(state["run_id"]),
            round_index=int(state["round_index"]),
            time_advance=clock["time_advance"],
        ),
    )
    if list(applied["latest_round_activities"]):
        record_simulation_log_event(
            runtime.context,
            build_round_actions_adopted_event(
                run_id=str(state["run_id"]),
                round_index=int(state["round_index"]),
                activities=list(applied["latest_round_activities"]),
            ),
        )
    record_simulation_log_event(
        runtime.context,
        build_round_observer_report_event(
            run_id=str(state["run_id"]),
            round_index=int(state["round_index"]),
            observer_report=report_payload,
        ),
    )
    event_memory_history_entry = build_event_memory_history_entry(
        round_index=int(state["round_index"]),
        source="resolve_round",
        event_updates=actual_event_updates,
        event_memory=next_event_memory,
        requested_stop_reason=resolution.stop_reason,
        effective_stop_reason=stop_reason,
    )
    record_simulation_log_event(
        runtime.context,
        build_round_event_memory_updated_event(
            run_id=str(state["run_id"]),
            round_index=int(state["round_index"]),
            source=str(event_memory_history_entry["source"]),
            event_updates=cast(list[dict[str, object]], event_memory_history_entry.get("event_updates", [])),
            event_memory_summary=cast(
                dict[str, object], event_memory_history_entry["event_memory_summary"]
            ),
            stop_context=cast(dict[str, object], event_memory_history_entry["stop_context"]),
        ),
    )
    errors = list(state["errors"]) + invalid_adoption_errors
    if forced_default:
        errors.append(f"round {state['round_index']} resolution defaulted")
    next_actor_intent_states = merge_actor_intent_states(
        actors=list(state["actors"]),
        current_actor_intent_states=list(state.get("actor_intent_states", [])),
        updated_actor_intent_states=[
            item.model_dump(mode="json") for item in resolution.intent_states
        ],
    )
    return {
        "activity_feeds": applied["activity_feeds"],
        "activities": applied["activities"],
        "latest_round_activities": applied["latest_round_activities"],
        "pending_actor_proposals": Overwrite(value=[]),
        "actor_intent_states": next_actor_intent_states,
        "event_memory": next_event_memory,
        "event_memory_history": list(state.get("event_memory_history", []))
        + [event_memory_history_entry],
        "intent_history": list(state["intent_history"])
        + [
            {
                "round_index": int(state["round_index"]),
                "actor_intent_states": next_actor_intent_states,
            }
        ],
        "time_advance": clock["time_advance"],
        "simulation_clock": clock["simulation_clock"],
        "round_time_history": list(state["round_time_history"])
        + [clock["time_advance"]],
        "observer_reports": observer_reports,
        "actor_facing_scenario_digest": resolution.actor_facing_scenario_digest.model_dump(
            mode="json"
        ),
        "world_state_summary": resolution.world_state_summary,
        "stagnation_rounds": stagnation_rounds,
        "stop_requested": stop_requested,
        "stop_reason": stop_reason,
        "parse_failures": int(state["parse_failures"])
        + applied["parse_failure_count"]
        + total_parse_failures,
        "forced_idles": int(state["forced_idles"]) + applied["forced_idle_count"],
        "last_round_latency_seconds": time.perf_counter()
        - float(state["current_round_started_at"]),
        "errors": errors,
    }


def _round_elapsed_label(time_advance: dict[str, object]) -> str:
    elapsed_unit = str(time_advance.get("elapsed_unit", "")).strip()
    elapsed_amount = _int_value(time_advance.get("elapsed_amount"), default=0)
    if not elapsed_unit or elapsed_amount < 1:
        return "-"
    return duration_label(
        time_unit=cast(TimeUnit, elapsed_unit),
        amount=elapsed_amount,
    )


def _event_summary_preview(resolution: RoundResolution) -> str:
    notable_events = list(resolution.observer_report.notable_events)
    if notable_events:
        return truncate_text(notable_events[0], 90)
    return truncate_text(resolution.world_state_summary, 90)


def _int_value(value: object, *, default: int) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        stripped = value.strip()
        if stripped:
            return int(stripped)
    return default
