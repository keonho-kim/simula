"""Purpose:
- Verify JSONL run analyzer loading, aggregation, and artifact writing.
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import pytest
import simula.application.analysis.metrics.network_algorithms as network_algorithms
import simula.application.analysis.plotting.network as plotting_network

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
from simula.application.analysis.models import ActorRecord, AdoptedActivityRecord
from simula.application.analysis.network_reporting import (
    render_network_summary_markdown,
)
from simula.application.services import analysis_runner
from simula.infrastructure.config.loader import LoadedSettingsBundle
from simula.infrastructure.config.models import (
    AppSettings,
    ModelConfig,
    ModelRouterConfig,
    StorageConfig,
)


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


def test_run_analysis_rejects_empty_run_dir() -> None:
    with pytest.raises(ValueError, match="`--run-dir`는 비어 있으면 안 됩니다."):
        analysis_runner.run_analysis(run_dir="   ")


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
    assert fixer_call.task_identifier == "fixer.json_repair.actor.actor_action_proposal"
    assert fixer_call.target_role == "actor"
    assert fixer_call.target_task_key == "actor_action_proposal"
    assert fixer_call.target_artifact_key == "pending_actor_proposals"


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
    assert report.rows[0].participating_actor_count == 3
    assert report.rows[0].edge_count == 3
    assert report.rows[0].new_actor_count == 3
    assert report.rows[0].new_edge_count == 3
    assert report.rows[0].top_degree_cast_id == "alpha"
    assert report.rows[0].top_degree_display_name == "Alpha"
    assert report.rows[1].edge_count == 3
    assert report.rows[2].edge_count == 3


def test_network_report_counts_targets_and_intent_only_edges() -> None:
    loaded = _load_sample_data()

    report, graph = build_network_report(
        actors_by_id=loaded.actors_by_id,
        activities=loaded.adopted_activities,
    )

    assert report.summary.node_count == 3
    assert report.summary.edge_count == 3
    alpha_beta = next(
        edge
        for edge in report.edges
        if edge.source_cast_id == "alpha" and edge.target_cast_id == "beta"
    )
    alpha_gamma = next(
        edge
        for edge in report.edges
        if edge.source_cast_id == "alpha" and edge.target_cast_id == "gamma"
    )
    beta_alpha = next(
        edge
        for edge in report.edges
        if edge.source_cast_id == "beta" and edge.target_cast_id == "alpha"
    )

    assert alpha_beta.action_count == 1
    assert alpha_beta.intent_only_count == 0
    assert alpha_beta.private_count == 1
    assert alpha_beta.thread_event_count == 1
    assert alpha_beta.label_preview == "private_check_in"
    assert alpha_beta.label_variant_count == 1
    assert alpha_gamma.action_count == 0
    assert alpha_gamma.intent_only_count == 1
    assert alpha_gamma.label_preview == "private_check_in"
    assert beta_alpha.intent_only_count == 1
    assert beta_alpha.public_count == 1
    assert beta_alpha.label_preview == "public_signal"
    assert graph["alpha"]["beta"]["weight"] == 1
    assert graph["alpha"]["beta"]["action_count"] == 1
    assert graph["alpha"]["gamma"]["weight"] == 1
    assert graph["alpha"]["gamma"]["action_count"] == 0
    assert report.summary.participating_actor_count == 3
    assert report.summary.isolated_actor_count == 0


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
    assert "## 계산 메모" in markdown
    assert "Alpha(`alpha`): 1명과 연결됨" in markdown
    assert "발신:" in markdown
    assert "수신:" in markdown
    assert "가장 많은 사람과 직접 연결된 사람" in markdown
    assert "### 전체 행위자 연결 점수" not in markdown


def test_interaction_digests_prefer_thread_grouping_and_latest_utterance() -> None:
    actors_by_id = _actors("alpha", "beta", "gamma")
    activities = [
        AdoptedActivityRecord(
            round_index=1,
            source_cast_id="alpha",
            target_cast_ids=["beta"],
            intent_target_cast_ids=["beta"],
            visibility="private",
            thread_id="pair-thread",
            action_type="private_check_in",
            action_summary="Alpha가 Beta에게 비공개로 확인을 요청한다.",
            action_detail="지금 감정선을 비공개로 먼저 확인하려고 한다.",
            utterance="지금 잠깐 따로 이야기할래?",
        ),
        AdoptedActivityRecord(
            round_index=2,
            source_cast_id="beta",
            target_cast_ids=["alpha"],
            intent_target_cast_ids=["alpha"],
            visibility="private",
            thread_id="pair-thread",
            action_type="private_check_in",
            action_summary="Beta가 Alpha에게 짧게 답한다.",
            action_detail="조금 더 생각할 시간이 필요하다고 한다.",
            utterance="지금은 바로 답하기 어렵네요.",
        ),
        AdoptedActivityRecord(
            round_index=2,
            source_cast_id="alpha",
            target_cast_ids=["gamma"],
            intent_target_cast_ids=["gamma"],
            visibility="public",
            thread_id="",
            action_type="public_signal",
            action_summary="Alpha가 Gamma를 공개적으로 의식한다.",
            action_detail="직접 묻지는 않지만 반응을 탐색한다.",
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


def test_run_analysis_writes_expected_artifacts(tmp_path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    output_dir = tmp_path / "output"
    run_id = "run-1"
    run_dir = output_dir / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "simulation.log.jsonl").write_text(
        _sample_log_text(run_id=run_id),
        encoding="utf-8",
    )
    settings = _build_settings(output_dir=output_dir)

    def _fake_load_settings_bundle(env_file=None, *, cli_overrides=None):  # noqa: ANN001
        del env_file, cli_overrides
        return LoadedSettingsBundle(settings=settings)

    monkeypatch.setattr(
        analysis_runner,
        "load_settings_bundle",
        _fake_load_settings_bundle,
    )
    monkeypatch.setattr(
        plotting_network,
        "_compute_layout_positions",
        lambda graph: {
            node: (float(index), float(index))
            for index, node in enumerate(graph.nodes(), start=1)
        },
    )

    outcome = analysis_runner.run_analysis(run_id=run_id)

    assert outcome.run_id == run_id
    assert (tmp_path / "analysis" / run_id / "manifest.json").exists()
    assert (tmp_path / "analysis" / run_id / "summary.md").exists()
    assert (tmp_path / "analysis" / run_id / "llm_calls.csv").exists()
    assert (tmp_path / "analysis" / run_id / "performance" / "summary.png").exists()
    assert (tmp_path / "analysis" / run_id / "performance" / "summary.csv").exists()
    assert (tmp_path / "analysis" / run_id / "actions" / "summary.csv").exists()
    assert (tmp_path / "analysis" / run_id / "fixer" / "summary.csv").exists()
    assert (tmp_path / "analysis" / run_id / "token_usage" / "summary.csv").exists()
    assert (tmp_path / "analysis" / run_id / "token_usage" / "summary.md").exists()
    assert (tmp_path / "analysis" / run_id / "network" / "nodes.csv").exists()
    assert (tmp_path / "analysis" / run_id / "network" / "edges.csv").exists()
    assert (tmp_path / "analysis" / run_id / "network" / "growth.csv").exists()
    assert (tmp_path / "analysis" / run_id / "network" / "summary.json").exists()
    assert (tmp_path / "analysis" / run_id / "network" / "summary.md").exists()
    assert (tmp_path / "analysis" / run_id / "network" / "growth_metrics.png").exists()
    assert (tmp_path / "analysis" / run_id / "network" / "concentration.png").exists()
    assert (tmp_path / "analysis" / run_id / "network" / "growth.mp4").exists()
    assert (tmp_path / "analysis" / run_id / "network" / "graph.graphml").exists()
    assert (tmp_path / "analysis" / run_id / "network" / "graph.png").exists()
    assert not (tmp_path / "analysis" / run_id / "distributions" / "overview.png").exists()
    assert not (tmp_path / "analysis" / run_id / "fixer" / "summary.json").exists()
    assert not (tmp_path / "analysis" / run_id / "token_usage" / "summary.json").exists()
    assert not (tmp_path / "analysis" / run_id / "network" / "interactions.csv").exists()

    manifest = json.loads(
        (tmp_path / "analysis" / run_id / "manifest.json").read_text(encoding="utf-8")
    )
    assert manifest["run_id"] == run_id
    assert manifest["roles_display"] == ["actor (행위자)", "fixer (JSON 복구)", "planner (계획)"]
    assert "summary.md" in manifest["artifact_paths"]
    assert "llm_calls.csv" in manifest["artifact_paths"]
    assert "actions/summary.csv" in manifest["artifact_paths"]
    assert "performance/summary.png" in manifest["artifact_paths"]
    assert "performance/summary.csv" in manifest["artifact_paths"]
    assert "token_usage/summary.csv" in manifest["artifact_paths"]
    assert "token_usage/summary.md" in manifest["artifact_paths"]
    assert "distributions/overview.png" not in manifest["artifact_paths"]
    assert "network/summary.json" in manifest["artifact_paths"]
    assert "network/summary.md" in manifest["artifact_paths"]
    assert "network/growth.csv" in manifest["artifact_paths"]
    assert "network/growth_metrics.png" in manifest["artifact_paths"]
    assert "network/concentration.png" in manifest["artifact_paths"]
    assert "network/growth.mp4" in manifest["artifact_paths"]
    assert "token_usage_summary" not in manifest
    assert "network_summary" not in manifest
    assert "fixer_summary" not in manifest
    llm_calls_csv = (
        tmp_path / "analysis" / run_id / "llm_calls.csv"
    ).read_text(encoding="utf-8")
    assert "실행 ID,호출 순번,역할,역할 표시명" in llm_calls_csv
    assert "태스크 키" in llm_calls_csv
    assert "결과물 키" in llm_calls_csv

    token_usage_md = (
        tmp_path / "analysis" / run_id / "token_usage" / "summary.md"
    ).read_text(encoding="utf-8")
    assert "## 개요" in token_usage_md
    assert "## 역할별 누적 사용량" in token_usage_md
    assert "평균" in token_usage_md
    assert "범위" in token_usage_md
    assert "p95" in token_usage_md
    token_usage_csv = (
        tmp_path / "analysis" / run_id / "token_usage" / "summary.csv"
    ).read_text(encoding="utf-8")
    assert "입력 토큰 평균값" in token_usage_csv
    assert "총 토큰 p95" in token_usage_csv
    performance_csv = (
        tmp_path / "analysis" / run_id / "performance" / "summary.csv"
    ).read_text(encoding="utf-8")
    assert "입력 토큰 bin 시작" in performance_csv
    assert "출력 토큰 bin 끝" in performance_csv
    assert "TTFT p90" in performance_csv
    assert "소요 시간 p99" in performance_csv
    network_summary_json = json.loads(
        (
            tmp_path
            / "analysis"
            / run_id
            / "network"
            / "summary.json"
        ).read_text(encoding="utf-8")
    )
    assert network_summary_json["summary"]["edge_count"] == 3
    assert "hubs" in network_summary_json["leaderboards"]
    network_summary_md = (
        tmp_path / "analysis" / run_id / "network" / "summary.md"
    ).read_text(encoding="utf-8")
    assert "## 먼저 볼 것" in network_summary_md
    assert "## 누가 중심에 있었나" in network_summary_md
    assert "## 누가 직접·간접으로 퍼졌나" in network_summary_md
    assert "## 연결이 어떻게 늘어났나" in network_summary_md
    assert "## 연결이 어디로 몰렸나" in network_summary_md
    assert "## 계산 메모" in network_summary_md
    assert "### 전체 행위자 연결 점수" not in network_summary_md
    assert "발신:" in network_summary_md
    assert "수신:" in network_summary_md
    assert "비공개 확인" in network_summary_md
    summary_md = (
        tmp_path / "analysis" / run_id / "summary.md"
    ).read_text(encoding="utf-8")
    assert "## 한눈에 보기" in summary_md
    assert "JSONL 이벤트" not in summary_md
    assert "총 관계 가중치" not in summary_md
    assert "## 관계별 핵심 interaction" not in summary_md
    assert "## 어떤 action이 준비됐고 무엇이 채택됐나" in summary_md
    assert "## 누가 직접·간접으로 퍼졌나" in summary_md
    assert "## 연결이 어떻게 늘어났나" in summary_md
    assert "## 어디를 더 보면 되는가" in summary_md
    assert "실제 연결에 들어온 행위자는" in summary_md
    assert "발신:" in summary_md
    assert "수신:" in summary_md
    assert "비공개 확인" in summary_md
    actions_csv = (
        tmp_path / "analysis" / run_id / "actions" / "summary.csv"
    ).read_text(encoding="utf-8")
    assert "행동 이름" in actions_csv
    assert "unused_action" in actions_csv
    growth_csv = (
        tmp_path / "analysis" / run_id / "network" / "growth.csv"
    ).read_text(encoding="utf-8")
    assert "라운드" in growth_csv
    assert "행위자 쏠림 HHI" in growth_csv
    assert "직접 연결 중심 ID" in growth_csv
    assert "간접 영향 중심 ID" in growth_csv


def test_run_analysis_accepts_run_dir_path(tmp_path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    output_dir = tmp_path / "output"
    run_id = "run-1"
    run_dir = output_dir / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    log_path = run_dir / "simulation.log.jsonl"
    log_path.write_text(_sample_log_text(run_id=run_id), encoding="utf-8")
    monkeypatch.setattr(
        plotting_network,
        "_compute_layout_positions",
        lambda graph: {
            node: (float(index), float(index))
            for index, node in enumerate(graph.nodes(), start=1)
        },
    )

    outcome = analysis_runner.run_analysis(run_dir=str(run_dir))

    assert outcome.run_id == run_id
    assert outcome.input_path == log_path
    assert outcome.output_dir == Path("analysis") / run_id


def test_install_deps_script_exists() -> None:
    script_path = Path("scripts/install_deps_ubuntu.sh")

    assert script_path.exists()
    script_text = script_path.read_text(encoding="utf-8")
    assert "fonts-noto-cjk" in script_text
    assert "ffmpeg" in script_text


def _load_sample_data():
    temp_dir = Path(tempfile.mkdtemp(prefix="analysis-loader-"))
    log_path = temp_dir / "simulation.log.jsonl"
    log_path.write_text(_sample_log_text(run_id="run-1"), encoding="utf-8")
    return load_run_analysis(log_path, expected_run_id="run-1")


def _sample_log_text(*, run_id: str) -> str:
    entries = [
        {
            "index": 1,
            "event": "simulation_started",
            "event_key": "simulation_started",
            "run_id": run_id,
            "scenario": "scenario",
            "max_rounds": 2,
            "rng_seed": 1234,
        },
        {
            "index": 2,
            "event": "actors_finalized",
            "event_key": "actors_finalized",
            "run_id": run_id,
            "actors": [
                {"cast_id": "alpha", "display_name": "Alpha"},
                {"cast_id": "beta", "display_name": "Beta"},
                {"cast_id": "gamma", "display_name": "Gamma"},
            ],
        },
        {
            "index": 3,
            "event": "plan_finalized",
            "event_key": "plan_finalized",
            "run_id": run_id,
            "plan": {
                "progression_plan": {"max_rounds": 3},
                "action_catalog": {
                    "actions": [
                        {
                            "action_type": "private_check_in",
                            "label": "비공개 확인",
                            "description": "상대의 반응을 제한 채널에서 확인한다.",
                            "supported_visibility": ["private"],
                            "requires_target": True,
                            "supports_utterance": True,
                        },
                        {
                            "action_type": "public_signal",
                            "label": "공개 신호",
                            "description": "직접 지목하지 않고 공개적으로 신호를 보낸다.",
                            "supported_visibility": ["public"],
                            "requires_target": False,
                            "supports_utterance": True,
                        },
                        {
                            "action_type": "unused_action",
                            "label": "미채택 행동",
                            "description": "후보에는 있었지만 채택되지 않는다.",
                            "supported_visibility": ["group"],
                            "requires_target": True,
                            "supports_utterance": False,
                        },
                    ]
                },
            },
        },
        {
            "index": 4,
            "event": "llm_call",
            "event_key": "llm_call:1",
            "run_id": run_id,
            "sequence": 1,
            "role": "planner",
            "call_kind": "structured",
            "log_context": {
                "scope": "planning-analysis",
                "phase": "planning",
                "task_key": "planning_analysis",
                "task_label": "계획 분석",
                "artifact_key": "planning_analysis",
                "artifact_label": "planning_analysis",
                "schema_name": "PlanningAnalysis",
            },
            "prompt": "planner prompt",
            "raw_response": "{\"brief_summary\":\"ok\"}",
            "duration_seconds": 0.3,
            "ttft_seconds": 0.1,
            "input_tokens": 10,
            "output_tokens": None,
            "total_tokens": 10,
        },
        {
            "index": 5,
            "event": "llm_call",
            "event_key": "llm_call:2",
            "run_id": run_id,
            "sequence": 2,
            "role": "actor",
            "call_kind": "structured",
            "log_context": {
                "scope": "actor-turn",
                "phase": "runtime",
                "task_key": "actor_action_proposal",
                "task_label": "행동 제안",
                "artifact_key": "pending_actor_proposals",
                "artifact_label": "pending_actor_proposals",
                "schema_name": "ActorActionProposal",
                "cast_id": "alpha",
            },
            "prompt": "actor prompt",
            "raw_response": "{\"action_type\":\"talk\"}",
            "duration_seconds": 0.4,
            "ttft_seconds": 0.2,
            "input_tokens": 10,
            "output_tokens": 5,
            "total_tokens": 15,
        },
        {
            "index": 6,
            "event": "llm_call",
            "event_key": "llm_call:3",
            "run_id": run_id,
            "sequence": 3,
            "role": "fixer",
            "call_kind": "text",
            "log_context": {
                "scope": "json-fix",
                "phase": "repair",
                "task_key": "json_repair.actor.actor_action_proposal",
                "task_label": "JSON 복구 (actor · 행동 제안)",
                "artifact_key": "repaired_json",
                "artifact_label": "repaired_json",
                "target_role": "actor",
                "target_task_key": "actor_action_proposal",
                "target_artifact_key": "pending_actor_proposals",
                "target_schema_name": "ActorActionProposal",
                "attempt": 1,
            },
            "prompt": "Target schema: ActorActionProposal\nFields:\n- x",
            "raw_response": "{\"fixed\":1}",
            "duration_seconds": 0.25,
            "ttft_seconds": 0.08,
            "input_tokens": 10,
            "output_tokens": 3,
            "total_tokens": 13,
        },
        {
            "index": 7,
            "event": "llm_call",
            "event_key": "llm_call:4",
            "run_id": run_id,
            "sequence": 4,
            "role": "fixer",
            "call_kind": "text",
            "log_context": {
                "scope": "json-fix",
                "phase": "repair",
                "task_key": "json_repair.actor.actor_action_proposal",
                "task_label": "JSON 복구 (actor · 행동 제안)",
                "artifact_key": "repaired_json",
                "artifact_label": "repaired_json",
                "target_role": "actor",
                "target_task_key": "actor_action_proposal",
                "target_artifact_key": "pending_actor_proposals",
                "target_schema_name": "ActorActionProposal",
                "attempt": 2,
            },
            "prompt": "Target schema: ActorActionProposal\nFields:\n- x",
            "raw_response": "{\"fixed\":2}",
            "duration_seconds": 0.35,
            "ttft_seconds": 0.09,
            "input_tokens": 10,
            "output_tokens": 4,
            "total_tokens": 14,
        },
        {
            "index": 8,
            "event": "llm_call",
            "event_key": "llm_call:5",
            "run_id": run_id,
            "sequence": 5,
            "role": "fixer",
            "call_kind": "text",
            "log_context": {
                "scope": "json-fix",
                "phase": "repair",
                "task_key": "json_repair.observer.timeline_anchor",
                "task_label": "JSON 복구 (observer · 타임라인 anchor 결정)",
                "artifact_key": "repaired_json",
                "artifact_label": "repaired_json",
                "target_role": "observer",
                "target_task_key": "timeline_anchor",
                "target_artifact_key": "report_timeline_anchor_json",
                "target_schema_name": "TimelineAnchorDecision",
                "attempt": 1,
            },
            "prompt": "Target schema: TimelineAnchorDecision\nFields:\n- x",
            "raw_response": "{\"fixed\":3}",
            "duration_seconds": 0.45,
            "ttft_seconds": 0.11,
            "input_tokens": 10,
            "output_tokens": 6,
            "total_tokens": 16,
        },
        {
            "index": 9,
            "event": "round_actions_adopted",
            "event_key": "round_actions_adopted:1",
            "run_id": run_id,
            "round_index": 1,
            "activities": [
                {
                    "round_index": 1,
                    "source_cast_id": "alpha",
                    "target_cast_ids": ["beta"],
                    "intent_target_cast_ids": ["beta", "gamma"],
                    "action_type": "private_check_in",
                    "intent": "Beta의 반응을 비공개로 확인한다.",
                    "action_summary": "Alpha가 Beta에게 비공개로 확인을 요청한다.",
                    "action_detail": "지금 감정선을 비공개로 먼저 확인하려고 한다.",
                    "utterance": "지금 잠깐 따로 이야기할래?",
                    "visibility": "private",
                    "thread_id": "pair-thread",
                },
                {
                    "round_index": 1,
                    "source_cast_id": "beta",
                    "target_cast_ids": [],
                    "intent_target_cast_ids": ["alpha"],
                    "action_type": "public_signal",
                    "intent": "Alpha를 공개적으로 의식한다.",
                    "action_summary": "Beta가 Alpha를 공개적으로 의식한다.",
                    "action_detail": "직접 지목하진 않지만 시선을 보내며 반응을 탐색한다.",
                    "utterance": "오늘 분위기가 좀 다르네요.",
                    "visibility": "public",
                    "thread_id": "",
                },
            ],
        },
    ]
    return "".join(json.dumps(item, ensure_ascii=False) + "\n" for item in entries)


def _build_settings(*, output_dir: Path) -> AppSettings:
    model = ModelConfig(provider="ollama", model="dummy")
    return AppSettings(
        storage=StorageConfig(
            output_dir=str(output_dir),
            sqlite_path=str(output_dir / "runtime.sqlite"),
        ),
        models=ModelRouterConfig(
            planner=model,
            generator=model,
            coordinator=model,
            actor=model,
            observer=model,
            fixer=model,
        ),
    )


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
            intent_target_cast_ids=[target_cast_id],
            visibility="private",
            thread_id=f"thread-{index}",
        )
        for index, (source_cast_id, target_cast_id) in enumerate(edges, start=1)
    ]
