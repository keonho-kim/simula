"""Purpose:
- Render the console summary and persist single-run outputs.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import cast

from simula.application.commands.simulation_runs import TrialRunOutcome
from simula.domain.reporting import render_llm_usage_lines


@dataclass(slots=True)
class SavedRunOutputs:
    """단일 실행 저장 산출물 경로 묶음이다."""

    run_dir: Path
    simulation_log_path: Path
    final_report_path: Path


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


def write_single_run_outputs(
    *,
    output_dir: str,
    run_id: str,
    final_state: dict[str, object],
) -> SavedRunOutputs:
    """Persist one run's JSONL log and markdown report."""

    run_dir = Path(output_dir) / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    simulation_log_path = run_dir / "simulation.log.jsonl"
    final_report_path = run_dir / "final_report.md"

    simulation_log_jsonl = final_state.get("simulation_log_jsonl")
    if not isinstance(simulation_log_jsonl, str) or not simulation_log_jsonl.strip():
        raise ValueError("simulation_log_jsonl is empty.")
    simulation_log_path.write_text(
        simulation_log_jsonl.rstrip() + "\n",
        encoding="utf-8",
    )
    final_report_markdown = final_state.get("final_report_markdown")
    if not isinstance(final_report_markdown, str) or not final_report_markdown.strip():
        raise ValueError("최종 보고서 markdown이 비어 있습니다.")
    final_report_path.write_text(final_report_markdown.strip() + "\n", encoding="utf-8")
    return SavedRunOutputs(
        run_dir=run_dir,
        simulation_log_path=simulation_log_path,
        final_report_path=final_report_path,
    )


def print_trial_run_summary(
    trials: list[TrialRunOutcome],
    *,
    parallel: bool,
) -> None:
    """반복 실행 결과 요약을 출력한다."""

    print("=== simula 반복 실행 요약 ===")
    print(f"parallel: {parallel}")
    print(f"trials: {len(trials)}")
    print("")
    print("trial | success | run_id | llm_calls | llm_roles | error")
    for trial in trials:
        final_report = trial.final_report if isinstance(trial.final_report, dict) else {}
        llm_usage_summary = _dict_value(final_report.get("llm_usage_summary"))
        total_calls = llm_usage_summary.get("total_calls", "-")
        role_summary = ", ".join(render_llm_usage_lines(llm_usage_summary)[3:4]) or "-"
        print(
            f"{trial.trial_index} | {trial.success} | {trial.run_id} | "
            f"{total_calls} | {role_summary} | {trial.error or '-'}"
        )


def _dict_value(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        return {}
    return cast(dict[str, object], value)
