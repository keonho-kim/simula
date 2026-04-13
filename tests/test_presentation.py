"""목적:
- 실행 결과 출력 파일이 기대 형식으로 저장되는지 검증한다.

설명:
- simulation.log.jsonl 과 final_report.md 생성 규칙을 확인한다.

사용한 설계 패턴:
- presenter 단위 테스트 패턴

연관된 다른 모듈/구조:
- simula.application.services.presentation
"""

from __future__ import annotations

from simula.application.services.presentation import print_final_report
from simula.application.services.presentation import write_single_run_outputs


def test_write_single_run_outputs_writes_jsonl_and_markdown(tmp_path) -> None:
    saved = write_single_run_outputs(
        output_dir=str(tmp_path),
        run_id="run-1",
        final_state={
            "simulation_log_jsonl": (
                '{"index":1,"event":"simulation_started","run_id":"run-1"}\n'
                '{"index":2,"event":"final_report","run_id":"run-1"}'
            ),
            "final_report_markdown": "# 시뮬레이션 결과\n\n## 시뮬레이션 결론\n\n- 테스트 실행 결과다.",
        },
    )

    assert saved.simulation_log_path.exists()
    assert saved.final_report_path.exists()
    assert '"event":"simulation_started"' in saved.simulation_log_path.read_text(
        encoding="utf-8"
    )
    assert '"event":"final_report"' in saved.simulation_log_path.read_text(
        encoding="utf-8"
    )
    assert "# 시뮬레이션 결과" in saved.final_report_path.read_text(encoding="utf-8")


def test_write_single_run_outputs_requires_prebuilt_simulation_log(tmp_path) -> None:
    try:
        write_single_run_outputs(
            output_dir=str(tmp_path),
            run_id="run-1",
            final_state={"final_report_markdown": "# Report"},
        )
    except ValueError as exc:
        assert str(exc) == "simulation_log_jsonl is empty."
    else:
        raise AssertionError("expected write_single_run_outputs to reject empty JSONL")


def test_print_final_report_prefers_markdown(capsys) -> None:
    print_final_report(
        {
            "run_id": "run-1",
            "elapsed_simulation_label": "30분",
            "steps_completed": 1,
            "actor_count": 1,
            "total_activities": 1,
            "last_observer_summary": "첫 반응",
        },
        "# 시뮬레이션 결과\n\n## 시뮬레이션 결론\n\n- 테스트 보고서 본문",
    )

    captured = capsys.readouterr()
    assert "=== simula 최종 요약 ===" in captured.out
    assert "# 시뮬레이션 결과" in captured.out
    assert '"run_id"' not in captured.out
