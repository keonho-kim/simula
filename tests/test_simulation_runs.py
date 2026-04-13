"""목적:
- 반복 실행 유스케이스가 순차/병렬 trial을 올바르게 처리하는지 검증한다.

설명:
- 실제 LLM 호출 없이 fake executor로 개별 trial 실행과 SQLite 경로 분리를 확인한다.

사용한 설계 패턴:
- command 단위 테스트 패턴

연관된 다른 모듈/구조:
- simula.application.commands.simulation_runs
"""

from __future__ import annotations

import textwrap
from pathlib import Path
from typing import Any

import simula.application.commands.simulation_runs as simulation_runs
from simula.application.services.executor import SimulationExecutionResult


class FakeExecutor:
    """반복 실행 테스트용 fake executor다."""

    def __init__(
        self,
        settings: object,
        *,
        scenario_controls: dict[str, object],
        env_file_hint: str | None = None,
        trial_index: int | None = None,
        total_trials: int | None = None,
        parallel: bool = False,
    ) -> None:
        self.settings = settings
        self.scenario_controls = scenario_controls
        self.env_file_hint = env_file_hint
        self.trial_index = trial_index
        self.total_trials = total_trials
        self.parallel = parallel

    def close(self) -> None:
        return None

    def run(self, scenario_text: str) -> SimulationExecutionResult:
        del scenario_text
        sqlite_name = Path(self.settings.storage.sqlite_path).name
        run_id = sqlite_name.removesuffix(".sqlite")
        return SimulationExecutionResult(
            run_id=run_id,
            success=True,
            final_state={
                "run_id": run_id,
                "scenario": "테스트 시나리오",
                "max_rounds": 1,
                "simulation_clock": {
                    "total_elapsed_minutes": 30,
                    "total_elapsed_label": "30분",
                    "last_elapsed_minutes": 30,
                    "last_elapsed_label": "30분",
                    "last_advanced_round_index": 1,
                },
                "round_time_history": [
                    {
                        "round_index": 1,
                        "elapsed_unit": "minute",
                        "elapsed_amount": 30,
                        "elapsed_minutes": 30,
                        "elapsed_label": "30분",
                        "total_elapsed_minutes": 30,
                        "total_elapsed_label": "30분",
                        "selection_reason": "테스트용 기본 경과다.",
                        "signals": [],
                    }
                ],
                "plan": {},
                "actors": [],
                "activities": [],
                "observer_reports": [],
                "final_report": {
                    "run_id": run_id,
                    "scenario": "테스트 시나리오",
                    "objective": "추적",
                    "world_summary": "요약",
                    "world_state_summary": "상태 요약",
                    "elapsed_simulation_minutes": 30,
                    "elapsed_simulation_label": "30분",
                    "rounds_completed": 1,
                    "actor_count": 2,
                    "total_activities": 0,
                    "visibility_activity_counts": {"public": 0},
                    "last_observer_summary": "요약",
                    "notable_events": [],
                    "errors": [],
                    "llm_usage_summary": {
                        "total_calls": 0,
                        "calls_by_role": {},
                        "structured_calls": 0,
                        "text_calls": 0,
                        "parse_failures": 0,
                        "forced_defaults": 0,
                        "input_tokens": None,
                        "output_tokens": None,
                        "total_tokens": None,
                    },
                },
                "final_report_markdown": "# 시뮬레이션 결과\n\n테스트 요약입니다.",
            },
            final_report={
                "run_id": run_id,
                "scenario": "테스트 시나리오",
                "objective": "추적",
                "world_summary": "요약",
                "world_state_summary": "상태 요약",
                "elapsed_simulation_minutes": 30,
                "elapsed_simulation_label": "30분",
                "rounds_completed": 1,
                "actor_count": 2,
                "total_activities": 0,
                "visibility_activity_counts": {"public": 0},
                "last_observer_summary": "요약",
                "notable_events": [],
                "errors": [],
                "llm_usage_summary": {
                    "total_calls": 0,
                    "calls_by_role": {},
                    "structured_calls": 0,
                    "text_calls": 0,
                    "parse_failures": 0,
                    "forced_defaults": 0,
                    "input_tokens": None,
                    "output_tokens": None,
                    "total_tokens": None,
                },
            },
            wall_clock_seconds=0.1,
            error=None,
        )


def _write_env_file(path: Path) -> None:
    path.write_text(
        textwrap.dedent(
            """
            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./data/db/runtime.sqlite"

            [llm.openai]
            API_KEY = "openai-key"

            [llm.ollama]
            base_url = "http://127.0.0.1:11434"

            [llm.planner]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.generator]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.coordinator]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.actor]
            provider = "ollama"
            model = "qwen3:8b"

            [llm.observer]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.fixer]
            provider = "openai"
            model = "gpt-5.4-mini"
            """
        ).strip(),
        encoding="utf-8",
    )


def test_execute_multi_run_runs_trials_sequentially(monkeypatch, tmp_path) -> None:
    env_file = tmp_path / "env.toml"
    _write_env_file(env_file)
    monkeypatch.setattr(simulation_runs, "SimulationExecutor", FakeExecutor)

    outcome = simulation_runs.execute_multi_run(
        env_file=str(env_file),
        scenario_text="테스트 시나리오",
        scenario_controls={"num_cast": 8, "allow_additional_cast": True},
        cli_overrides={},
        trials=3,
        parallel=False,
    )

    assert outcome.parallel is False
    assert [trial.trial_index for trial in outcome.trials] == [1, 2, 3]
    assert [trial.run_id for trial in outcome.trials] == [
        "runtime.trial-1",
        "runtime.trial-2",
        "runtime.trial-3",
    ]


def test_execute_multi_run_runs_trials_in_parallel(monkeypatch, tmp_path) -> None:
    env_file = tmp_path / "env.toml"
    _write_env_file(env_file)
    monkeypatch.setattr(simulation_runs, "SimulationExecutor", FakeExecutor)

    outcome = simulation_runs.execute_multi_run(
        env_file=str(env_file),
        scenario_text="테스트 시나리오",
        scenario_controls={"num_cast": 8, "allow_additional_cast": True},
        cli_overrides={},
        trials=3,
        parallel=True,
    )

    assert outcome.parallel is True
    assert len(outcome.trials) == 3
    assert all(trial.success for trial in outcome.trials)
    assert [trial.run_id for trial in outcome.trials] == [
        "runtime.trial-1",
        "runtime.trial-2",
        "runtime.trial-3",
    ]


def test_parallel_worker_count_keeps_one_cpu_in_reserve(monkeypatch) -> None:
    monkeypatch.setattr(simulation_runs.os, "cpu_count", lambda: 8)

    assert simulation_runs._parallel_worker_count(10) == 7
    assert simulation_runs._parallel_worker_count(3) == 3


def test_execute_multi_run_parallel_uses_cpu_capped_workers(
    monkeypatch, tmp_path
) -> None:
    env_file = tmp_path / "env.toml"
    _write_env_file(env_file)
    monkeypatch.setattr(simulation_runs, "SimulationExecutor", FakeExecutor)
    monkeypatch.setattr(simulation_runs.os, "cpu_count", lambda: 4)

    captured: dict[str, Any] = {}

    class FakeFuture:
        def __init__(self, value: simulation_runs.TrialRunOutcome) -> None:
            self._value = value

        def result(self) -> simulation_runs.TrialRunOutcome:
            return self._value

    class FakePool:
        def __init__(self, *, max_workers: int) -> None:
            captured["max_workers"] = max_workers

        def __enter__(self) -> "FakePool":
            return self

        def __exit__(self, exc_type, exc, tb) -> None:  # noqa: ANN001
            return None

        def submit(self, fn, **kwargs):  # noqa: ANN001
            return FakeFuture(fn(**kwargs))

    monkeypatch.setattr(
        simulation_runs.concurrent.futures,
        "ThreadPoolExecutor",
        FakePool,
    )

    outcome = simulation_runs.execute_multi_run(
        env_file=str(env_file),
        scenario_text="테스트 시나리오",
        scenario_controls={"num_cast": 8, "allow_additional_cast": True},
        cli_overrides={},
        trials=5,
        parallel=True,
    )

    assert captured["max_workers"] == 3
    assert len(outcome.trials) == 5
