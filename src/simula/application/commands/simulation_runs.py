"""목적:
- 단일 실행과 반복 실행용 시뮬레이션 명령을 제공한다.

설명:
- 설정 로드, 실행기 생성, trial 반복 실행, 최종 결과 검증을 한 모듈에 모은다.

사용한 설계 패턴:
- command handler 패턴

연관된 다른 모듈/구조:
- simula.entrypoints.bootstrap
- simula.application.services.executor
"""

from __future__ import annotations

import concurrent.futures
import os
from dataclasses import dataclass
from pathlib import Path

from simula.application.services.executor import SimulationExecutor
from simula.domain.scenario_controls import ScenarioControls
from simula.infrastructure.config.loader import load_settings_bundle
from simula.infrastructure.config.models import AppSettings


class SimulationRunFailedError(RuntimeError):
    """Raised when one workflow run fails after the executor boundary."""


@dataclass(slots=True)
class SingleRunOutcome:
    """단일 실행 결과 묶음이다."""

    run_id: str
    final_state: dict[str, object]
    final_report: dict[str, object]
    output_dir: str
    log_level: str


@dataclass(slots=True)
class TrialRunOutcome:
    """반복 실행의 개별 trial 결과다."""

    trial_index: int
    run_id: str
    success: bool
    output_dir: str
    final_state: dict[str, object] | None
    final_report: dict[str, object] | None
    error: str | None


@dataclass(slots=True)
class MultiRunOutcome:
    """반복 실행 전체 결과다."""

    trials: list[TrialRunOutcome]
    output_dir: str
    log_level: str
    parallel: bool


def resolve_single_run_log_level(
    *,
    env_file: str | None,
    cli_overrides: dict[str, str],
) -> str:
    """단일 실행 설정의 로그 레벨을 반환한다."""

    settings_bundle = load_settings_bundle(
        env_file,
        cli_overrides=cli_overrides,
    )
    return settings_bundle.settings.log_level


def execute_single_run(
    *,
    env_file: str | None,
    scenario_text: str,
    scenario_controls: ScenarioControls,
    cli_overrides: dict[str, str],
) -> SingleRunOutcome:
    """단일 실행 유스케이스를 수행한다."""

    settings_bundle = load_settings_bundle(
        env_file,
        cli_overrides=cli_overrides,
    )
    settings = settings_bundle.settings
    executor = SimulationExecutor(
        settings,
        scenario_controls=scenario_controls,
        env_file_hint=env_file,
        trial_index=None,
        total_trials=None,
        parallel=False,
    )
    try:
        result = executor.run(scenario_text)
        if (
            not result.success
            or result.final_report is None
            or result.final_state is None
        ):
            raise SimulationRunFailedError(
                f"run_id={result.run_id} failed: "
                f"{result.error or '최종 리포트를 생성하지 못했습니다.'}"
            )
        return SingleRunOutcome(
            run_id=result.run_id,
            final_state=result.final_state,
            final_report=result.final_report,
            output_dir=settings.storage.output_dir,
            log_level=settings.log_level,
        )
    finally:
        executor.close()


def execute_multi_run(
    *,
    env_file: str | None,
    scenario_text: str,
    scenario_controls: ScenarioControls,
    cli_overrides: dict[str, str],
    trials: int,
    parallel: bool,
) -> MultiRunOutcome:
    """동일 설정으로 시뮬레이션을 여러 번 반복 실행한다."""

    if trials < 1:
        raise ValueError("--trials 는 1 이상의 정수여야 합니다.")

    settings_bundle = load_settings_bundle(
        env_file,
        cli_overrides=cli_overrides,
    )
    settings = settings_bundle.settings
    if trials == 1:
        outcome = execute_single_run(
            env_file=env_file,
            scenario_text=scenario_text,
            scenario_controls=scenario_controls,
            cli_overrides=cli_overrides,
        )
        return MultiRunOutcome(
            trials=[
                TrialRunOutcome(
                    trial_index=1,
                    run_id=outcome.run_id,
                    success=True,
                    output_dir=outcome.output_dir,
                    final_state=outcome.final_state,
                    final_report=outcome.final_report,
                    error=None,
                )
            ],
            output_dir=outcome.output_dir,
            log_level=outcome.log_level,
            parallel=False,
        )

    if parallel:
        trial_outcomes = _run_trials_parallel(
            settings=settings,
            env_file=env_file,
            scenario_text=scenario_text,
            scenario_controls=scenario_controls,
            trials=trials,
        )
    else:
        trial_outcomes = [
            _execute_trial(
                base_settings=settings,
                env_file=env_file,
                scenario_text=scenario_text,
                scenario_controls=scenario_controls,
                trial_index=trial_index,
                total_trials=trials,
            )
            for trial_index in range(1, trials + 1)
        ]

    return MultiRunOutcome(
        trials=trial_outcomes,
        output_dir=settings.storage.output_dir,
        log_level=settings.log_level,
        parallel=parallel,
    )


def _run_trials_parallel(
    *,
    settings: AppSettings,
    env_file: str | None,
    scenario_text: str,
    scenario_controls: ScenarioControls,
    trials: int,
) -> list[TrialRunOutcome]:
    futures: list[concurrent.futures.Future[TrialRunOutcome]] = []
    with concurrent.futures.ThreadPoolExecutor(
        max_workers=_parallel_worker_count(trials)
    ) as executor:
        for trial_index in range(1, trials + 1):
            futures.append(
                executor.submit(
                    _execute_trial,
                    base_settings=settings,
                    env_file=env_file,
                    scenario_text=scenario_text,
                    scenario_controls=scenario_controls,
                    trial_index=trial_index,
                    total_trials=trials,
                )
            )
    return sorted(
        (future.result() for future in futures), key=lambda item: item.trial_index
    )


def _parallel_worker_count(trials: int) -> int:
    """병렬 trial 실행에 사용할 worker 수를 계산한다."""

    return min(trials, max(1, (os.cpu_count() or 4) - 1))


def _execute_trial(
    *,
    base_settings: AppSettings,
    env_file: str | None,
    scenario_text: str,
    scenario_controls: ScenarioControls,
    trial_index: int,
    total_trials: int,
) -> TrialRunOutcome:
    """개별 trial 하나를 실행한다."""

    trial_settings = base_settings.model_copy(deep=True)
    _apply_trial_storage_overrides(
        trial_settings,
        trial_index=trial_index,
        total_trials=total_trials,
    )
    executor = SimulationExecutor(
        trial_settings,
        scenario_controls=scenario_controls,
        env_file_hint=env_file,
        trial_index=trial_index,
        total_trials=total_trials,
        parallel=total_trials > 1,
    )
    try:
        result = executor.run(scenario_text)
        return TrialRunOutcome(
            trial_index=trial_index,
            run_id=result.run_id,
            success=result.success,
            output_dir=trial_settings.storage.output_dir,
            final_state=result.final_state,
            final_report=result.final_report,
            error=result.error,
        )
    finally:
        executor.close()


def _apply_trial_storage_overrides(
    settings: AppSettings,
    *,
    trial_index: int,
    total_trials: int,
) -> None:
    """trial별 저장 경로를 조정한다."""

    if total_trials == 1 or settings.storage.provider != "sqlite":
        return

    base_sqlite_path = Path(settings.storage.sqlite_path)
    trial_dir = base_sqlite_path.parent / "trial-runs"
    trial_path = (
        trial_dir
        / f"{base_sqlite_path.stem}.trial-{trial_index}{base_sqlite_path.suffix or '.sqlite'}"
    )
    settings.storage.sqlite_dir = str(trial_dir)
    settings.storage.sqlite_path = str(trial_path)
