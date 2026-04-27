"""Persist integrated run outputs under one run directory."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from simula.application.analysis import ArtifactWriter, load_run_analysis
from simula.application.analysis.runner.bundle import build_analysis_report_bundle
from simula.application.analysis.runner.writing import write_analysis_artifacts
from simula.infrastructure.config.models import AppSettings


@dataclass(slots=True)
class RunOutputPaths:
    """Stable top-level output paths for one run."""

    run_dir: Path
    simulation_log_path: Path
    manifest_path: Path
    report_path: Path | None


def write_run_outputs(
    *,
    settings: AppSettings,
    run_id: str,
    scenario_file_path: str,
    scenario_file_stem: str,
    run_model_id: str,
    started_at: datetime,
    ended_at: datetime,
    wall_clock_seconds: float,
    status: str,
    error: str | None,
    final_state: dict[str, Any] | None,
) -> RunOutputPaths:
    """Write integrated output artifacts and the unified manifest."""

    run_dir = Path(settings.storage.output_dir) / run_id
    writer = ArtifactWriter(run_dir)
    simulation_log_path = run_dir / "simulation.log.jsonl"
    manifest_path = run_dir / "manifest.json"
    report_path: Path | None = None
    artifact_paths: list[str] = []

    if simulation_log_path.exists():
        artifact_paths.append("simulation.log.jsonl")

    analysis_summary: dict[str, object] | None = None
    if status == "completed":
        report_path = _write_final_report(final_state=final_state, writer=writer)
        artifact_paths.append("report.final.md")
        if simulation_log_path.exists():
            loaded = load_run_analysis(simulation_log_path, expected_run_id=run_id)
            bundle = build_analysis_report_bundle(loaded)
            analysis_summary = write_analysis_artifacts(
                run_id=run_id,
                writer=writer,
                bundle=bundle,
            )
            artifact_paths.extend(writer.created_files)

    manifest = {
        "run_id": run_id,
        "status": status,
        "started_at": started_at.astimezone(timezone.utc).isoformat(timespec="seconds"),
        "ended_at": ended_at.astimezone(timezone.utc).isoformat(timespec="seconds"),
        "wall_clock_seconds": round(wall_clock_seconds, 6),
        "scenario_file": scenario_file_path,
        "scenario_file_stem": scenario_file_stem,
        "run_model_id": run_model_id,
        "settings": settings.redacted_dump(),
        "artifact_paths": sorted({*artifact_paths, "manifest.json"}),
        "error": error,
    }
    if analysis_summary is not None:
        manifest["analysis"] = analysis_summary

    writer.write_json("manifest.json", manifest)
    return RunOutputPaths(
        run_dir=run_dir,
        simulation_log_path=simulation_log_path,
        manifest_path=manifest_path,
        report_path=report_path,
    )


def _write_final_report(
    *,
    final_state: dict[str, Any] | None,
    writer: ArtifactWriter,
) -> Path:
    if final_state is None:
        raise ValueError("final_state is required for completed runs.")
    final_report_markdown = final_state.get("final_report_markdown")
    if not isinstance(final_report_markdown, str) or not final_report_markdown.strip():
        raise ValueError("최종 보고서 markdown이 비어 있습니다.")
    return writer.write_text("report.final.md", final_report_markdown.strip() + "\n")
