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
    render_distribution_plot,
    render_network_plot,
)
from simula.application.analysis.models import ArtifactManifest
from simula.infrastructure.config.loader import load_settings_bundle
from simula.infrastructure.config.models import StorageConfig

_LLM_CALL_FIELDNAMES = [
    "run_id",
    "sequence",
    "role",
    "call_kind",
    "scope",
    "duration_seconds",
    "ttft_seconds",
    "input_tokens",
    "output_tokens",
    "total_tokens",
    "log_context",
    "prompt",
    "raw_response",
]

_FIXER_SUMMARY_FIELDNAMES = [
    "role",
    "fixer_call_count",
    "session_count",
    "retry_count",
    "ttft_count",
    "ttft_min",
    "ttft_max",
    "ttft_mean",
    "ttft_median",
    "ttft_p95",
    "ttft_p99",
    "duration_count",
    "duration_min",
    "duration_max",
    "duration_mean",
    "duration_median",
    "duration_p95",
    "duration_p99",
]

_NETWORK_NODE_FIELDNAMES = [
    "cast_id",
    "display_name",
    "initiated_actions",
    "received_actions",
    "sent_relations",
    "received_relations",
    "total_weight",
    "counterpart_count",
]

_NETWORK_EDGE_FIELDNAMES = [
    "source_cast_id",
    "source_display_name",
    "target_cast_id",
    "target_display_name",
    "action_count",
    "intent_only_count",
    "public_count",
    "group_count",
    "private_count",
    "thread_event_count",
    "first_round",
    "last_round",
    "total_weight",
]


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
        raise ValueError("`--run-id` must not be empty.")

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
        rows=[record.to_row() for record in loaded.llm_calls],
        fieldnames=_LLM_CALL_FIELDNAMES,
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
            title=f"{normalized_run_id} overall {metric}",
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
                title=f"{normalized_run_id} {role} {metric}",
                output_path=writer.path_for(f"distributions/roles/{role}/{metric}.png"),
            )
            writer.record_output(f"distributions/roles/{role}/{metric}.png")

    fixer_report = build_fixer_report(loaded.llm_calls)
    writer.write_json("fixer/summary.json", fixer_report.to_dict())
    writer.write_csv(
        "fixer/summary.csv",
        rows=fixer_report.summary_rows(),
        fieldnames=_FIXER_SUMMARY_FIELDNAMES,
    )

    network_report, graph = build_network_report(
        actors_by_id=loaded.actors_by_id,
        activities=loaded.adopted_activities,
    )
    writer.write_csv(
        "network/nodes.csv",
        rows=[item.to_row() for item in network_report.nodes],
        fieldnames=_NETWORK_NODE_FIELDNAMES,
    )
    writer.write_csv(
        "network/edges.csv",
        rows=[item.to_row() for item in network_report.edges],
        fieldnames=_NETWORK_EDGE_FIELDNAMES,
    )
    writer.write_graphml("network/graph.graphml", graph)
    render_network_plot(
        graph,
        title=f"{normalized_run_id} actor relationship network",
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
