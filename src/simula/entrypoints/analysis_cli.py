"""Purpose:
- Provide the packaged CLI entrypoint for the JSONL run analyzer.
"""

from __future__ import annotations

import argparse
from collections.abc import Sequence

from simula.application.services.analysis_runner import run_analysis


def build_parser() -> argparse.ArgumentParser:
    """Build the analyzer CLI parser."""

    parser = argparse.ArgumentParser(
        prog="analysis",
        description="하나의 저장된 simulation run 디렉터리를 분석합니다.",
    )
    selector_group = parser.add_mutually_exclusive_group(required=True)
    selector_group.add_argument(
        "--run-dir",
        help="분석할 run 디렉터리 경로입니다. 예: ./output/2026-04-14.10",
    )
    selector_group.add_argument(
        "--run-id",
        help="기존 호환용 별칭입니다. storage.output_dir 아래의 run_id를 받습니다.",
    )
    parser.add_argument(
        "--env",
        help="`--run-id` 해석에만 사용할 선택적 env.toml 경로입니다.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Run the analyzer CLI."""

    args = build_parser().parse_args(argv)
    outcome = run_analysis(
        run_dir=args.run_dir,
        run_id=args.run_id,
        env_file=args.env,
    )
    print(f"분석 완료 run_id: {outcome.run_id}")
    print(f"입력 로그: {outcome.input_path}")
    print(f"생성 아티팩트 수: {outcome.artifact_count}")
    print(f"역할 목록: {', '.join(outcome.roles) if outcome.roles else '-'}")
    print(f"출력 디렉터리: {outcome.output_dir}")
    return 0
