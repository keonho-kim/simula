"""목적:
- 명령행 인자를 파싱하고 bootstrap 실행으로 연결한다.

설명:
- 시나리오 입력과 핵심 runtime override 인자를 수집한다.

사용한 설계 패턴:
- CLI 파서 + bootstrap 위임 패턴

연관된 다른 모듈/구조:
- simula.entrypoints.bootstrap
"""

from __future__ import annotations

import argparse
from collections.abc import Sequence


def build_parser() -> argparse.ArgumentParser:
    """프로토타입 CLI 파서를 구성한다."""

    parser = argparse.ArgumentParser(
        prog="simula",
        description="LangGraph 기반 mailbox-first 시뮬레이션 프로토타입",
    )
    parser.add_argument(
        "--scenario-file",
        required=True,
        help="시나리오 Markdown 또는 텍스트 파일 경로",
    )

    parser.add_argument(
        "--env",
        help="설정 파일 경로. 생략하면 env.toml 을 자동 사용한다.",
    )

    parser.add_argument(
        "--max-rounds",
        type=int,
        help="planner가 추천할 round 수의 상한 override",
    )

    parser.add_argument(
        "--log-level",
        choices=("DEBUG", "INFO", "WARNING", "ERROR"),
        help="CLI와 workflow 로그 레벨 override",
    )

    parser.add_argument(
        "--trials",
        type=int,
        default=1,
        help="동일 설정으로 시뮬레이션을 반복 실행할 횟수",
    )

    parser.add_argument(
        "--parallel",
        action="store_true",
        help="하나의 run 내부 graph fan-out과 분기 호출을 병렬 허용한다.",
    )

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """CLI 인자를 파싱하고 실행한다."""

    parser = build_parser()
    args = parser.parse_args(argv)

    from simula.entrypoints.bootstrap import run_from_cli

    return run_from_cli(args)
