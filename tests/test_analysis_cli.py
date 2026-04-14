"""Purpose:
- Verify the packaged analysis CLI parser and handoff behavior.
"""

from __future__ import annotations

from pathlib import Path

from simula.entrypoints import analysis_cli
from simula.application.services.analysis_runner import AnalysisRunOutcome


def test_analysis_cli_parses_run_dir() -> None:
    parser = analysis_cli.build_parser()

    args = parser.parse_args(["--run-dir", "20260413.1"])

    assert args.run_dir == "20260413.1"
    assert args.run_id is None
    assert args.env is None


def test_analysis_cli_parses_legacy_run_id() -> None:
    parser = analysis_cli.build_parser()

    args = parser.parse_args(["--run-id", "20260413.1", "--env", "./env.toml"])

    assert args.run_dir is None
    assert args.run_id == "20260413.1"
    assert args.env == "./env.toml"


def test_analysis_cli_main_passes_run_dir_to_runner(monkeypatch, capsys) -> None:
    captured: dict[str, object] = {}

    def _fake_run_analysis(*, run_dir=None, run_id=None, env_file=None):  # noqa: ANN001
        captured["run_dir"] = run_dir
        captured["run_id"] = run_id
        captured["env_file"] = env_file

        return AnalysisRunOutcome(
            run_id="run-1",
            input_path=Path("output/run-1/simulation.log.jsonl"),
            output_dir=Path("analysis/run-1"),
            artifact_count=12,
            llm_call_count=3,
            roles=["actor", "planner"],
        )

    monkeypatch.setattr(analysis_cli, "run_analysis", _fake_run_analysis)

    exit_code = analysis_cli.main(["--run-dir", "run-1", "--env", "./env.toml"])

    assert exit_code == 0
    assert captured == {
        "run_dir": "run-1",
        "run_id": None,
        "env_file": "./env.toml",
    }
    printed = capsys.readouterr().out
    assert "분석 완료 run_id:" in printed
