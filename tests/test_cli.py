"""목적:
- CLI가 현재 지원되는 인자만 안정적으로 해석하는지 검증한다.
"""

from __future__ import annotations

import logging
from argparse import Namespace
from pathlib import Path
from types import SimpleNamespace

from simula.entrypoints.cli import build_parser
from simula.entrypoints.bootstrap import run_from_cli


def test_cli_parses_defaults() -> None:
    parser = build_parser()

    args = parser.parse_args(["--scenario-file", "./scenario.md"])

    assert args.scenario_file == "./scenario.md"
    assert args.env is None
    assert args.max_rounds is None
    assert args.log_level is None
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
        logger.info("ROUND 1 시작\n후보 actor: 4명 / 전체 8명")
        logger.info(
            "ROUND 1 지시 확정\n초점: 긴급 이사회와 경영권 대립\n참여: ceo-founder, investor-partner, outside-director\n행동 제안 대기: 4명 | background 4명"
        )
        logger.info(
            "창업자 CEO | investor_negotiation | 비공개 | 대상 investor-partner\n의도: 경영권을 지키며 협상 주도권을 확보한다.\n연관: investor-partner\n행동: 리드 투자사와 비공개 협상을 시도한다.\n세부: 브리지 투자 조건과 경영권 방어선을 함께 제시한다.\n발언: 우리는 지분만이 아니라 방향성도 지켜야 합니다.\n소요: 12.34s | round 1"
        )
        logger.info(
            "ROUND 1 해소\n채택: 4명 | 사건 2건 | 시간 +1일 | stop continue\n사건: 긴급 이사회 개최\n압력: 내부 구조조정 요구"
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
    assert "[ROUND] ROUND 1 시작" in captured.err
    assert "초점: 긴급 이사회와 경영권 대립" in captured.err
    assert "행동 제안 대기: 4명 | background 4명" in captured.err
    assert "[CAST] 창업자 CEO | investor_negotiation | 비공개 | 대상 investor-partner" in captured.err
    assert "의도: 경영권을 지키며 협상 주도권을 확보한다." in captured.err
    assert "발언: 우리는 지분만이 아니라 방향성도 지켜야 합니다." in captured.err
    assert "[ROUND] ROUND 1 해소" in captured.err
    assert f"{tmp_path / 'run-1' / 'report.final.md'}" in captured.out
