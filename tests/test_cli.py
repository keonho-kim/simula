"""목적:
- CLI가 현재 지원되는 인자만 안정적으로 해석하는지 검증한다.
"""

from __future__ import annotations

from simula.entrypoints.cli import build_parser


def test_cli_parses_defaults() -> None:
    parser = build_parser()

    args = parser.parse_args(["--scenario-text", "테스트"])

    assert args.env is None
    assert args.max_rounds is None
    assert args.log_level is None
    assert args.trials == 1
    assert args.parallel is False


def test_cli_parses_max_rounds_override() -> None:
    parser = build_parser()

    args = parser.parse_args(
        [
            "--scenario-text",
            "테스트",
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
            "--scenario-text",
            "테스트",
            "--log-level",
            "DEBUG",
        ]
    )

    assert args.log_level == "DEBUG"
