"""목적:
- observer 관련 runtime 노드를 제공한다.

설명:
- coordinator가 확정한 step 결과를 observer가 요약하고 종료 판단에 필요한 신호를 만든다.

사용한 설계 패턴:
- observation node 패턴
"""

from __future__ import annotations

import json
from typing import cast

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.runtime.prompts.observe_step_prompt import (
    PROMPT as OBSERVE_STEP_PROMPT,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.application.workflow.utils.prompt_projections import (
    build_compact_background_updates,
    build_prior_state_digest,
    build_relevant_intent_states,
    build_visible_action_context,
)
from simula.domain.reporting import evaluate_stop
from simula.domain.runtime_policy import next_stagnation_steps
from simula.domain.contracts import ObserverReport
from simula.prompts.shared.output_examples import build_output_prompt_bundle


async def observe_step(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """이번 step의 adopted action과 background update를 observer가 요약한다."""

    latest_actions = list(state.get("latest_step_activities", []))
    latest_background_updates = list(state.get("latest_background_updates", []))
    if not latest_actions and not latest_background_updates:
        report = ObserverReport(
            step_index=state["step_index"],
            summary="이번 단계에는 직접 반영된 action과 배경 압력 변화가 거의 없었다.",
            notable_events=["상태 정체"],
            atmosphere="정체",
            momentum="low",
            world_state_summary=str(
                state.get("world_state_summary", "상태 변화가 크지 않다.")
            ),
        )
    else:
        latest_action_views, _ = build_visible_action_context(
            unread_visible_activities=[],
            recent_visible_activities=latest_actions,
            limit=6,
        )
        latest_background_update_views = build_compact_background_updates(
            latest_background_updates
        )
        relevant_actor_ids = [
            str(item.get("source_actor_id", ""))
            for item in latest_actions
            if str(item.get("source_actor_id", "")).strip()
        ]
        for item in latest_actions:
            relevant_actor_ids.extend(
                str(actor_id)
                for actor_id in item.get("target_actor_ids", [])
                if str(actor_id).strip()
            )
            relevant_actor_ids.extend(
                str(actor_id)
                for actor_id in item.get("intent_target_actor_ids", [])
                if str(actor_id).strip()
            )
        relevant_actor_ids.extend(
            str(item.get("actor_id", ""))
            for item in latest_background_updates
            if str(item.get("actor_id", "")).strip()
        )
        prompt = OBSERVE_STEP_PROMPT.format(
            step_index=state["step_index"],
            simulation_clock_json=json.dumps(
                state.get("simulation_clock", {}),
                ensure_ascii=False,
                separators=(",", ":"),
            ),
            step_time_advance_json=json.dumps(
                state.get("pending_step_time_advance", {}),
                ensure_ascii=False,
                separators=(",", ":"),
            ),
            latest_activities_json=json.dumps(
                latest_action_views,
                ensure_ascii=False,
                separators=(",", ":"),
            ),
            current_intent_states_json=json.dumps(
                build_relevant_intent_states(
                    list(state.get("actor_intent_states", [])),
                    relevant_actor_ids=relevant_actor_ids,
                ),
                ensure_ascii=False,
                separators=(",", ":"),
            ),
            latest_background_updates_json=json.dumps(
                latest_background_update_views,
                ensure_ascii=False,
                separators=(",", ":"),
            ),
            prior_state_digest_json=json.dumps(
                build_prior_state_digest(
                    observer_reports=list(state.get("observer_reports", [])),
                    world_state_summary=state.get("world_state_summary", ""),
                    step_focus_history=list(state.get("step_focus_history", [])),
                    simulation_clock=cast(
                        dict[str, object],
                        state.get("simulation_clock", {}),
                    ),
                ),
                ensure_ascii=False,
                separators=(",", ":"),
            ),
            **build_output_prompt_bundle(ObserverReport),
        )
        report, meta = await runtime.context.llms.ainvoke_structured_with_meta(
            "observer",
            prompt,
            ObserverReport,
            log_context=_observer_log_context(state),
        )
        parse_failures = meta.parse_failure_count
        report_payload = report.model_dump(mode="json")
        return _build_observer_state_update(
            state=state,
            report_payload=report_payload,
            momentum=report.momentum,
            latest_actions=latest_actions,
            parse_failures=parse_failures,
        )

    report_payload = report.model_dump(mode="json")
    return _build_observer_state_update(
        state=state,
        report_payload=report_payload,
        momentum=report.momentum,
        latest_actions=latest_actions,
        parse_failures=0,
    )


def stop_step(
    state: SimulationWorkflowState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> dict[str, object]:
    """observer 결과 기준으로 중단 여부를 정한다."""

    del runtime
    latest_report = cast(dict[str, object], list(state.get("observer_reports", []))[-1])
    should_stop, stop_reason = evaluate_stop(
        step_index=int(state["step_index"]),
        max_steps=int(state["max_steps"]),
        stagnation_steps=int(state.get("stagnation_steps", 0)),
        last_momentum=str(latest_report.get("momentum", "")),
    )
    return {
        "stop_requested": should_stop,
        "stop_reason": stop_reason,
    }


def _build_observer_state_update(
    *,
    state: SimulationWorkflowState,
    report_payload: dict[str, object],
    momentum: str,
    latest_actions: list[dict[str, object]],
    parse_failures: int,
) -> dict[str, object]:
    observer_reports = list(state.get("observer_reports", [])) + [report_payload]
    stagnation_steps = next_stagnation_steps(
        previous_stagnation_steps=int(state.get("stagnation_steps", 0)),
        latest_activities=latest_actions,
        momentum=momentum,
    )
    return {
        "observer_reports": observer_reports,
        "pending_observer_report": report_payload,
        "stagnation_steps": stagnation_steps,
        "world_state_summary": str(report_payload.get("world_state_summary", "")),
        "parse_failures": int(state.get("parse_failures", 0)) + parse_failures,
    }


def _observer_log_context(state: SimulationWorkflowState) -> dict[str, object]:
    return {
        "step_index": int(state["step_index"]),
        "simulation_clock_label": str(
            cast(dict[str, object], state.get("simulation_clock", {})).get(
                "total_elapsed_label",
                "0분",
            )
        ),
    }
