"""Purpose:
- Orchestrate one JSONL run analysis without embedding analysis logic in services.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from simula.application.analysis import (
    ArtifactWriter,
    METRIC_NAMES,
    build_distribution_report,
    build_fixer_report,
    build_network_report,
    load_run_analysis,
    render_network_summary_markdown,
    render_distribution_plot,
    render_network_plot,
)
from simula.application.analysis.localization import (
    FIXER_SUMMARY_COLUMN_LABELS,
    LLM_CALL_COLUMN_LABELS,
    NETWORK_EDGE_COLUMN_LABELS,
    NETWORK_NODE_COLUMN_LABELS,
    overall_distribution_title,
    role_distribution_title,
    translate_row,
    network_title,
)
from simula.application.analysis.models import ArtifactManifest
from simula.infrastructure.config.loader import load_settings_bundle
from simula.infrastructure.config.models import StorageConfig


@dataclass(slots=True)
class AnalysisRunOutcome:
    """Minimal result summary returned to the CLI."""

    run_id: str
    input_path: Path
    output_dir: Path
    artifact_count: int
    llm_call_count: int
    roles: list[str]


def run_analysis(
    *,
    run_id: str,
    env_file: str | None = None,
) -> AnalysisRunOutcome:
    """Analyze one explicit run_id and write artifacts under `analysis/<run-id>`."""

    normalized_run_id = run_id.strip()
    if not normalized_run_id:
        raise ValueError("`--run-id`는 비어 있으면 안 됩니다.")

    input_path = (
        _resolve_output_dir(env_file=env_file)
        / normalized_run_id
        / "simulation.log.jsonl"
    )
    output_dir = Path("analysis") / normalized_run_id
    loaded = load_run_analysis(input_path, expected_run_id=normalized_run_id)
    writer = ArtifactWriter(output_dir)

    writer.write_csv(
        "llm_calls.csv",
        rows=[
            translate_row(
                record.to_row(),
                column_labels=LLM_CALL_COLUMN_LABELS,
            )
            for record in loaded.llm_calls
        ],
        fieldnames=list(LLM_CALL_COLUMN_LABELS.values()),
    )

    distribution_report = build_distribution_report(loaded.llm_calls)
    for metric in METRIC_NAMES:
        overall_distribution = distribution_report.overall[metric]
        writer.write_json(
            f"distributions/overall/{metric}.json",
            overall_distribution.to_dict(),
        )
        render_distribution_plot(
            overall_distribution,
            title=overall_distribution_title(
                run_id=normalized_run_id,
                metric=metric,
            ),
            output_path=writer.path_for(f"distributions/overall/{metric}.png"),
        )
        writer.record_output(f"distributions/overall/{metric}.png")

    for role, metrics in sorted(distribution_report.by_role.items()):
        for metric in METRIC_NAMES:
            distribution = metrics[metric]
            writer.write_json(
                f"distributions/roles/{role}/{metric}.json",
                distribution.to_dict(),
            )
            render_distribution_plot(
                distribution,
                title=role_distribution_title(
                    run_id=normalized_run_id,
                    role=role,
                    metric=metric,
                ),
                output_path=writer.path_for(f"distributions/roles/{role}/{metric}.png"),
            )
            writer.record_output(f"distributions/roles/{role}/{metric}.png")

    fixer_report = build_fixer_report(loaded.llm_calls)
    writer.write_json("fixer/summary.json", fixer_report.to_dict())
    writer.write_csv(
        "fixer/summary.csv",
        rows=[
            translate_row(
                row,
                column_labels=FIXER_SUMMARY_COLUMN_LABELS,
            )
            for row in fixer_report.summary_rows()
        ],
        fieldnames=list(FIXER_SUMMARY_COLUMN_LABELS.values()),
    )

    network_report, graph = build_network_report(
        actors_by_id=loaded.actors_by_id,
        activities=loaded.adopted_activities,
    )
    writer.write_csv(
        "network/nodes.csv",
        rows=[
            translate_row(
                item.to_row(),
                column_labels=NETWORK_NODE_COLUMN_LABELS,
            )
            for item in network_report.nodes
        ],
        fieldnames=list(NETWORK_NODE_COLUMN_LABELS.values()),
    )
    writer.write_csv(
        "network/edges.csv",
        rows=[
            translate_row(
                item.to_row(),
                column_labels=NETWORK_EDGE_COLUMN_LABELS,
            )
            for item in network_report.edges
        ],
        fieldnames=list(NETWORK_EDGE_COLUMN_LABELS.values()),
    )
    writer.write_json("network/summary.json", network_report.to_dict())
    writer.write_text(
        "network/summary.md",
        render_network_summary_markdown(
            run_id=normalized_run_id,
            report=network_report,
        ),
    )
    writer.write_graphml("network/graph.graphml", graph)
    render_network_plot(
        graph,
        title=network_title(run_id=normalized_run_id),
        output_path=writer.path_for("network/graph.png"),
    )
    writer.record_output("network/graph.png")

    manifest = ArtifactManifest(
        run_id=normalized_run_id,
        input_path=str(input_path),
        output_dir=str(output_dir),
        analyzed_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        total_events=loaded.event_count,
        llm_call_count=len(loaded.llm_calls),
        roles=loaded.roles,
        artifact_paths=sorted([*writer.created_files, "manifest.json"]),
        fixer_summary=fixer_report.to_dict(),
        network_summary=network_report.summary.to_dict(),
    )
    writer.write_json("manifest.json", manifest.to_dict())

    return AnalysisRunOutcome(
        run_id=normalized_run_id,
        input_path=input_path,
        output_dir=output_dir,
        artifact_count=len(writer.created_files),
        llm_call_count=len(loaded.llm_calls),
        roles=loaded.roles,
    )


def _resolve_output_dir(*, env_file: str | None) -> Path:
    try:
        return Path(load_settings_bundle(env_file).settings.storage.output_dir)
    except ValueError:
        if env_file is not None:
            raise
        return Path(StorageConfig().output_dir)
