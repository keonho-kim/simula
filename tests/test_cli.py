"""목적:
- CLI가 현재 지원되는 인자만 안정적으로 해석하는지 검증한다.
"""

from __future__ import annotations

import logging
from argparse import Namespace
from pathlib import Path
from types import SimpleNamespace

from simula.entrypoints.cli import build_parser
from simula.entrypoints.bootstrap import _build_cli_overrides, run_from_cli


def test_cli_parses_defaults() -> None:
    parser = build_parser()

    args = parser.parse_args(["--scenario-file", "./scenario.md"])

    assert args.scenario_file == "./scenario.md"
    assert args.env is None
    assert args.max_rounds is None
    assert args.log_level is None
    assert args.debug is False
    assert args.trials == 1
    assert args.parallel is False


def test_cli_parses_max_rounds_override() -> None:
    parser = build_parser()

    args = parser.parse_args(
        [
            "--scenario-file",
            "./scenario.md",
            "--max-rounds",
            "7",
        ]
    )

    assert args.max_rounds == 7


def test_cli_parses_repeat_options() -> None:
    parser = build_parser()

    args = parser.parse_args(
        [
            "--env",
            "./env.toml",
            "--scenario-file",
            "./scenario.md",
            "--trials",
            "5",
            "--parallel",
        ]
    )

    assert args.env == "./env.toml"
    assert args.trials == 5
    assert args.parallel is True


def test_cli_parses_log_level_override() -> None:
    parser = build_parser()

    args = parser.parse_args(
        [
            "--scenario-file",
            "./scenario.md",
            "--log-level",
            "DEBUG",
        ]
    )

    assert args.log_level == "DEBUG"


def test_cli_parses_debug() -> None:
    parser = build_parser()

    args = parser.parse_args(
        [
            "--scenario-file",
            "./scenario.md",
            "--DEBUG",
        ]
    )

    assert args.debug is True


def test_cli_rejects_runtime_mode() -> None:
    parser = build_parser()

    try:
        parser.parse_args(
            [
                "--scenario-file",
                "./scenario.md",
                "--runtime-mode",
                "local-quality",
            ]
        )
    except SystemExit as exc:
        assert exc.code == 2
    else:
        raise AssertionError("--runtime-mode must not be accepted")


def test_cli_overrides_debug() -> None:
    overrides = _build_cli_overrides(
        Namespace(
            max_rounds=5,
            log_level="INFO",
            debug=True,
        )
    )

    assert overrides["SIM_MAX_ROUNDS"] == "5"
    assert overrides["SIM_LOG_LEVEL"] == "DEBUG"


def test_run_from_cli_renders_round_feed(monkeypatch, capsys, tmp_path: Path) -> None:
    monkeypatch.setenv("NO_COLOR", "1")
    root_logger = logging.getLogger()
    simula_logger = logging.getLogger("simula")
    original_root_handlers = list(root_logger.handlers)
    original_root_level = root_logger.level
    original_simula_handlers = list(simula_logger.handlers)
    original_simula_level = simula_logger.level
    original_simula_propagate = simula_logger.propagate

    def fake_read_scenario_input(args):  # noqa: ANN001
        del args
        return SimpleNamespace(
            scenario_file_path="/tmp/scenario.md",
            scenario_file_stem="scenario",
            scenario_text="scenario",
            scenario_controls={"num_cast": 2, "allow_additional_cast": True},
        )

    def fake_execute_single_run(**kwargs):  # noqa: ANN003
        del kwargs
        logger = logging.getLogger("simula.workflow.run.demo")
        logger.info("SCENE 1 시작 | event=evt-1 | actors=ceo,cfo,investor | candidates=3")
        logger.info(
            "SCENE 1 요청\n이벤트: Emergency Board Session\n배우: CEO, CFO, Lead Investor\n후보:\n- C1 | CEO | speech -> CFO, Lead Investor\n입력: actors=3 actions=5 recent_effects=0 event_symbol=E1"
        )
        logger.info(
            "SCENE 1 결과\nbeats:\n- B1/C1 | CEO -> CFO, Lead Investor | speech\n  의도: 경영권을 지키며 협상 주도권을 확보한다.\n  행동: CEO가 투자 조건과 생존 전략을 제시한다.\n  발화: 우리는 지분만이 아니라 방향성도 지켜야 합니다.\n  반응: 투자자는 조건을 더 압박한다.\n  효과: 이사회 긴장이 상승했다.\n사건 변화: 1건\n시간: +15분"
        )
        logger.info(
            "SCENE 1 적용 | beats=1 | actors=ceo,cfo,investor | events=1 | time +15분 | stop continue"
        )
        return SimpleNamespace(
            run_id="run-1",
            output_dir=str(tmp_path),
            final_state={"final_report_markdown": "# report"},
            final_report={"run_id": "run-1"},
        )

    monkeypatch.setattr(
        "simula.entrypoints.bootstrap.resolve_single_run_log_level",
        lambda **kwargs: "INFO",
    )
    monkeypatch.setattr(
        "simula.entrypoints.bootstrap.read_scenario_input",
        fake_read_scenario_input,
    )
    monkeypatch.setattr(
        "simula.entrypoints.bootstrap.execute_single_run",
        fake_execute_single_run,
    )
    monkeypatch.setattr(
        "simula.entrypoints.bootstrap.print_final_report",
        lambda *args, **kwargs: None,
    )

    try:
        exit_code = run_from_cli(
            Namespace(
                scenario_file="./scenario.md",
                env=None,
                max_rounds=None,
                log_level=None,
                debug=False,
                trials=1,
                parallel=False,
            )
        )
        captured = capsys.readouterr()
    finally:
        root_logger.handlers.clear()
        for handler in original_root_handlers:
            root_logger.addHandler(handler)
        root_logger.setLevel(original_root_level)
        simula_logger.handlers.clear()
        for handler in original_simula_handlers:
            simula_logger.addHandler(handler)
        simula_logger.setLevel(original_simula_level)
        simula_logger.propagate = original_simula_propagate

    assert exit_code == 0
    assert "[RUN] 시뮬레이션 시작 | trials=1 | graph_parallel=False" in captured.err
    assert "[SCENE] SCENE 1 시작" in captured.err
    assert "이벤트: Emergency Board Session" in captured.err
    assert "C1 | CEO | speech -> CFO, Lead Investor" in captured.err
    assert "B1/C1 | CEO -> CFO, Lead Investor | speech" in captured.err
    assert "의도: 경영권을 지키며 협상 주도권을 확보한다." in captured.err
    assert "발화: 우리는 지분만이 아니라 방향성도 지켜야 합니다." in captured.err
    assert "[SCENE] SCENE 1 적용" in captured.err
    assert f"{tmp_path / 'run-1' / 'report.final.md'}" in captured.out
