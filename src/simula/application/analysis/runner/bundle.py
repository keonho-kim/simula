"""Report assembly helpers for analysis runner orchestration."""

from __future__ import annotations

from dataclasses import dataclass

import networkx as nx

from simula.application.analysis.metrics.actions import build_action_catalog_report
from simula.application.analysis.metrics.distributions import (
    build_distribution_report,
    build_performance_summary_report,
)
from simula.application.analysis.metrics.fixer import build_fixer_report
from simula.application.analysis.metrics.network import build_network_report
from simula.application.analysis.metrics.network_growth import (
    build_network_growth_report,
)
from simula.application.analysis.metrics.token_usage import build_token_usage_report
from simula.application.analysis.models import (
    ActionCatalogReport,
    DistributionReport,
    FixerReport,
    LoadedRunAnalysis,
    NetworkGrowthReport,
    NetworkReport,
    PerformanceSummaryReport,
    TokenUsageReport,
)


@dataclass(slots=True)
class AnalysisReportBundle:
    """Computed reports and graphs for one loaded run."""

    loaded: LoadedRunAnalysis
    distribution_report: DistributionReport
    performance_report: PerformanceSummaryReport
    fixer_report: FixerReport
    token_usage_report: TokenUsageReport
    action_report: ActionCatalogReport
    network_report: NetworkReport
    network_graph: nx.DiGraph
    growth_report: NetworkGrowthReport


def build_analysis_report_bundle(loaded: LoadedRunAnalysis) -> AnalysisReportBundle:
    """Compute every report needed by the analysis runner."""

    distribution_report = build_distribution_report(loaded.llm_calls)
    performance_report = build_performance_summary_report(loaded.llm_calls)
    fixer_report = build_fixer_report(loaded.llm_calls)
    token_usage_report = build_token_usage_report(loaded.llm_calls)
    action_report = build_action_catalog_report(
        planned_actions=loaded.planned_actions,
        adopted_activities=loaded.adopted_activities,
        has_plan_finalized_event=loaded.has_plan_finalized_event,
    )
    network_report, network_graph = build_network_report(
        actors_by_id=loaded.actors_by_id,
        activities=loaded.adopted_activities,
        planned_actions=loaded.planned_actions,
        planned_max_rounds=loaded.planned_max_rounds,
        has_actors_finalized_event=loaded.has_actors_finalized_event,
        has_round_actions_adopted_event=loaded.has_round_actions_adopted_event,
    )
    growth_report = build_network_growth_report(
        actors_by_id=loaded.actors_by_id,
        activities=loaded.adopted_activities,
        planned_actions=loaded.planned_actions,
        planned_max_rounds=loaded.planned_max_rounds,
        has_actors_finalized_event=loaded.has_actors_finalized_event,
        has_round_actions_adopted_event=loaded.has_round_actions_adopted_event,
    )
    return AnalysisReportBundle(
        loaded=loaded,
        distribution_report=distribution_report,
        performance_report=performance_report,
        fixer_report=fixer_report,
        token_usage_report=token_usage_report,
        action_report=action_report,
        network_report=network_report,
        network_graph=network_graph,
        growth_report=growth_report,
    )
