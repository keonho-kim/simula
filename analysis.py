"""Compatibility wrapper for the packaged analysis CLI."""

from __future__ import annotations

from simula.entrypoints.analysis_cli import main


if __name__ == "__main__":
    raise SystemExit(main())
