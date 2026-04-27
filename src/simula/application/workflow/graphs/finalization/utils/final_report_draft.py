"""Final report draft validation and deterministic timeline rendering."""

from __future__ import annotations

from datetime import datetime
from typing import Any, cast

from simula.application.workflow.graphs.finalization.utils.sections import (
    validate_actor_dynamics_section,
    validate_bullet_section,
    validate_conclusion_section,
)
from simula.domain.contracts import FinalReportDraft


def validate_final_report_draft(draft: FinalReportDraft) -> list[str]:
    """Return shape issues for the single final report draft."""

    issues: list[str] = []
    validators = (
        validate_conclusion_section(draft.conclusion_section),
        validate_actor_dynamics_section(draft.actor_dynamics_section),
        validate_bullet_section(draft.major_events_section, min_items=1, max_items=5),
    )
    for issue in validators:
        if issue is not None:
            issues.append(issue)
    return issues


def render_timeline_section(
    *,
    report_projection: dict[str, Any],
    final_report: dict[str, object],
) -> str:
    """Render the final timeline from structured projection data."""

    highlights = _dict_list(report_projection.get("timeline_highlights"))
    if not highlights:
        return _fallback_timeline_line(
            report_projection=report_projection,
            final_report=final_report,
        )

    lines: list[str] = []
    fallback_time_label = _timeline_anchor_label(report_projection)
    for item in highlights:
        time_label = _clean_cell(item.get("time_label")) or fallback_time_label
        phase_hint = _clean_cell(item.get("phase_hint")) or "정리"
        core_event = _first_text(
            _string_list(item.get("notable_events")),
            _string_list(item.get("action_highlights")),
            [
                item.get("focus_summary"),
                item.get("observer_summary"),
            ],
        )
        impact = _first_text(
            [item.get("observer_summary")],
            _string_list(item.get("action_highlights")),
            [
                final_report.get("world_state_summary"),
            ],
        )
        lines.append(
            f"- {time_label} | {phase_hint} | "
            f"{_clean_cell(core_event) or '주요 변화가 기록됐다.'} | "
            f"{_clean_cell(impact) or '상태 변화가 최종 보고서에 반영됐다.'}"
        )
    return "\n".join(lines)


def _fallback_timeline_line(
    *,
    report_projection: dict[str, Any],
    final_report: dict[str, object],
) -> str:
    time_label = _timeline_anchor_label(report_projection)
    event = _clean_cell(final_report.get("last_observer_summary")) or "시뮬레이션이 종료됐다."
    impact = _clean_cell(final_report.get("world_state_summary")) or "최종 상태가 정리됐다."
    return f"- {time_label} | 정리 | {event} | {impact}"


def _timeline_anchor_label(report_projection: dict[str, Any]) -> str:
    summary_context = _dict_value(report_projection.get("summary_context"))
    timeline_anchor = _dict_value(summary_context.get("timeline_anchor"))
    anchor_iso = str(timeline_anchor.get("anchor_iso", "")).strip()
    if anchor_iso:
        try:
            return datetime.fromisoformat(anchor_iso).strftime("%Y-%m-%d %H:%M")
        except ValueError:
            pass
    return "2000-01-01 09:00"


def _first_text(*groups: list[object]) -> str:
    for group in groups:
        for item in group:
            text = str(item or "").strip()
            if text:
                return text
    return ""


def _clean_cell(value: object) -> str:
    return " ".join(str(value or "").replace("|", "/").split())


def _dict_list(value: object) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [cast(dict[str, Any], item) for item in value if isinstance(item, dict)]


def _dict_value(value: object) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    return cast(dict[str, Any], value)


def _string_list(value: object) -> list[object]:
    if not isinstance(value, list):
        return []
    return list(value)
