"""Artifact writing helpers for integrated run outputs."""

from __future__ import annotations

from simula.application.analysis.artifacts import ArtifactWriter
from simula.application.analysis.localization import (
    ACTION_SUMMARY_COLUMN_LABELS,
    FIXER_SUMMARY_COLUMN_LABELS,
    LLM_CALL_COLUMN_LABELS,
    NETWORK_EDGE_COLUMN_LABELS,
    NETWORK_GROWTH_COLUMN_LABELS,
    NETWORK_NODE_COLUMN_LABELS,
    PERFORMANCE_SUMMARY_COLUMN_LABELS,
    TOKEN_USAGE_COLUMN_LABELS,
    network_title,
    translate_row,
)
from simula.application.analysis.network_reporting import (
    render_network_summary_markdown,
)
from simula.application.analysis.plotting.distributions import (
    render_distribution_overview,
)
from simula.application.analysis.plotting.network import (
    compute_render_layout,
    render_network_growth_video,
    render_network_plot,
)
from simula.application.analysis.plotting.network_metrics import (
    render_network_concentration_plot,
    render_network_growth_metrics_plot,
)
from simula.application.analysis.runner.bundle import AnalysisReportBundle
from simula.application.analysis.summary_reporting import (
    render_analysis_summary_markdown,
)
from simula.application.analysis.token_usage_reporting import (
    render_token_usage_summary_markdown,
)


def write_analysis_artifacts(
    *,
    run_id: str,
    writer: ArtifactWriter,
    bundle: AnalysisReportBundle,
) -> dict[str, object]:
    """Write all artifacts for one computed analysis bundle."""

    loaded = bundle.loaded
    writer.write_csv(
        "data/llm_calls.csv",
        rows=[
            translate_row(
                record.to_row(),
                column_labels=LLM_CALL_COLUMN_LABELS,
            )
            for record in loaded.llm_calls
        ],
        fieldnames=list(LLM_CALL_COLUMN_LABELS.values()),
    )

    render_distribution_overview(
        distributions=bundle.distribution_report.overall,
        run_id=run_id,
        output_path=writer.path_for("assets/performance.summary.png"),
    )
    writer.record_output("assets/performance.summary.png")
    writer.write_csv(
        "data/performance.summary.csv",
        rows=[
            translate_row(
                row.to_row(),
                column_labels=PERFORMANCE_SUMMARY_COLUMN_LABELS,
            )
            for row in bundle.performance_report.rows
        ],
        fieldnames=list(PERFORMANCE_SUMMARY_COLUMN_LABELS.values()),
    )

    writer.write_csv(
        "data/fixer.summary.csv",
        rows=[
            translate_row(
                row,
                column_labels=FIXER_SUMMARY_COLUMN_LABELS,
            )
            for row in bundle.fixer_report.summary_rows()
        ],
        fieldnames=list(FIXER_SUMMARY_COLUMN_LABELS.values()),
    )

    writer.write_csv(
        "data/token_usage.summary.csv",
        rows=[
            translate_row(
                row,
                column_labels=TOKEN_USAGE_COLUMN_LABELS,
            )
            for row in bundle.token_usage_report.summary_rows()
        ],
        fieldnames=list(TOKEN_USAGE_COLUMN_LABELS.values()),
    )
    writer.write_text(
        "summaries/token_usage.summary.md",
        render_token_usage_summary_markdown(
            run_id=run_id,
            report=bundle.token_usage_report,
        ),
    )

    if bundle.action_report.rows:
        writer.write_csv(
            "data/actions.summary.csv",
            rows=[
                translate_row(
                    item.to_row(),
                    column_labels=ACTION_SUMMARY_COLUMN_LABELS,
                )
                for item in bundle.action_report.rows
            ],
            fieldnames=list(ACTION_SUMMARY_COLUMN_LABELS.values()),
        )

    writer.write_csv(
        "data/network.nodes.csv",
        rows=[
            translate_row(
                item.to_row(),
                column_labels=NETWORK_NODE_COLUMN_LABELS,
            )
            for item in bundle.network_report.nodes
        ],
        fieldnames=list(NETWORK_NODE_COLUMN_LABELS.values()),
    )
    writer.write_csv(
        "data/network.edges.csv",
        rows=[
            translate_row(
                item.to_row(),
                column_labels=NETWORK_EDGE_COLUMN_LABELS,
            )
            for item in bundle.network_report.edges
        ],
        fieldnames=list(NETWORK_EDGE_COLUMN_LABELS.values()),
    )
    if bundle.growth_report.rows:
        writer.write_csv(
            "data/network.growth.csv",
            rows=[
                translate_row(
                    item.to_row(),
                    column_labels=NETWORK_GROWTH_COLUMN_LABELS,
                )
                for item in bundle.growth_report.rows
            ],
            fieldnames=list(NETWORK_GROWTH_COLUMN_LABELS.values()),
        )
    writer.write_json("data/network.summary.json", bundle.network_report.to_dict())
    writer.write_text(
        "summaries/network.summary.md",
        render_network_summary_markdown(
            run_id=run_id,
            report=bundle.network_report,
            growth_report=bundle.growth_report,
            planned_actions=loaded.planned_actions,
        ),
    )
    writer.write_graphml("assets/network.graph.graphml", bundle.network_graph)

    layout = compute_render_layout(bundle.network_graph)
    render_network_plot(
        bundle.network_graph,
        title=network_title(run_id=run_id),
        output_path=writer.path_for("assets/network.graph.png"),
        layout=layout,
    )
    writer.record_output("assets/network.graph.png")

    render_network_growth_metrics_plot(
        run_id=run_id,
        growth_report=bundle.growth_report,
        output_path=writer.path_for("assets/network.growth_metrics.png"),
    )
    writer.record_output("assets/network.growth_metrics.png")

    render_network_concentration_plot(
        run_id=run_id,
        report=bundle.network_report,
        output_path=writer.path_for("assets/network.concentration.png"),
    )
    writer.record_output("assets/network.concentration.png")

    growth_video_path = writer.path_for("assets/network.growth.mp4")
    render_network_growth_video(
        run_id=run_id,
        title=network_title(run_id=run_id),
        output_path=growth_video_path,
        layout=layout,
        actors_by_id=loaded.actors_by_id,
        activities=loaded.adopted_activities,
        growth_report=bundle.growth_report,
        planned_actions=loaded.planned_actions,
        planned_max_rounds=loaded.planned_max_rounds,
        has_actors_finalized_event=loaded.has_actors_finalized_event,
        has_round_actions_adopted_event=loaded.has_round_actions_adopted_event,
    )
    if growth_video_path.exists():
        writer.record_output("assets/network.growth.mp4")

    writer.write_text(
        "summary.overview.md",
        render_analysis_summary_markdown(
            run_id=run_id,
            loaded=loaded,
            distribution_report=bundle.distribution_report,
            token_usage_report=bundle.token_usage_report,
            fixer_report=bundle.fixer_report,
            network_report=bundle.network_report,
            action_report=bundle.action_report,
            growth_report=bundle.growth_report,
        ),
    )
    return {
        "total_events": loaded.event_count,
        "llm_call_count": len(loaded.llm_calls),
        "roles": loaded.roles,
    }
