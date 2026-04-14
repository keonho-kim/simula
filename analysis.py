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
        description="Analyze one simulation.log.jsonl run artifact.",
    )
    parser.add_argument(
        "--run-id",
        required=True,
        help="Explicit run identifier to analyze.",
    )
    parser.add_argument(
        "--env",
        help="Optional env.toml path used only to resolve storage.output_dir.",
    )
    return parser


def main() -> int:
    """Run the analyzer CLI."""

    args = build_parser().parse_args()
    outcome = run_analysis(run_id=args.run_id, env_file=args.env)
    print(f"Analyzed run_id: {outcome.run_id}")
    print(f"Input log: {outcome.input_path}")
    print(f"Artifacts: {outcome.artifact_count}")
    print(f"Roles: {', '.join(outcome.roles) if outcome.roles else '-'}")
    print(f"Output dir: {outcome.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
