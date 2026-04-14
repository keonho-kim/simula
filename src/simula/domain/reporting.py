"""Purpose:
- Provide pure stop-evaluation and reporting helpers.
"""

from __future__ import annotations

from collections import Counter
from typing import cast

from simula.domain.log_events import (
    build_actors_finalized_event,
    build_final_report_event,
    build_llm_usage_summary_event,
    build_plan_finalized_event,
    build_round_actions_adopted_event,
    build_round_background_updated_event,
    build_round_focus_selected_event,
    build_round_observer_report_event,
    build_round_time_advanced_event,
    build_simulation_started_event,
)
from simula.domain.contracts import (
    FinalReport,
    LLMUsageSummary,
    ObserverReport,
    StopReason,
)


def evaluate_stop(
    *,
    round_index: int,
    max_rounds: int,
) -> StopReason:
    """Return the deterministic terminal stop reason for the runtime loop."""

    if round_index >= max_rounds:
        return "simulation_done"
    return ""


def build_final_report(
    state: dict[str, object],
    *,
    llm_usage_summary: dict[str, object],
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
        rounds_completed=_int_value(state.get("round_index", 0)),
        actor_count=len(_dict_list(state.get("actors", []))),
        total_activities=len(activities),
        visibility_activity_counts=dict(visibility_counts),
        last_observer_summary=last_summary,
        notable_events=notable_events,
        errors=_string_list(state.get("errors", [])),
        llm_usage_summary=LLMUsageSummary.model_validate(llm_usage_summary),
    )
    return final.model_dump(mode="json")


def build_simulation_log_entries(
    state: dict[str, object],
    *,
    llm_usage_summary: dict[str, object],
) -> list[dict[str, object]]:
    """최종 상태에서 JSONL 출력용 시뮬레이션 로그 엔트리를 만든다."""

    run_id = str(state["run_id"])
    activities = sorted(
        _dict_list(state.get("activities", [])),
        key=lambda item: (
            _int_value(item.get("round_index", 0)),
            str(item.get("activity_id", "")),
        ),
    )
    observer_reports = sorted(
        _dict_list(state.get("observer_reports", [])),
        key=lambda item: _int_value(item.get("round_index", 0)),
    )
    actors = _dict_list(state.get("actors", []))
    final_report = _dict_value(state.get("final_report", {}))
    round_time_history = {
        _int_value(item.get("round_index", 0)): item
        for item in _dict_list(state.get("round_time_history", []))
    }
    round_focus_history = {
        _int_value(item.get("round_index", 0)): item
        for item in _dict_list(state.get("round_focus_history", []))
    }
    background_updates_by_round: dict[int, list[dict[str, object]]] = {}
    for item in _dict_list(state.get("background_updates", [])):
        round_index = _int_value(item.get("round_index", 0))
        background_updates_by_round.setdefault(round_index, []).append(item)

    entries: list[dict[str, object]] = [
        build_simulation_started_event(
            run_id=run_id,
            scenario=state.get("scenario", ""),
            max_rounds=state.get("max_rounds", 0),
            rng_seed=state.get("rng_seed"),
        )
    ]
    plan = _dict_value(state.get("plan", {}))
    if plan:
        entries.append(
            build_plan_finalized_event(
                run_id=run_id,
                plan=plan,
            )
        )
    if actors:
        entries.append(
            build_actors_finalized_event(
                run_id=run_id,
                actors=actors,
            )
        )

    reports_by_round = {
        _int_value(report.get("round_index", 0)): report for report in observer_reports
    }
    round_indexes = sorted(
        {_int_value(activity.get("round_index", 0)) for activity in activities}
        | set(reports_by_round.keys())
    )

    for round_index in round_indexes:
        if round_index in round_focus_history:
            entries.append(
                build_round_focus_selected_event(
                    run_id=run_id,
                    round_index=round_index,
                    round_focus_plan=round_focus_history[round_index],
                )
            )
        if round_index in round_time_history:
            entries.append(
                build_round_time_advanced_event(
                    run_id=run_id,
                    round_index=round_index,
                    time_advance=round_time_history[round_index],
                )
            )
        if round_index in background_updates_by_round:
            entries.append(
                build_round_background_updated_event(
                    run_id=run_id,
                    round_index=round_index,
                    background_updates=background_updates_by_round[round_index],
                )
            )
        round_activities = [
            activity
            for activity in activities
            if _int_value(activity.get("round_index", 0)) == round_index
        ]
        if round_activities:
            entries.append(
                build_round_actions_adopted_event(
                    run_id=run_id,
                    round_index=round_index,
                    activities=round_activities,
                )
            )
        if round_index in reports_by_round:
            entries.append(
                build_round_observer_report_event(
                    run_id=run_id,
                    round_index=round_index,
                    observer_report=reports_by_round[round_index],
                )
            )

    if final_report:
        entries.append(
            build_final_report_event(
                run_id=run_id,
                final_report=final_report,
                stop_reason=state.get("stop_reason"),
            )
        )
    entries.append(
        build_llm_usage_summary_event(
            run_id=run_id,
            llm_usage_summary=llm_usage_summary,
        )
    )

    return [{"index": index, **entry} for index, entry in enumerate(entries, start=1)]


def render_llm_usage_lines(llm_usage_summary: dict[str, object]) -> list[str]:
    """사람이 읽기 쉬운 LLM usage summary 줄 목록을 만든다."""

    calls_by_role = _dict_value(llm_usage_summary.get("calls_by_role", {}))
    role_summary = ", ".join(
        f"{role}={_int_value(count)}"
        for role, count in sorted(calls_by_role.items(), key=lambda item: str(item[0]))
    )
    return [
        f"총 호출 수: {_int_value(llm_usage_summary.get('total_calls', 0))}",
        f"구조화 호출: {_int_value(llm_usage_summary.get('structured_calls', 0))}",
        f"원문 호출: {_int_value(llm_usage_summary.get('text_calls', 0))}",
        f"역할별 호출: {role_summary or '-'}",
        f"파싱 실패 누적: {_int_value(llm_usage_summary.get('parse_failures', 0))}",
        f"기본값 강등: {_int_value(llm_usage_summary.get('forced_defaults', 0))}",
        "토큰 입력/출력/전체: "
        f"{_format_optional_int(llm_usage_summary.get('input_tokens'))}"
        f" / {_format_optional_int(llm_usage_summary.get('output_tokens'))}"
        f" / {_format_optional_int(llm_usage_summary.get('total_tokens'))}",
    ]


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


def _format_optional_int(value: object) -> str:
    if value is None:
        return "-"
    return str(_int_value(value))
