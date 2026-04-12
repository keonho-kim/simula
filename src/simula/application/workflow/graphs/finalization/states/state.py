"""목적:
- finalization 서브그래프의 상태 조각 타입을 정의한다.

설명:
- 최종 리포트 채널을 명시한다.

사용한 설계 패턴:
- 상태 조각 타입 패턴
"""

from __future__ import annotations

from typing import Any, TypedDict


class FinalizationStateFragment(TypedDict, total=False):
    """finalization 서브그래프 상태 조각이다."""

    final_report: dict[str, Any] | None
    simulation_log_jsonl: str | None
    report_projection_json: str | None
    report_timeline_anchor_json: dict[str, Any] | None
    report_timeline_section: str | None
    report_actor_dynamics_section: str | None
    report_major_events_section: str | None
    report_body_sections: list[dict[str, str]]
    report_body_sections_markdown: str | None
    report_actor_final_results_section: str | None
    report_simulation_conclusion_section: str | None
    final_report_markdown: str | None
