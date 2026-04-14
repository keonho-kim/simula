"""Purpose:
- Provide a thin CLI entrypoint for the JSONL run analyzer.
"""

from __future__ import annotations

import argparse

from simula.application.services.analysis_runner import run_analysis


def build_parser() -> argparse.ArgumentParser:
    """Build the analyzer CLI parser."""

    parser = argparse.ArgumentParser(
        prog="analysis.py",
        description="하나의 simulation.log.jsonl 실행 결과를 분석합니다.",
    )
    parser.add_argument(
        "--run-id",
        required=True,
        help="분석할 run-id를 명시합니다.",
    )
    parser.add_argument(
        "--env",
        help="storage.output_dir 해석에만 사용할 선택적 env.toml 경로입니다.",
    )
    return parser


def main() -> int:
    """Run the analyzer CLI."""

    args = build_parser().parse_args()
    outcome = run_analysis(run_id=args.run_id, env_file=args.env)
    print(f"분석 완료 run_id: {outcome.run_id}")
    print(f"입력 로그: {outcome.input_path}")
    print(f"생성 아티팩트 수: {outcome.artifact_count}")
    print(f"역할 목록: {', '.join(outcome.roles) if outcome.roles else '-'}")
    print(f"출력 디렉터리: {outcome.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
