"""Purpose:
- Verify JSONL run analyzer loading, aggregation, and artifact writing.
"""

from __future__ import annotations

import json
import math
import tempfile
from pathlib import Path

import pytest
import simula.application.analysis.metrics.network_algorithms as network_algorithms

from simula.application.analysis.interactions import (
    build_interaction_digests,
)
from simula.application.analysis.loader import load_run_analysis
from simula.application.analysis.metrics.actions import build_action_catalog_report
from simula.application.analysis.metrics.distributions import build_distribution_report
from simula.application.analysis.metrics.distributions import build_performance_summary_report
from simula.application.analysis.metrics.fixer import build_fixer_report
from simula.application.analysis.metrics.network_growth import build_network_growth_report
from simula.application.analysis.metrics.network import build_network_report
from simula.application.analysis.metrics.token_usage import build_token_usage_report
from simula.application.analysis.models import (
    ActorRecord,
    AdoptedActivityRecord,
    PlannedActionRecord,
)
from simula.application.analysis.network_reporting import (
    render_network_summary_markdown,
)
from tests.helpers import sample_analysis_log_text


def test_load_run_analysis_rejects_invalid_jsonl(tmp_path) -> None:
    log_path = tmp_path / "simulation.log.jsonl"
    log_path.write_text("{bad json}\n", encoding="utf-8")

    with pytest.raises(ValueError, match="JSONL 형식이 올바르지 않습니다"):
        load_run_analysis(log_path, expected_run_id="run-1")


def test_load_run_analysis_requires_llm_calls(tmp_path) -> None:
    log_path = tmp_path / "simulation.log.jsonl"
    log_path.write_text(
        json.dumps(
            {
                "event": "simulation_started",
                "event_key": "simulation_started",
                "run_id": "run-1",
            },
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="llm_call 이벤트가 없습니다"):
        load_run_analysis(log_path, expected_run_id="run-1")


def test_distribution_report_tracks_missing_values_and_kde_skip() -> None:
    loaded = _load_sample_data()

    report = build_distribution_report(loaded.llm_calls)

    overall_input = report.overall["input_tokens"]
    planner_output = report.by_role["planner"]["output_tokens"]

    assert overall_input.record_count == 5
    assert overall_input.sample_count == 5
    assert overall_input.to_dict()["metric_label"] == "입력 토큰"
    assert overall_input.kde_skipped_reason == "KDE를 계산하려면 값이 모두 같지 않아야 합니다."
    assert planner_output.record_count == 1
    assert planner_output.sample_count == 0
    assert planner_output.missing_count == 1


def test_performance_summary_report_bins_by_input_and_output_tokens() -> None:
    loaded = _load_sample_data()

    report = build_performance_summary_report(loaded.llm_calls)

    assert len(report.rows) == 1
    row = report.rows[0]
    assert row.input_tokens_bin_start == 0
    assert row.input_tokens_bin_end == 999
    assert row.output_tokens_bin_start == 0
    assert row.output_tokens_bin_end == 999
    assert row.call_count == 4
    assert row.ttft_sample_count == 4
    assert row.duration_sample_count == 4
    assert row.ttft_p90 is not None
    assert row.ttft_p95 is not None
    assert row.ttft_p99 is not None
    assert row.duration_p90 is not None
    assert row.duration_p95 is not None
    assert row.duration_p99 is not None


def test_fixer_report_attributes_roles_and_retries() -> None:
    loaded = _load_sample_data()

    report = build_fixer_report(loaded.llm_calls)

    assert report.overall.fixer_call_count == 3
    assert report.overall.session_count == 2
    assert report.overall.retry_count == 1
    assert report.by_role["actor"].fixer_call_count == 2
    assert report.by_role["actor"].session_count == 1
    assert report.by_role["actor"].retry_count == 1
    assert report.by_role["observer"].fixer_call_count == 1
    assert report.sessions[0].schema_name == "ActorActionProposal"
    assert report.sessions[0].attempt_count == 2


def test_token_usage_report_tracks_overall_and_role_totals() -> None:
    loaded = _load_sample_data()

    report = build_token_usage_report(loaded.llm_calls)

    assert report.overall.call_count == 5
    assert report.overall.input_tokens_total == 50
    assert report.overall.output_tokens_total == 18
    assert report.overall.total_tokens_total == 68
    assert report.overall.output_tokens_missing_count == 1
    assert report.by_role["fixer"].call_count == 3
    assert report.by_role["fixer"].input_tokens_total == 30
    assert report.by_role["fixer"].output_tokens_total == 13
    assert report.by_role["fixer"].total_tokens_total == 43
    assert report.by_role["planner"].output_tokens_missing_count == 1
    assert report.by_role["fixer"].output_tokens_stats.min_value == pytest.approx(3.0)
    assert report.by_role["fixer"].output_tokens_stats.max_value == pytest.approx(6.0)
    assert report.by_role["fixer"].output_tokens_stats.mean_value == pytest.approx(13 / 3)
    assert report.overall.total_tokens_stats.p95_value is not None


def test_load_run_analysis_exposes_task_and_artifact_metadata() -> None:
    loaded = _load_sample_data()

    planner_call = loaded.llm_calls[0]
    fixer_call = loaded.llm_calls[2]

    assert planner_call.task_identifier == "planner.planning_analysis"
    assert planner_call.artifact_key == "planning_analysis"
    assert planner_call.schema_name == "PlanningAnalysis"
    assert planner_call.provider_structured_mode == "prompt_parse"
    assert planner_call.prompt_variant == "primary"
    assert fixer_call.task_identifier == "fixer.json_repair.actor.actor_action_proposal"
    assert fixer_call.target_role == "actor"
    assert fixer_call.target_task_key == "actor_action_proposal"
    assert fixer_call.target_artifact_key == "pending_actor_proposals"
    assert fixer_call.fixer_schema_name == "ActorActionProposal"


def test_load_run_analysis_parses_planned_actions_and_round_cap() -> None:
    loaded = _load_sample_data()

    assert loaded.has_plan_finalized_event is True
    assert loaded.planned_max_rounds == 3
    assert [item.action_type for item in loaded.planned_actions] == [
        "private_check_in",
        "public_signal",
        "unused_action",
    ]


def test_action_catalog_report_counts_adopted_and_unused_actions() -> None:
    loaded = _load_sample_data()

    report = build_action_catalog_report(
        planned_actions=loaded.planned_actions,
        adopted_activities=loaded.adopted_activities,
        has_plan_finalized_event=loaded.has_plan_finalized_event,
    )

    assert report.empty_reason is None
    by_type = {item.action_type: item for item in report.rows}
    assert by_type["private_check_in"].adopted_count == 1
    assert by_type["public_signal"].adopted_count == 1
    assert by_type["unused_action"].adopted_count == 0


def test_network_growth_report_tracks_cumulative_round_metrics() -> None:
    loaded = _load_sample_data()

    report = build_network_growth_report(
        actors_by_id=loaded.actors_by_id,
        activities=loaded.adopted_activities,
        planned_max_rounds=loaded.planned_max_rounds,
        has_actors_finalized_event=loaded.has_actors_finalized_event,
        has_round_actions_adopted_event=loaded.has_round_actions_adopted_event,
    )

    assert [item.round_index for item in report.rows] == [1, 2, 3]
    assert report.rows[0].participating_actor_count == 2
    assert report.rows[0].edge_count == 1
    assert report.rows[0].new_actor_count == 2
    assert report.rows[0].new_edge_count == 1
    assert report.rows[0].top_degree_cast_id == "alpha"
    assert report.rows[0].top_degree_display_name == "Alpha"
    assert report.rows[1].edge_count == 1
    assert report.rows[2].edge_count == 1


def test_network_report_counts_targets_and_intent_only_edges() -> None:
    loaded = _load_sample_data()

    report, graph = build_network_report(
        actors_by_id=loaded.actors_by_id,
        activities=loaded.adopted_activities,
    )

    assert report.summary.node_count == 3
    assert report.summary.edge_count == 1
    alpha_beta = next(
        edge
        for edge in report.edges
        if edge.source_cast_id == "alpha" and edge.target_cast_id == "beta"
    )

    assert alpha_beta.action_count == 1
    assert alpha_beta.intent_only_count == 0
    assert alpha_beta.private_count == 1
    assert alpha_beta.thread_event_count == 1
    assert alpha_beta.label_preview == "private_check_in"
    assert alpha_beta.label_variant_count == 1
    assert graph["alpha"]["beta"]["weight"] == 1
    assert graph["alpha"]["beta"]["action_count"] == 1
    assert report.summary.participating_actor_count == 2
    assert report.summary.isolated_actor_count == 1


def test_network_report_builds_complexity_rankings() -> None:
    report, _ = build_network_report(
        actors_by_id=_actors("alpha", "beta", "gamma", "delta", "epsilon", "zeta"),
        activities=_activities(
            ("alpha", "delta"),
            ("alpha", "epsilon"),
            ("beta", "delta"),
            ("gamma", "delta"),
            ("delta", "epsilon"),
        ),
    )

    assert report.summary.participating_actor_count == 5
    assert report.summary.participating_actor_ratio == pytest.approx(5 / 6)
    assert report.summary.isolated_actor_count == 1
    assert report.summary.isolated_actor_ratio == pytest.approx(1 / 6)
    assert report.summary.density == pytest.approx(5 / 30)
    assert report.summary.weak_component_count == 2
    assert report.summary.strong_component_count == 6
    assert report.summary.largest_weak_component_ratio == pytest.approx(5 / 6)
    assert report.leaderboards["hubs"][0].cast_id == "alpha"
    assert report.leaderboards["authorities"][0].cast_id == "delta"
    assert report.leaderboards["brokers"][0].cast_id == "delta"
    assert report.leaderboards["influence"][0].cast_id == "epsilon"
    assert report.summary.benchmark_metrics.participation_entropy == pytest.approx(
        0.7435,
        rel=1e-3,
    )
    assert report.summary.benchmark_metrics.centralization == pytest.approx(0.7)


def test_network_report_tracks_clustering_core_and_communities() -> None:
    report, _ = build_network_report(
        actors_by_id=_actors("alpha", "beta", "gamma", "delta", "epsilon", "zeta"),
        activities=_activities(
            ("alpha", "beta"),
            ("beta", "alpha"),
            ("beta", "gamma"),
            ("gamma", "beta"),
            ("gamma", "alpha"),
            ("alpha", "gamma"),
            ("delta", "epsilon"),
            ("epsilon", "delta"),
        ),
    )

    assert report.summary.reciprocity == pytest.approx(1.0)
    assert report.summary.average_clustering == pytest.approx(0.5)
    assert report.summary.transitivity == pytest.approx(1.0)
    assert report.summary.max_core_number == 2
    assert report.summary.community_count == 2
    assert report.summary.benchmark_metrics.community_count == 2
    assert report.summary.benchmark_metrics.modularity is not None
    assert report.summary.benchmark_metrics.modularity > 0
    assert report.communities[0].member_cast_ids == ["alpha", "beta", "gamma"]
    assert report.communities[1].member_cast_ids == ["delta", "epsilon"]


def test_network_report_marks_skipped_metrics_for_edge_free_graph() -> None:
    report, _ = build_network_report(
        actors_by_id=_actors("alpha", "beta", "gamma"),
        activities=[],
    )

    assert report.summary.edge_count == 0
    assert report.summary.participating_actor_count == 0
    assert report.summary.isolated_actor_count == 3
    assert report.summary.empty_reason == "채택된 행위자 상호작용이 없습니다."
    assert report.summary.skipped_metrics["hub_score"] == "연결 엣지가 없어 계산할 수 없습니다."
    assert report.summary.skipped_metrics["core_number"] == "연결 엣지가 없어 계산할 수 없습니다."
    assert report.summary.skipped_metrics["participation_entropy"] == "채택된 액션이 없어 계산할 수 없습니다."
    assert report.summary.skipped_metrics["action_type_diversity"] == "채택된 액션이 없어 계산할 수 없습니다."
    assert report.summary.skipped_metrics["average_path_depth"] == "도달 가능한 경로가 없어 계산할 수 없습니다."
    assert report.summary.skipped_metrics["network_diameter"] == "도달 가능한 경로가 없어 계산할 수 없습니다."
    assert report.leaderboards["hubs"] == []
    assert all(node.hub_score is None for node in report.nodes)
    assert all(node.in_degree_centrality == 0.0 for node in report.nodes)


def test_network_report_marks_missing_jsonl_event_inputs() -> None:
    report, _ = build_network_report(
        actors_by_id={},
        activities=[],
        has_actors_finalized_event=False,
        has_round_actions_adopted_event=False,
    )

    assert report.summary.empty_reason == "`actors_finalized` 이벤트가 없어 행위자 노드가 비어 있습니다."
    assert report.summary.input_warnings == [
        "`actors_finalized` 이벤트가 없어 전체 actor roster를 복원하지 못했습니다.",
        "`round_actions_adopted` 이벤트가 없어 채택된 상호작용을 복원하지 못했습니다.",
    ]


def test_network_report_records_algorithm_failures(monkeypatch) -> None:
    def _boom(*args, **kwargs):  # noqa: ANN002, ANN003
        del args, kwargs
        raise RuntimeError("forced failure")

    monkeypatch.setattr(network_algorithms.nx, "hits", _boom)
    monkeypatch.setattr(network_algorithms.nx, "pagerank", _boom)

    report, _ = build_network_report(
        actors_by_id=_actors("alpha", "beta", "gamma"),
        activities=_activities(("alpha", "beta"), ("beta", "gamma")),
    )

    assert report.summary.skipped_metrics["hub_score"] == "RuntimeError: forced failure"
    assert (
        report.summary.skipped_metrics["authority_score"]
        == "RuntimeError: forced failure"
    )
    assert report.summary.skipped_metrics["pagerank"] == "RuntimeError: forced failure"
    assert all(node.hub_score is None for node in report.nodes)
    assert all(node.pagerank is None for node in report.nodes)


def test_network_summary_markdown_describes_algorithms_and_lists_all_actor_scores() -> None:
    report, _ = build_network_report(
        actors_by_id=_actors("alpha", "beta", "gamma"),
        activities=_activities(("alpha", "beta"), ("beta", "gamma")),
    )
    growth_report = build_network_growth_report(
        actors_by_id=_actors("alpha", "beta", "gamma"),
        activities=_activities(("alpha", "beta"), ("beta", "gamma")),
    )

    markdown = render_network_summary_markdown(
        run_id="run-1",
        report=report,
        growth_report=growth_report,
    )

    assert "## 먼저 볼 것" in markdown
    assert "## 누가 중심에 있었나" in markdown
    assert "## 누가 직접·간접으로 퍼졌나" in markdown
    assert "## 연결이 어떻게 늘어났나" in markdown
    assert "## 연결이 어디로 몰렸나" in markdown
    assert "## 벤치마크 지표" in markdown
    assert "## 계산 메모" in markdown
    assert "Alpha(`alpha`): 1명과 연결됨" in markdown
    assert "발신:" in markdown
    assert "수신:" in markdown
    assert "가장 많은 사람과 직접 연결된 사람" in markdown
    assert "### 전체 행위자 연결 점수" not in markdown


def test_network_report_computes_action_type_diversity() -> None:
    cases = [
        (
            _actors("alpha", "beta", "gamma", "delta", "epsilon", "zeta"),
            [
                PlannedActionRecord("private_check_in", "비공개 확인", "", ["private"], True),
                PlannedActionRecord("public_signal", "공개 신호", "", ["public"], False),
                PlannedActionRecord("unused_1", "미사용 1", "", ["group"], False),
                PlannedActionRecord("unused_2", "미사용 2", "", ["group"], False),
                PlannedActionRecord("unused_3", "미사용 3", "", ["group"], False),
            ],
            math.log(2) / math.log(5),
        ),
        (
            _actors("alpha", "beta", "gamma"),
            [],
            1.0,
        ),
    ]

    for actors_by_id, planned_actions, expected_diversity in cases:
        report, _ = build_network_report(
            actors_by_id=actors_by_id,
            activities=[
                AdoptedActivityRecord(
                    round_index=1,
                    source_cast_id="alpha",
                    target_cast_ids=["beta"],
                    visibility="private",
                    thread_id="thread-1",
                    action_type="private_check_in",
                ),
                AdoptedActivityRecord(
                    round_index=2,
                    source_cast_id="beta",
                    target_cast_ids=["gamma"],
                    visibility="public",
                    thread_id="thread-2",
                    action_type="public_signal",
                ),
            ],
            planned_actions=planned_actions,
        )

        assert report.summary.benchmark_metrics.action_type_diversity == pytest.approx(
            expected_diversity
        )


def test_network_report_tracks_directed_depth_metrics() -> None:
    report, _ = build_network_report(
        actors_by_id=_actors("alpha", "beta", "gamma", "delta"),
        activities=_activities(
            ("alpha", "beta"),
            ("beta", "gamma"),
            ("gamma", "delta"),
        ),
    )

    assert report.summary.benchmark_metrics.average_path_depth == pytest.approx(10 / 6)
    assert report.summary.benchmark_metrics.network_diameter == 3


def test_network_report_tracks_top20_interaction_share_by_participating_actor_count() -> None:
    five_actor_report, _ = build_network_report(
        actors_by_id=_actors("alpha", "beta", "gamma", "delta", "epsilon"),
        activities=_activities(
            ("alpha", "beta"),
            ("alpha", "gamma"),
            ("alpha", "delta"),
            ("alpha", "epsilon"),
        ),
    )
    six_actor_report, _ = build_network_report(
        actors_by_id=_actors("alpha", "beta", "gamma", "delta", "epsilon", "zeta"),
        activities=[
            *_activities(
                ("alpha", "beta"),
                ("alpha", "gamma"),
                ("alpha", "delta"),
                ("alpha", "epsilon"),
            ),
            AdoptedActivityRecord(
                round_index=5,
                source_cast_id="zeta",
                target_cast_ids=["alpha"],
                visibility="private",
                thread_id="thread-5",
            ),
        ],
    )

    assert five_actor_report.summary.participating_actor_count == 5
    assert five_actor_report.summary.benchmark_metrics.top20_interaction_share == pytest.approx(
        0.5
    )
    assert six_actor_report.summary.participating_actor_count == 6
    assert six_actor_report.summary.benchmark_metrics.top20_interaction_share == pytest.approx(
        0.6
    )


def test_interaction_digests_prefer_thread_grouping_and_latest_utterance() -> None:
    actors_by_id = _actors("alpha", "beta", "gamma")
    activities = [
        AdoptedActivityRecord(
            round_index=1,
            source_cast_id="alpha",
            target_cast_ids=["beta"],
            visibility="private",
            thread_id="pair-thread",
            action_type="private_check_in",
            summary="Alpha가 Beta에게 비공개로 확인을 요청한다.",
            detail="지금 감정선을 비공개로 먼저 확인하려고 한다.",
            utterance="지금 잠깐 따로 이야기할래?",
        ),
        AdoptedActivityRecord(
            round_index=2,
            source_cast_id="beta",
            target_cast_ids=["alpha"],
            visibility="private",
            thread_id="pair-thread",
            action_type="private_check_in",
            summary="Beta가 Alpha에게 짧게 답한다.",
            detail="조금 더 생각할 시간이 필요하다고 한다.",
            utterance="지금은 바로 답하기 어렵네요.",
        ),
        AdoptedActivityRecord(
            round_index=2,
            source_cast_id="alpha",
            target_cast_ids=["gamma"],
            visibility="public",
            thread_id="",
            action_type="public_signal",
            summary="Alpha가 Gamma를 공개적으로 의식한다.",
            detail="직접 묻지는 않지만 반응을 탐색한다.",
            utterance="",
        ),
    ]

    digests = build_interaction_digests(
        actors_by_id=actors_by_id,
        activities=activities,
    )

    assert digests[0].grouping_type == "thread"
    assert digests[0].interaction_key == "pair-thread"
    assert digests[0].activity_count == 2
    assert digests[0].latest_message == "지금은 바로 답하기 어렵네요."
    assert digests[0].representative_message == "지금은 바로 답하기 어렵네요."
    assert digests[1].grouping_type == "participants_action"
    assert digests[1].interaction_key == "alpha+gamma:public_signal"


def _load_sample_data():
    temp_dir = Path(tempfile.mkdtemp(prefix="analysis-loader-"))
    log_path = temp_dir / "simulation.log.jsonl"
    log_path.write_text(sample_analysis_log_text(run_id="run-1"), encoding="utf-8")
    return load_run_analysis(log_path, expected_run_id="run-1")


def _actors(*cast_ids: str) -> dict[str, ActorRecord]:
    return {
        cast_id: ActorRecord(
            cast_id=cast_id,
            display_name=cast_id.title(),
        )
        for cast_id in cast_ids
    }


def _activities(*edges: tuple[str, str]) -> list[AdoptedActivityRecord]:
    return [
        AdoptedActivityRecord(
            round_index=index,
            source_cast_id=source_cast_id,
            target_cast_ids=[target_cast_id],
            visibility="private",
            thread_id=f"thread-{index}",
        )
        for index, (source_cast_id, target_cast_id) in enumerate(edges, start=1)
    ]
