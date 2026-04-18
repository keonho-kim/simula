"""Purpose:
- Render the console summary for completed runs.
"""

from __future__ import annotations

import json
from typing import cast

from simula.application.commands.simulation_runs import TrialRunOutcome
from simula.domain.reporting.reports import render_llm_usage_lines


def print_final_report(
    final_report: dict[str, object],
    final_report_markdown: str | None = None,
) -> None:
    """최종 리포트를 사람이 읽기 쉬운 형태로 출력한다."""

    print("=== simula 최종 요약 ===")
    print(f"run_id: {final_report['run_id']}")
    print(f"누적 시뮬레이션 시간: {final_report['elapsed_simulation_label']}")
    print(f"완료 round: {final_report['rounds_completed']}")
    print(f"actor 수: {final_report['actor_count']}")
    print(f"총 activity 수: {final_report['total_activities']}")
    print(f"마지막 관찰 요약: {final_report['last_observer_summary']}")
    print("LLM 사용 요약:")
    for line in render_llm_usage_lines(_dict_value(final_report.get("llm_usage_summary"))):
        print(f"- {line}")
    print("")
    if isinstance(final_report_markdown, str) and final_report_markdown.strip():
        print(final_report_markdown.strip())
        return
    print(json.dumps(final_report, ensure_ascii=False, indent=2))


def print_trial_run_summary(
    trials: list[TrialRunOutcome],
    *,
    parallel: bool,
) -> None:
    """반복 실행 결과 요약을 출력한다."""

    print("=== simula 반복 실행 요약 ===")
    print(f"graph_parallel: {parallel}")
    print(f"trials: {len(trials)}")
    print("")
    print("trial | success | run_id | llm_calls | llm_roles | error")
    for trial in trials:
        final_report = trial.final_report if isinstance(trial.final_report, dict) else {}
        llm_usage_summary = _dict_value(final_report.get("llm_usage_summary"))
        total_calls = llm_usage_summary.get("total_calls", "-")
        usage_lines = render_llm_usage_lines(llm_usage_summary)
        role_summary = next(
            (line for line in usage_lines if line.startswith("역할별 호출:")),
            "역할별 호출: -",
        )
        print(
            f"{trial.trial_index} | {trial.success} | {trial.run_id} | "
            f"{total_calls} | {role_summary} | {trial.error or '-'}"
        )


def _dict_value(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        return {}
    return cast(dict[str, object], value)
