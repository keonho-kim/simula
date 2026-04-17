"""Purpose:
- Verify analysis runner behavior and artifact writing.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import pytest
import simula.application.analysis.plotting.network as plotting_network

from simula.application.services import analysis_runner
from simula.infrastructure.config.loader import LoadedSettingsBundle
from tests.helpers import build_analysis_settings, sample_analysis_log_text


def test_run_analysis_rejects_empty_run_dir() -> None:
    with pytest.raises(ValueError, match="`--run-dir`는 비어 있으면 안 됩니다."):
        analysis_runner.run_analysis(run_dir="   ")


def test_run_analysis_writes_expected_artifacts(tmp_path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    output_dir = tmp_path / "output"
    run_id = "run-1"
    run_dir = output_dir / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "simulation.log.jsonl").write_text(
        sample_analysis_log_text(run_id=run_id),
        encoding="utf-8",
    )
    settings = build_analysis_settings(output_dir=output_dir)

    def _fake_load_settings_bundle(env_file=None, *, cli_overrides=None):  # noqa: ANN001
        del env_file, cli_overrides
        return LoadedSettingsBundle(settings=settings)

    monkeypatch.setattr(analysis_runner, "load_settings_bundle", _fake_load_settings_bundle)
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
    assert (tmp_path / "analysis" / run_id / "performance" / "summary.png").exists()
    assert (tmp_path / "analysis" / run_id / "network" / "summary.json").exists()
    assert (tmp_path / "analysis" / run_id / "network" / "growth.csv").exists()
    assert (tmp_path / "analysis" / run_id / "network" / "growth.mp4").exists()

    manifest = json.loads(
        (tmp_path / "analysis" / run_id / "manifest.json").read_text(encoding="utf-8")
    )
    assert manifest["run_id"] == run_id
    assert "summary.md" in manifest["artifact_paths"]
    assert "performance/summary.png" in manifest["artifact_paths"]
    assert "network/summary.json" in manifest["artifact_paths"]
    assert "network/growth.csv" in manifest["artifact_paths"]
    assert "network/growth.mp4" in manifest["artifact_paths"]

    llm_calls_csv = (
        tmp_path / "analysis" / run_id / "llm_calls.csv"
    ).read_text(encoding="utf-8")
    assert "태스크 키" in llm_calls_csv
    assert "결과물 키" in llm_calls_csv

    network_summary_json = json.loads(
        (tmp_path / "analysis" / run_id / "network" / "summary.json").read_text(
            encoding="utf-8"
        )
    )
    assert network_summary_json["summary"]["edge_count"] == 3
    assert "benchmark_metrics" in network_summary_json
    assert network_summary_json["benchmark_metrics"]["action_type_diversity"] == pytest.approx(
        math.log(2) / math.log(3)
    )

    network_summary_md = (
        tmp_path / "analysis" / run_id / "network" / "summary.md"
    ).read_text(encoding="utf-8")
    assert "## 벤치마크 지표" in network_summary_md
    assert "비공개 확인" in network_summary_md

    summary_md = (
        tmp_path / "analysis" / run_id / "summary.md"
    ).read_text(encoding="utf-8")
    assert "## 한눈에 보기" in summary_md
    assert "## 연결이 어떻게 늘어났나" in summary_md

    growth_csv = (
        tmp_path / "analysis" / run_id / "network" / "growth.csv"
    ).read_text(encoding="utf-8")
    assert "평균 경로 깊이" in growth_csv
    assert "엣지 성장률" in growth_csv
    assert "상위 20% 행위자 점유율" in growth_csv


def test_run_analysis_accepts_run_dir_path(tmp_path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    output_dir = tmp_path / "output"
    run_id = "run-1"
    run_dir = output_dir / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    log_path = run_dir / "simulation.log.jsonl"
    log_path.write_text(sample_analysis_log_text(run_id=run_id), encoding="utf-8")
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
