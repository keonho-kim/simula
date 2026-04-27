"""Purpose:
- Verify integrated run output writing and analysis artifact generation.
"""

from __future__ import annotations

import json
import math
from datetime import datetime
from pathlib import Path

import pytest
import simula.application.analysis.plotting.network as plotting_network
import simula.application.analysis.runner.writing as runner_writing

from simula.application.services.output_writer import write_run_outputs
from tests.helpers import build_analysis_settings, sample_analysis_log_text


def test_write_run_outputs_writes_expected_artifacts(tmp_path, monkeypatch) -> None:
    output_dir = tmp_path / "output"
    run_id = "20260418.001.qwen3-8b.demo-01"
    run_dir = output_dir / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "simulation.log.jsonl").write_text(
        sample_analysis_log_text(run_id=run_id),
        encoding="utf-8",
    )
    settings = build_analysis_settings(output_dir=output_dir)
    monkeypatch.setattr(
        runner_writing,
        "compute_render_layout",
        lambda graph: plotting_network.RenderLayout(
            positions={
                node: (float(index), float(index))
                for index, node in enumerate(graph.nodes(), start=1)
            },
            x_limits=(-1.0, 1.0),
            y_limits=(-1.0, 1.0),
        ),
    )

    paths = write_run_outputs(
        settings=settings,
        run_id=run_id,
        scenario_file_path="/tmp/Demo 01.md",
        scenario_file_stem="demo-01",
        run_model_id="qwen3-8b",
        started_at=datetime(2026, 4, 18, 10, 0, 0),
        ended_at=datetime(2026, 4, 18, 10, 5, 0),
        wall_clock_seconds=300.0,
        status="completed",
        error=None,
        final_state={"final_report_markdown": "# Final report"},
    )

    assert paths.report_path == run_dir / "report.final.md"
    assert (run_dir / "manifest.json").exists()
    assert (run_dir / "summary.overview.md").exists()
    assert (run_dir / "summaries" / "token_usage.summary.md").exists()
    assert (run_dir / "summaries" / "network.summary.md").exists()
    assert (run_dir / "data" / "llm_calls.csv").exists()
    assert (run_dir / "data" / "performance.summary.csv").exists()
    assert (run_dir / "data" / "network.summary.json").exists()
    assert (run_dir / "data" / "network.growth.csv").exists()
    assert (run_dir / "assets" / "performance.summary.png").exists()
    assert (run_dir / "assets" / "network.growth.mp4").exists()
    assert (run_dir / "assets" / "network.graph.graphml").exists()

    manifest = json.loads((run_dir / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["run_id"] == run_id
    assert manifest["status"] == "completed"
    assert manifest["scenario_file"] == "/tmp/Demo 01.md"
    assert manifest["scenario_file_stem"] == "demo-01"
    assert manifest["run_model_id"] == "qwen3-8b"
    assert manifest["analysis"]["llm_call_count"] == 5
    assert "summary.overview.md" in manifest["artifact_paths"]
    assert "data/network.summary.json" in manifest["artifact_paths"]
    assert "assets/network.growth.mp4" in manifest["artifact_paths"]

    llm_calls_csv = (run_dir / "data" / "llm_calls.csv").read_text(encoding="utf-8")
    assert "태스크 키" in llm_calls_csv
    assert "결과물 키" in llm_calls_csv
    assert "구조화 모드" in llm_calls_csv
    assert "프롬프트 변형" in llm_calls_csv

    network_summary_json = json.loads(
        (run_dir / "data" / "network.summary.json").read_text(encoding="utf-8")
    )
    assert network_summary_json["summary"]["edge_count"] == 3
    assert network_summary_json["benchmark_metrics"][
        "action_type_diversity"
    ] == pytest.approx(math.log(2) / math.log(3))

    network_summary_md = (
        run_dir / "summaries" / "network.summary.md"
    ).read_text(encoding="utf-8")
    assert "## 벤치마크 지표" in network_summary_md
    assert "비공개 확인" in network_summary_md

    summary_md = (run_dir / "summary.overview.md").read_text(encoding="utf-8")
    assert "## 한눈에 보기" in summary_md
    assert "## 연결이 어떻게 늘어났나" in summary_md

    growth_csv = (run_dir / "data" / "network.growth.csv").read_text(encoding="utf-8")
    assert "평균 경로 깊이" in growth_csv
    assert "엣지 성장률" in growth_csv
    assert "상위 20% 행위자 점유율" in growth_csv


def test_write_run_outputs_writes_failure_manifest(tmp_path) -> None:
    output_dir = tmp_path / "output"
    run_id = "20260418.001.qwen3-8b.demo-01"
    run_dir = output_dir / run_id
    run_dir.mkdir(parents=True, exist_ok=True)
    (run_dir / "simulation.log.jsonl").write_text("{}", encoding="utf-8")
    settings = build_analysis_settings(output_dir=output_dir)

    paths = write_run_outputs(
        settings=settings,
        run_id=run_id,
        scenario_file_path="/tmp/Demo 01.md",
        scenario_file_stem="demo-01",
        run_model_id="qwen3-8b",
        started_at=datetime(2026, 4, 18, 10, 0, 0),
        ended_at=datetime(2026, 4, 18, 10, 1, 0),
        wall_clock_seconds=60.0,
        status="failed",
        error="boom",
        final_state=None,
    )

    assert paths.report_path is None
    manifest = json.loads((run_dir / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["status"] == "failed"
    assert manifest["error"] == "boom"
    assert "analysis" not in manifest
    assert manifest["artifact_paths"] == ["manifest.json", "simulation.log.jsonl"]


def test_install_deps_script_exists() -> None:
    script_path = Path("scripts/install_deps_ubuntu.sh")

    assert script_path.exists()
    script_text = script_path.read_text(encoding="utf-8")
    assert "fonts-noto-cjk" in script_text
    assert "ffmpeg" in script_text
