"""Purpose:
- Render deterministic Markdown summaries for token usage analysis.
"""

from __future__ import annotations

from simula.application.analysis.localization import role_label
from simula.application.analysis.models import TokenUsageReport, TokenUsageRoleSummary


def render_token_usage_summary_markdown(*, run_id: str, report: TokenUsageReport) -> str:
    """Render one Korean Markdown report for cumulative token usage."""

    lines = [f"# {run_id} 토큰 사용량 분석", ""]
    lines.extend(
        [
            "## 개요",
            _overview_line(report.overall),
            "",
            "## 역할별 누적 사용량",
        ]
    )

    for summary in [report.overall, *[report.by_role[role] for role in sorted(report.by_role)]]:
        lines.extend(_role_lines(summary))
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def _overview_line(summary: TokenUsageRoleSummary) -> str:
    return (
        f"- 총 {summary.call_count}회의 LLM 호출에서 입력 {summary.input_tokens_total}, "
        f"출력 {summary.output_tokens_total}, 전체 {summary.total_tokens_total} 토큰이 기록되었습니다."
    )


def _role_lines(summary: TokenUsageRoleSummary) -> list[str]:
    return [
        f"### {role_label(summary.role)}",
        f"- 호출 수: {summary.call_count}",
        f"- 입력 토큰 누적: {summary.input_tokens_total} (누락 {summary.input_tokens_missing_count}건)",
        f"- 출력 토큰 누적: {summary.output_tokens_total} (누락 {summary.output_tokens_missing_count}건)",
        f"- 전체 토큰 누적: {summary.total_tokens_total} (누락 {summary.total_tokens_missing_count}건)",
    ]
