"""목적:
- CLI 파서가 반복 실행 옵션을 올바르게 해석하는지 검증한다.

설명:
- 단일 실행 기본값과 핵심 runtime override, 반복 실행 플래그를 실제 argparse 경로로 확인한다.

사용한 설계 패턴:
- CLI 단위 테스트 패턴

연관된 다른 모듈/구조:
- simula.entrypoints.cli
"""

from __future__ import annotations

import pytest

from simula.entrypoints.cli import build_parser


def test_cli_parses_defaults() -> None:
    parser = build_parser()

    args = parser.parse_args(["--scenario-text", "테스트"])

    assert args.env is None
    assert args.max_steps is None
    assert args.log_level is None
    assert args.trials == 1
    assert args.parallel is False


def test_cli_parses_max_steps_override() -> None:
    parser = build_parser()

    args = parser.parse_args(
        [
            "--scenario-text",
            "테스트",
            "--max-steps",
            "7",
        ]
    )

    assert args.max_steps == 7


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


@pytest.mark.parametrize(
    "removed_flag",
    [
        "--mode",
        "--max-round",
        "--output-dir",
        "--sqlite-dir",
        "--time-unit",
        "--time-step-size",
    ],
)
def test_cli_rejects_removed_override_flags(removed_flag: str) -> None:
    parser = build_parser()

    with pytest.raises(SystemExit):
        parser.parse_args(
            [
                "--scenario-text",
                "테스트",
                removed_flag,
                "x",
            ]
        )
