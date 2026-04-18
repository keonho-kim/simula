"""Purpose:
- Build the single required round directive.
"""

from __future__ import annotations

import json

from langgraph.runtime import Runtime

from simula.shared.logging.llm import build_llm_log_context
from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.coordinator.nodes.build_round_directive_defaults import (
    build_default_round_directive_focus_core_payload,
    build_default_round_directive_payload as _build_default_round_directive_payload,
)
from simula.application.workflow.graphs.coordinator.nodes.build_round_directive_state import (
    assemble_round_directive_from_stages,
    inject_stagnation_background_hook,
    normalize_round_directive,
)
from simula.application.workflow.graphs.coordinator.nodes.build_round_directive_validation import (
    build_round_directive_focus_core_repair_context,
    validate_background_update_batch_semantics,
    validate_round_directive_focus_core_semantics,
)
from simula.application.workflow.graphs.coordinator.output_schema.bundles import (
    build_background_update_batch_prompt_bundle,
    build_round_directive_focus_core_prompt_bundle,
)
from simula.application.workflow.graphs.coordinator.prompts.background_update_batch_prompt import (
    PROMPT as BUILD_BACKGROUND_UPDATE_BATCH_PROMPT,
)
from simula.application.workflow.graphs.coordinator.prompts.round_directive_focus_core_prompt import (
    PROMPT as BUILD_ROUND_DIRECTIVE_FOCUS_CORE_PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.application.workflow.graphs.coordinator.nodes.coercion import (
    as_dict_list,
    as_string_list,
)
from simula.application.workflow.utils.prompt_projections import (
    PREVIOUS_SUMMARY_LIMIT,
    build_deferred_actor_views,
    build_event_memory_prompt_view,
    build_focus_candidates_prompt_view,
    build_focus_plan_coordination_frame_view,
    build_focus_plan_situation_view,
    truncate_text,
)
from simula.shared.io.streaming import record_simulation_log_event
from simula.domain.contracts import (
    BackgroundUpdate,
    RoundDirective,
    RoundDirectiveFocusCore,
)
from simula.domain.reporting.events import (
    build_round_background_updated_event,
    build_round_focus_selected_event,
)
from simula.domain.reporting.reports import latest_observer_summary


async def build_round_directive(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """Build one required round directive including background updates."""

    max_focus_slices = runtime.context.settings.runtime.max_focus_slices_per_step
    max_actor_calls = runtime.context.settings.runtime.max_actor_calls_per_step
    focus_candidates_json = json.dumps(
        build_focus_candidates_prompt_view(list(state["focus_candidates"])),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    coordination_frame_json = json.dumps(
        build_focus_plan_coordination_frame_view(state["plan"]["coordination_frame"]),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    situation_json = json.dumps(
        build_focus_plan_situation_view(state["plan"]["situation"]),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    simulation_clock_json = json.dumps(
        state["simulation_clock"],
        ensure_ascii=False,
        separators=(",", ":"),
    )
    event_memory_json = json.dumps(
        build_event_memory_prompt_view(state.get("event_memory", {})),
        ensure_ascii=False,
        separators=(",", ":"),
    )
    previous_observer_summary = truncate_text(
        latest_observer_summary(list(state["observer_reports"])),
        PREVIOUS_SUMMARY_LIMIT,
    )
    default_payload = _build_default_round_directive_payload(
        state=state,
        max_focus_slices=max_focus_slices,
        max_actor_calls=max_actor_calls,
    )
    total_parse_failures = 0
    total_duration_seconds = 0.0
    background_defaulted = False

    focus_core_prompt = BUILD_ROUND_DIRECTIVE_FOCUS_CORE_PROMPT.format(
        round_index=state["round_index"],
        focus_candidates_json=focus_candidates_json,
        coordination_frame_json=coordination_frame_json,
        situation_json=situation_json,
        simulation_clock_json=simulation_clock_json,
        event_memory_json=event_memory_json,
        previous_observer_summary=previous_observer_summary,
        max_focus_slices_per_step=max_focus_slices,
        max_actor_calls_per_step=max_actor_calls,
        **build_round_directive_focus_core_prompt_bundle(),
    )
    focus_core, focus_meta = await runtime.context.llms.ainvoke_object_with_meta(
        "coordinator",
        focus_core_prompt,
        RoundDirectiveFocusCore,
        failure_policy="default",
        default_payload=build_default_round_directive_focus_core_payload(
            default_directive=default_payload,
            as_dict_list=as_dict_list,
        ),
        semantic_validator=lambda parsed: validate_round_directive_focus_core_semantics(
            focus_core=parsed,
            focus_candidates=list(state.get("focus_candidates", [])),
            max_actor_calls=max_actor_calls,
        ),
        repair_context=build_round_directive_focus_core_repair_context(
            focus_candidates=list(state.get("focus_candidates", [])),
            max_focus_slices=max_focus_slices,
            max_actor_calls=max_actor_calls,
        ),
        log_context=build_llm_log_context(
            scope="round-directive",
            phase="runtime",
            task_key="round_directive_focus_core",
            task_label="라운드 지시안 작성",
            artifact_key="round_focus_plan",
            artifact_label="round_focus_plan",
            schema=RoundDirectiveFocusCore,
            round_index=int(state["round_index"]),
        ),
    )
    total_parse_failures += int(focus_meta.parse_failure_count)
    total_duration_seconds += float(focus_meta.duration_seconds)
    forced_default = bool(focus_meta.forced_default)
    if forced_default:
        normalized = normalize_round_directive(
            directive=default_payload,
            focus_candidates=list(state["focus_candidates"]),
            max_focus_slices=max_focus_slices,
            max_actor_calls=max_actor_calls,
            as_dict_list=as_dict_list,
            as_string_list=as_string_list,
        )
    else:
        provisional_directive = assemble_round_directive_from_stages(
            state=state,
            focus_core=focus_core,
            background_updates=[],
            focus_candidates=list(state["focus_candidates"]),
        )
        provisional_normalized = normalize_round_directive(
            directive=provisional_directive,
            focus_candidates=list(state["focus_candidates"]),
            max_focus_slices=max_focus_slices,
            max_actor_calls=max_actor_calls,
            as_dict_list=as_dict_list,
            as_string_list=as_string_list,
        )
        deferred_cast_ids = as_string_list(
            provisional_normalized.get("deferred_cast_ids", [])
        )
        deferred_actors = [
            actor
            for actor in list(state["actors"])
            if str(actor.get("cast_id", "")) in set(deferred_cast_ids)
        ]
        background_prompt = BUILD_BACKGROUND_UPDATE_BATCH_PROMPT.format(
            round_index=state["round_index"],
            deferred_actors_json=json.dumps(
                build_deferred_actor_views(deferred_actors),
                ensure_ascii=False,
                separators=(",", ":"),
            ),
            valid_deferred_cast_ids_json=json.dumps(
                deferred_cast_ids,
                ensure_ascii=False,
                separators=(",", ":"),
            ),
            focus_core_json=json.dumps(
                focus_core.model_dump(mode="json"),
                ensure_ascii=False,
                separators=(",", ":"),
            ),
            coordination_frame_json=coordination_frame_json,
            situation_json=situation_json,
            event_memory_json=event_memory_json,
            previous_observer_summary=previous_observer_summary,
            **build_background_update_batch_prompt_bundle(),
        )
        (
            background_batch,
            background_meta,
        ) = await runtime.context.llms.ainvoke_simple_with_meta(
            "coordinator",
            background_prompt,
            list[BackgroundUpdate],
            failure_policy="default",
            default_value=[],
            semantic_validator=lambda parsed: (
                validate_background_update_batch_semantics(
                    background_update_batch=parsed,
                    deferred_cast_ids=deferred_cast_ids,
                    round_index=int(state["round_index"]),
                )
            ),
            log_context=build_llm_log_context(
                scope="round-directive",
                phase="runtime",
                task_key="round_directive_background_updates",
                task_label="라운드 지시안 작성",
                artifact_key="round_focus_plan",
                artifact_label="round_focus_plan",
                contract_kind="simple",
                output_type_name="list[BackgroundUpdate]",
                round_index=int(state["round_index"]),
            ),
        )
        total_parse_failures += int(background_meta.parse_failure_count)
        total_duration_seconds += float(background_meta.duration_seconds)
        background_defaulted = bool(background_meta.forced_default)
        if background_defaulted:
            forced_default = False
            normalized = provisional_normalized
        else:
            assembled = assemble_round_directive_from_stages(
                state=state,
                focus_core=focus_core,
                background_updates=[
                    item.model_dump(mode="json")
                    for item in background_batch
                ],
                focus_candidates=list(state["focus_candidates"]),
            )
            directive = RoundDirective.model_validate(assembled)
            normalized = normalize_round_directive(
                directive=directive.model_dump(mode="json"),
                focus_candidates=list(state["focus_candidates"]),
                max_focus_slices=max_focus_slices,
                max_actor_calls=max_actor_calls,
                as_dict_list=as_dict_list,
                as_string_list=as_string_list,
            )
    normalized = inject_stagnation_background_hook(
        state=state,
        directive=normalized,
        as_dict_list=as_dict_list,
        as_string_list=as_string_list,
    )
    errors = list(state["errors"])
    if forced_default:
        errors.append(f"round {state['round_index']} directive defaulted")
    if background_defaulted:
        errors.append(f"round {state['round_index']} background updates defaulted")
    record_simulation_log_event(
        runtime.context,
        build_round_focus_selected_event(
            run_id=str(state["run_id"]),
            round_index=int(state["round_index"]),
            round_focus_plan=normalized,
        ),
    )
    background_updates = as_dict_list(normalized.get("background_updates", []))
    if background_updates:
        record_simulation_log_event(
            runtime.context,
            build_round_background_updated_event(
                run_id=str(state["run_id"]),
                round_index=int(state["round_index"]),
                background_updates=background_updates,
            ),
        )
    runtime.context.logger.info(
        "ROUND %s 지시 확정\n초점: %s\n참여: %s\n행동 제안 대기: %s명 | background %s명",
        int(state["round_index"]),
        _focus_title_preview(normalized),
        _cast_preview(as_string_list(normalized.get("selected_cast_ids", []))),
        len(as_string_list(normalized.get("selected_cast_ids", []))),
        len(background_updates),
    )
    return {
        "round_focus_plan": normalized,
        "round_focus_history": list(state["round_focus_history"]) + [normalized],
        "selected_cast_ids": as_string_list(normalized.get("selected_cast_ids", [])),
        "deferred_cast_ids": as_string_list(normalized.get("deferred_cast_ids", [])),
        "latest_background_updates": background_updates,
        "background_updates": list(state["background_updates"]) + background_updates,
        "errors": errors,
        "parse_failures": int(state.get("parse_failures", 0)) + total_parse_failures,
    }


def _focus_title_preview(round_focus_plan: dict[str, object]) -> str:
    focus_slices = as_dict_list(round_focus_plan.get("focus_slices", []))
    if not focus_slices:
        return str(round_focus_plan.get("focus_summary", "")).strip() or "-"
    first_title = str(focus_slices[0].get("title", "")).strip()
    if first_title:
        return first_title
    return str(round_focus_plan.get("focus_summary", "")).strip() or "-"


def _cast_preview(cast_ids: list[str]) -> str:
    if not cast_ids:
        return "-"
    if len(cast_ids) <= 4:
        return ", ".join(cast_ids)
    head = ", ".join(cast_ids[:4])
    return f"{head} 외 {len(cast_ids) - 4}명"
