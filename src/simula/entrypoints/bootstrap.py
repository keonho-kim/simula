"""목적:
- CLI 입력을 애플리케이션 명령으로 연결한다.

설명:
- 엔트리포인트 계층은 인자 해석, 로깅 초기화, 결과 출력만 담당한다.

사용한 설계 패턴:
- entrypoint orchestration 패턴

연관된 다른 모듈/구조:
- simula.application.commands.simulation_runs
- simula.application.services.presentation
"""

from __future__ import annotations

import argparse
import logging
import sys

from simula.application.commands.simulation_runs import (
    SimulationRunFailedError,
    execute_multi_run,
    execute_single_run,
    resolve_single_run_log_level,
)
from simula.application.services.logging_setup import configure_logging
from simula.application.services.presentation import (
    print_final_report,
    print_trial_run_summary,
    write_single_run_outputs,
)
from simula.application.services.scenario_inputs import read_scenario_input


def _build_cli_overrides(args: argparse.Namespace) -> dict[str, str]:
    """CLI runtime override를 설정 로더 형식으로 변환한다."""

    cli_overrides: dict[str, str] = {}

    max_steps = getattr(args, "max_steps", None)
    if max_steps is not None:
        cli_overrides["SIM_MAX_STEPS"] = str(max_steps)

    log_level = getattr(args, "log_level", None)
    if log_level is not None:
        cli_overrides["SIM_LOG_LEVEL"] = str(log_level)

    return cli_overrides


def run_from_cli(args: argparse.Namespace) -> int:
    """CLI에서 들어온 요청을 실행하고 종료 코드를 반환한다."""

    cli_overrides = _build_cli_overrides(args)
    logger = logging.getLogger("simula.bootstrap")

    try:
        configure_logging(
            resolve_single_run_log_level(
                env_file=args.env,
                cli_overrides=cli_overrides,
            )
        )
        scenario_input = read_scenario_input(args)
        if args.trials == 1:
            logger.info("시뮬레이션 실행 시작 | trials=1 parallel=False")
            outcome = execute_single_run(
                env_file=args.env,
                scenario_text=scenario_input.scenario_text,
                scenario_controls=scenario_input.scenario_controls,
                cli_overrides=cli_overrides,
            )
            saved_outputs = write_single_run_outputs(
                output_dir=outcome.output_dir,
                run_id=outcome.run_id,
                final_state=outcome.final_state,
            )
            final_report_markdown = outcome.final_state.get("final_report_markdown")
            print_final_report(
                outcome.final_report,
                final_report_markdown
                if isinstance(final_report_markdown, str)
                else None,
            )
            print(f"시뮬레이션 로그: {saved_outputs.simulation_log_path}")
            print(f"최종 보고서: {saved_outputs.final_report_path}")
            logger.info("시뮬레이션 실행 완료 | run_id=%s", outcome.run_id)
            return 0

        logger.info(
            "반복 시뮬레이션 실행 시작 | trials=%s parallel=%s",
            args.trials,
            args.parallel,
        )
        summary = execute_multi_run(
            env_file=args.env,
            scenario_text=scenario_input.scenario_text,
            scenario_controls=scenario_input.scenario_controls,
            cli_overrides=cli_overrides,
            trials=args.trials,
            parallel=args.parallel,
        )
        for trial in summary.trials:
            if (
                trial.success
                and trial.final_state is not None
                and trial.final_report is not None
            ):
                saved_outputs = write_single_run_outputs(
                    output_dir=trial.output_dir,
                    run_id=trial.run_id,
                    final_state=trial.final_state,
                )
                print(
                    f"trial {trial.trial_index} 로그: {saved_outputs.simulation_log_path}"
                )
                print(
                    f"trial {trial.trial_index} 보고서: {saved_outputs.final_report_path}"
                )
        print_trial_run_summary(summary.trials, parallel=summary.parallel)
        logger.info("반복 시뮬레이션 실행 완료 | trials=%s", len(summary.trials))
        return 0 if all(trial.success for trial in summary.trials) else 1
    except Exception as exc:  # noqa: BLE001
        if isinstance(exc, SimulationRunFailedError):
            logger.error("실행 실패: %s", exc)
        else:
            logger.exception("실행 실패")
        print(f"실행 실패: {exc}", file=sys.stderr)
        return 1
