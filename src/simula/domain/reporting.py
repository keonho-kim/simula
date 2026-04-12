"""목적:
- 중단 판단과 최종 리포트 조립 규칙을 제공한다.

설명:
- observer 결과 해석과 실행 요약 조립을 순수 함수로 분리한다.

사용한 설계 패턴:
- 순수 보고 규칙 함수 패턴

연관된 다른 모듈/구조:
- simula.application.workflow.graphs.runtime.nodes.observation
- simula.application.workflow.graphs.finalization.nodes.build_final_report_payload
"""

from __future__ import annotations

from collections import Counter
from typing import cast

from simula.domain.contracts import FinalReport, ObserverReport


def evaluate_stop(
    *,
    step_index: int,
    max_steps: int,
    stagnation_steps: int = 0,
    last_momentum: str | None = None,
) -> tuple[bool, str | None]:
    """현재 단계에서 중단 여부를 판단한다."""

    if step_index >= max_steps:
        return True, "max_steps 도달"
    if stagnation_steps >= 3 and last_momentum == "low":
        return True, "정체 단계 누적"

    return False, None


def build_final_report(
    state: dict[str, object],
) -> dict[str, object]:
    """최종 리포트를 조립한다."""

    activities = _dict_list(state.get("activities", []))
    observer_reports = _dict_list(state.get("observer_reports", []))
    plan = _dict_value(state.get("plan", {}))
    situation = _dict_value(plan.get("situation", {}))

    visibility_counts = Counter(
        str(activity["visibility"])
        for activity in activities
        if "visibility" in activity
    )
    last_summary = ""
    world_state_summary = ""
    notable_events: list[str] = []

    for report in observer_reports:
        validated = ObserverReport.model_validate(report)
        last_summary = validated.summary
        world_state_summary = validated.world_state_summary
        for event in validated.notable_events:
            if event not in notable_events:
                notable_events.append(event)

    final = FinalReport(
        run_id=str(state["run_id"]),
        scenario=str(state["scenario"]),
        objective=str(situation.get("simulation_objective", "")),
        world_summary=str(situation.get("world_summary", "")),
        world_state_summary=world_state_summary,
        elapsed_simulation_minutes=_int_value(
            _dict_value(state.get("simulation_clock", {})).get(
                "total_elapsed_minutes", 0
            )
        ),
        elapsed_simulation_label=str(
            _dict_value(state.get("simulation_clock", {})).get(
                "total_elapsed_label",
                "0분",
            )
        ),
        steps_completed=_int_value(state.get("step_index", 0)),
        actor_count=len(_dict_list(state.get("actors", []))),
        total_activities=len(activities),
        visibility_activity_counts=dict(visibility_counts),
        last_observer_summary=last_summary,
        notable_events=notable_events,
        errors=_string_list(state.get("errors", [])),
    )
    return final.model_dump(mode="json")


def build_simulation_log_entries(
    state: dict[str, object],
) -> list[dict[str, object]]:
    """최종 상태에서 JSONL 출력용 시뮬레이션 로그 엔트리를 만든다."""

    run_id = str(state["run_id"])
    activities = sorted(
        _dict_list(state.get("activities", [])),
        key=lambda item: (
            _int_value(item.get("step_index", 0)),
            str(item.get("activity_id", "")),
        ),
    )
    observer_reports = sorted(
        _dict_list(state.get("observer_reports", [])),
        key=lambda item: _int_value(item.get("step_index", 0)),
    )
    actors = _dict_list(state.get("actors", []))
    final_report = _dict_value(state.get("final_report", {}))
    step_time_history = {
        _int_value(item.get("step_index", 0)): item
        for item in _dict_list(state.get("step_time_history", []))
    }
    step_focus_history = {
        _int_value(item.get("step_index", 0)): item
        for item in _dict_list(state.get("step_focus_history", []))
    }
    background_updates_by_step: dict[int, list[dict[str, object]]] = {}
    for item in _dict_list(state.get("background_updates", [])):
        step_index = _int_value(item.get("step_index", 0))
        background_updates_by_step.setdefault(step_index, []).append(item)

    entries: list[dict[str, object]] = [
        {
            "event": "simulation_started",
            "run_id": run_id,
            "scenario": str(state.get("scenario", "")),
            "max_steps": _int_value(state.get("max_steps", 0)),
            "rng_seed": _optional_int_value(state.get("rng_seed")),
        }
    ]
    plan = _dict_value(state.get("plan", {}))
    if plan:
        entries.append(
            {
                "event": "plan_finalized",
                "run_id": run_id,
                "plan": plan,
            }
        )
    if actors:
        entries.append(
            {
                "event": "actors_finalized",
                "run_id": run_id,
                "actors": actors,
            }
        )

    reports_by_step = {
        _int_value(report.get("step_index", 0)): report for report in observer_reports
    }
    step_indexes = sorted(
        {_int_value(activity.get("step_index", 0)) for activity in activities}
        | set(reports_by_step.keys())
    )

    for step_index in step_indexes:
        if step_index in step_focus_history:
            entries.append(
                {
                    "event": "step_focus_selected",
                    "run_id": run_id,
                    "step_index": step_index,
                    "step_focus_plan": step_focus_history[step_index],
                }
            )
        if step_index in step_time_history:
            entries.append(
                {
                    "event": "step_time_advanced",
                    "run_id": run_id,
                    "step_index": step_index,
                    "time_advance": step_time_history[step_index],
                }
            )
        if step_index in background_updates_by_step:
            entries.append(
                {
                    "event": "step_background_updated",
                    "run_id": run_id,
                    "step_index": step_index,
                    "background_updates": background_updates_by_step[step_index],
                }
            )
        step_activities = [
            activity
            for activity in activities
            if _int_value(activity.get("step_index", 0)) == step_index
        ]
        if step_activities:
            entries.append(
                {
                    "event": "step_actions_adopted",
                    "run_id": run_id,
                    "step_index": step_index,
                    "activities": step_activities,
                }
            )
        if step_index in reports_by_step:
            entries.append(
                {
                    "event": "step_observer_report",
                    "run_id": run_id,
                    "step_index": step_index,
                    "observer_report": reports_by_step[step_index],
                }
            )

    if final_report:
        entries.append(
            {
                "event": "final_report",
                "run_id": run_id,
                "final_report": final_report,
                "stop_reason": state.get("stop_reason"),
            }
        )

    return [{"index": index, **entry} for index, entry in enumerate(entries, start=1)]


def latest_observer_summary(observer_reports: list[dict[str, object]]) -> str:
    """가장 최근 observer 요약을 반환한다."""

    if not observer_reports:
        return "이전 요약 없음"
    return str(observer_reports[-1].get("summary", "이전 요약 없음"))


def latest_world_state_summary(observer_reports: list[dict[str, object]]) -> str:
    """가장 최근 세계 상태 요약을 반환한다."""

    if not observer_reports:
        return "초기 세계 상태 요약 없음"
    return str(
        observer_reports[-1].get("world_state_summary", "초기 세계 상태 요약 없음")
    )


def _string_list(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(item) for item in value]


def _dict_list(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, object], item) for item in value if isinstance(item, dict)]


def _dict_value(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        return {}
    return cast(dict[str, object], value)


def _int_value(value: object) -> int:
    return int(str(value))


def _optional_int_value(value: object) -> int | None:
    if value is None:
        return None
    return int(str(value))
