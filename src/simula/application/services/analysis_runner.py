"""Purpose:
- Orchestrate one JSONL run analysis without embedding analysis logic in services.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from simula.application.analysis import (
    ArtifactWriter,
    build_distribution_report,
    build_fixer_report,
    build_interaction_digests,
    build_network_report,
    build_token_usage_report,
    load_run_analysis,
    render_analysis_summary_markdown,
    render_distribution_overview,
    render_network_summary_markdown,
    render_network_plot,
    render_token_usage_summary_markdown,
    select_key_interactions,
)
from simula.application.analysis.localization import (
    FIXER_SUMMARY_COLUMN_LABELS,
    INTERACTION_COLUMN_LABELS,
    LLM_CALL_COLUMN_LABELS,
    NETWORK_EDGE_COLUMN_LABELS,
    NETWORK_NODE_COLUMN_LABELS,
    TOKEN_USAGE_COLUMN_LABELS,
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
    run_dir: str | None = None,
    run_id: str | None = None,
    env_file: str | None = None,
) -> AnalysisRunOutcome:
    """Analyze one saved run directory and write artifacts under `analysis/<run-id>`."""

    normalized_run_id, input_path = _resolve_analysis_input(
        run_dir=run_dir,
        run_id=run_id,
        env_file=env_file,
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
    render_distribution_overview(
        distributions=distribution_report.overall,
        run_id=normalized_run_id,
        output_path=writer.path_for("distributions/overview.png"),
    )
    writer.record_output("distributions/overview.png")

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

    token_usage_report = build_token_usage_report(loaded.llm_calls)
    writer.write_json("token_usage/summary.json", token_usage_report.to_dict())
    writer.write_csv(
        "token_usage/summary.csv",
        rows=[
            translate_row(
                row,
                column_labels=TOKEN_USAGE_COLUMN_LABELS,
            )
            for row in token_usage_report.summary_rows()
        ],
        fieldnames=list(TOKEN_USAGE_COLUMN_LABELS.values()),
    )
    writer.write_text(
        "token_usage/summary.md",
        render_token_usage_summary_markdown(
            run_id=normalized_run_id,
            report=token_usage_report,
        ),
    )

    network_report, graph = build_network_report(
        actors_by_id=loaded.actors_by_id,
        activities=loaded.adopted_activities,
        has_actors_finalized_event=loaded.has_actors_finalized_event,
        has_round_actions_adopted_event=loaded.has_round_actions_adopted_event,
    )
    interaction_digests = build_interaction_digests(
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
    writer.write_csv(
        "network/interactions.csv",
        rows=[
            translate_row(
                item.to_row(),
                column_labels=INTERACTION_COLUMN_LABELS,
            )
            for item in interaction_digests
        ],
        fieldnames=list(INTERACTION_COLUMN_LABELS.values()),
    )
    writer.write_json("network/summary.json", network_report.to_dict())
    writer.write_text(
        "network/summary.md",
        render_network_summary_markdown(
            run_id=normalized_run_id,
            report=network_report,
            interactions=select_key_interactions(interaction_digests, limit=5),
        ),
    )
    writer.write_graphml("network/graph.graphml", graph)
    render_network_plot(
        graph,
        title=network_title(run_id=normalized_run_id),
        output_path=writer.path_for("network/graph.png"),
    )
    writer.record_output("network/graph.png")
    writer.write_text(
        "summary.md",
        render_analysis_summary_markdown(
            run_id=normalized_run_id,
            loaded=loaded,
            distribution_report=distribution_report,
            token_usage_report=token_usage_report,
            fixer_report=fixer_report,
            network_report=network_report,
            interactions=select_key_interactions(interaction_digests, limit=5),
        ),
    )

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
        token_usage_summary=token_usage_report.to_dict(),
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


def _resolve_analysis_input(
    *,
    run_dir: str | None,
    run_id: str | None,
    env_file: str | None,
) -> tuple[str, Path]:
    if run_dir is not None and run_id is not None:
        raise ValueError("`--run-dir`와 `--run-id`는 동시에 함께 사용할 수 없습니다.")
    if run_dir is not None:
        return _resolve_run_dir_input(run_dir=run_dir)
    if run_id is not None:
        return _resolve_run_id_input(run_id=run_id, env_file=env_file)
    raise ValueError("`--run-dir` 또는 `--run-id` 중 하나를 지정해야 합니다.")


def _resolve_run_id_input(*, run_id: str, env_file: str | None) -> tuple[str, Path]:
    normalized_run_id = run_id.strip()
    if not normalized_run_id:
        raise ValueError("`--run-id`는 비어 있으면 안 됩니다.")
    return (
        normalized_run_id,
        _resolve_output_dir(env_file=env_file)
        / normalized_run_id
        / "simulation.log.jsonl",
    )


def _resolve_run_dir_input(*, run_dir: str) -> tuple[str, Path]:
    normalized_run_dir = run_dir.strip()
    if not normalized_run_dir:
        raise ValueError("`--run-dir`는 비어 있으면 안 됩니다.")

    resolved_run_dir = Path(normalized_run_dir).expanduser()
    normalized_run_id = resolved_run_dir.name.strip()
    if not normalized_run_id:
        raise ValueError("`--run-dir`에서 디렉터리 이름을 해석할 수 없습니다.")

    return normalized_run_id, resolved_run_dir / "simulation.log.jsonl"
