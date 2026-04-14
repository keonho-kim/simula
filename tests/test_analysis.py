"""Purpose:
- Verify JSONL run analyzer loading, aggregation, and artifact writing.
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path

import pytest

from simula.application.analysis.loader import load_run_analysis
from simula.application.analysis.metrics.distributions import build_distribution_report
from simula.application.analysis.metrics.fixer import build_fixer_report
from simula.application.analysis.metrics.network import build_network_report
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

    with pytest.raises(ValueError, match="invalid JSONL"):
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

    with pytest.raises(ValueError, match="llm_call"):
        load_run_analysis(log_path, expected_run_id="run-1")


def test_distribution_report_tracks_missing_values_and_kde_skip() -> None:
    loaded = _load_sample_data()

    report = build_distribution_report(loaded.llm_calls)

    overall_input = report.overall["input_tokens"]
    planner_output = report.by_role["planner"]["output_tokens"]

    assert overall_input.record_count == 5
    assert overall_input.sample_count == 5
    assert overall_input.kde_skipped_reason == "KDE requires non-constant values."
    assert planner_output.record_count == 1
    assert planner_output.sample_count == 0
    assert planner_output.missing_count == 1


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


def test_network_report_counts_targets_and_intent_only_edges() -> None:
    loaded = _load_sample_data()

    report, _ = build_network_report(
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
    assert alpha_gamma.action_count == 0
    assert alpha_gamma.intent_only_count == 1
    assert beta_alpha.intent_only_count == 1
    assert beta_alpha.public_count == 1


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

    outcome = analysis_runner.run_analysis(run_id=run_id)

    assert outcome.run_id == run_id
    assert (tmp_path / "analysis" / run_id / "manifest.json").exists()
    assert (tmp_path / "analysis" / run_id / "llm_calls.csv").exists()
    assert (
        tmp_path / "analysis" / run_id / "distributions" / "overall" / "input_tokens.png"
    ).exists()
    assert (
        tmp_path / "analysis" / run_id / "distributions" / "roles" / "fixer" / "duration_seconds.json"
    ).exists()
    assert (tmp_path / "analysis" / run_id / "fixer" / "summary.csv").exists()
    assert (tmp_path / "analysis" / run_id / "network" / "nodes.csv").exists()
    assert (tmp_path / "analysis" / run_id / "network" / "edges.csv").exists()
    assert (tmp_path / "analysis" / run_id / "network" / "graph.graphml").exists()
    assert (tmp_path / "analysis" / run_id / "network" / "graph.png").exists()

    manifest = json.loads(
        (tmp_path / "analysis" / run_id / "manifest.json").read_text(encoding="utf-8")
    )
    assert manifest["run_id"] == run_id
    assert "llm_calls.csv" in manifest["artifact_paths"]
    assert manifest["network_summary"]["edge_count"] == 3


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
            "event": "llm_call",
            "event_key": "llm_call:1",
            "run_id": run_id,
            "sequence": 1,
            "role": "planner",
            "call_kind": "structured",
            "log_context": {"scope": "planning-analysis"},
            "prompt": "planner prompt",
            "raw_response": "{\"brief_summary\":\"ok\"}",
            "raw_chunks": ["{\"brief_summary\":\"ok\"}"],
            "duration_seconds": 0.3,
            "ttft_seconds": 0.1,
            "input_tokens": 10,
            "output_tokens": None,
            "total_tokens": 10,
        },
        {
            "index": 4,
            "event": "llm_call",
            "event_key": "llm_call:2",
            "run_id": run_id,
            "sequence": 2,
            "role": "actor",
            "call_kind": "structured",
            "log_context": {"scope": "actor-turn", "cast_id": "alpha"},
            "prompt": "actor prompt",
            "raw_response": "{\"action_type\":\"talk\"}",
            "raw_chunks": ["{\"action_type\":\"talk\"}"],
            "duration_seconds": 0.4,
            "ttft_seconds": 0.2,
            "input_tokens": 10,
            "output_tokens": 5,
            "total_tokens": 15,
        },
        {
            "index": 5,
            "event": "llm_call",
            "event_key": "llm_call:3",
            "run_id": run_id,
            "sequence": 3,
            "role": "fixer",
            "call_kind": "text",
            "log_context": {"scope": "json-fix", "attempt": 1},
            "prompt": "Target schema: ActorActionProposal\nFields:\n- x",
            "raw_response": "{\"fixed\":1}",
            "raw_chunks": ["{\"fixed\":1}"],
            "duration_seconds": 0.25,
            "ttft_seconds": 0.08,
            "input_tokens": 10,
            "output_tokens": 3,
            "total_tokens": 13,
        },
        {
            "index": 6,
            "event": "llm_call",
            "event_key": "llm_call:4",
            "run_id": run_id,
            "sequence": 4,
            "role": "fixer",
            "call_kind": "text",
            "log_context": {"scope": "json-fix", "attempt": 2},
            "prompt": "Target schema: ActorActionProposal\nFields:\n- x",
            "raw_response": "{\"fixed\":2}",
            "raw_chunks": ["{\"fixed\":2}"],
            "duration_seconds": 0.35,
            "ttft_seconds": 0.09,
            "input_tokens": 10,
            "output_tokens": 4,
            "total_tokens": 14,
        },
        {
            "index": 7,
            "event": "llm_call",
            "event_key": "llm_call:5",
            "run_id": run_id,
            "sequence": 5,
            "role": "fixer",
            "call_kind": "text",
            "log_context": {"scope": "json-fix", "attempt": 1},
            "prompt": "Target schema: FinalReportSections\nFields:\n- x",
            "raw_response": "{\"fixed\":3}",
            "raw_chunks": ["{\"fixed\":3}"],
            "duration_seconds": 0.45,
            "ttft_seconds": 0.11,
            "input_tokens": 10,
            "output_tokens": 6,
            "total_tokens": 16,
        },
        {
            "index": 8,
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
                    "visibility": "private",
                    "thread_id": "pair-thread",
                },
                {
                    "round_index": 1,
                    "source_cast_id": "beta",
                    "target_cast_ids": [],
                    "intent_target_cast_ids": ["alpha"],
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
