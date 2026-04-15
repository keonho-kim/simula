"""Purpose:
- Render one high-level analysis summary for non-specialist readers.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Sequence

from simula.application.analysis.models import (
    DistributionReport,
    FixerReport,
    InteractionDigestRecord,
    LoadedRunAnalysis,
    NetworkReport,
    TokenUsageReport,
)
from simula.application.analysis.localization import role_label


def render_analysis_summary_markdown(
    *,
    run_id: str,
    loaded: LoadedRunAnalysis,
    distribution_report: DistributionReport,
    token_usage_report: TokenUsageReport,
    fixer_report: FixerReport,
    network_report: NetworkReport,
    interactions: Sequence[InteractionDigestRecord],
) -> str:
    """Render one human-friendly summary page for analysis outputs."""

    lines = [f"# {run_id} 분석 요약", ""]
    lines.extend(["## 한눈에 보기", *_overview_lines(loaded, network_report)])
    lines.extend(["", "## 무슨 일이 있었나", *_what_happened_lines(loaded)])
    lines.extend(["", "## 누가 중심이었나", *_central_actor_lines(network_report)])
    lines.extend(
        [
            "",
            "## 관계별 핵심 interaction",
            *_interaction_lines(interactions),
        ]
    )
    lines.extend(
        [
            "",
            "## LLM 사용량",
            *_llm_usage_lines(
                token_usage_report=token_usage_report,
                distribution_report=distribution_report,
            ),
        ]
    )
    lines.extend(["", "## JSON 복구 현황", *_fixer_lines(fixer_report)])
    lines.extend(["", "## 어디를 더 보면 되는가", *_where_to_look_lines()])
    return "\n".join(lines).rstrip() + "\n"


def _overview_lines(
    loaded: LoadedRunAnalysis,
    network_report: NetworkReport,
) -> list[str]:
    rounds_completed = max(
        (item.round_index for item in loaded.adopted_activities),
        default=0,
    )
    return [
        f"- JSONL 이벤트 {loaded.event_count}건, LLM 호출 {len(loaded.llm_calls)}건을 기준으로 분석했습니다.",
        f"- 채택된 액션은 {len(loaded.adopted_activities)}건이며, 실제 관계망에는 {network_report.summary.participating_actor_count}명이 등장했습니다.",
        f"- 분석상 확인된 진행 라운드는 {rounds_completed}라운드입니다.",
    ]


def _what_happened_lines(loaded: LoadedRunAnalysis) -> list[str]:
    if not loaded.adopted_activities:
        return ["- 채택된 액션이 없어 흐름 요약을 만들 수 없습니다."]

    visibility_counts = Counter(item.visibility for item in loaded.adopted_activities if item.visibility)
    action_type_counts = Counter(item.action_type for item in loaded.adopted_activities if item.action_type)
    most_common_action_type, most_common_action_count = action_type_counts.most_common(1)[0]
    latest_summaries = [
        item.action_summary
        for item in loaded.adopted_activities[-3:]
        if item.action_summary
    ]
    lines = [
        "- "
        f"가장 자주 채택된 행동은 `{most_common_action_type}` "
        f"({most_common_action_count}건)였습니다.",
        "- "
        + "노출 방식 분포는 "
        + ", ".join(
            f"{visibility} {count}건"
            for visibility, count in sorted(visibility_counts.items())
        )
        + "입니다.",
    ]
    for summary in latest_summaries:
        lines.append(f"- 최근 흐름: {summary}")
    return lines


def _central_actor_lines(report: NetworkReport) -> list[str]:
    if not report.nodes:
        return ["- 중심 행위자를 계산할 수 없었습니다."]

    lines: list[str] = []
    for node in report.nodes[:3]:
        lines.append(
            "- "
            f"{node.display_name}(`{node.cast_id}`)는 총 관계 가중치 {node.total_weight}, "
            f"상대 {node.counterpart_count}명으로 가장 많이 얽힌 축에 가깝습니다."
        )
    return lines


def _interaction_lines(
    interactions: Sequence[InteractionDigestRecord],
) -> list[str]:
    if not interactions:
        return ["- 대표 상호작용을 뽑을 만한 관계 기록이 없습니다."]

    lines: list[str] = []
    for item in interactions[:5]:
        participants = " ↔ ".join(item.participant_display_names[:3])
        if len(item.participant_display_names) > 3:
            participants += f" 외 {len(item.participant_display_names) - 3}명"
        representative = item.representative_interaction or "대표 상호작용 없음"
        message = item.latest_message or item.representative_message or "대표 메시지 없음"
        lines.append(
            "- "
            f"{participants}: {item.activity_count}건, "
            f"대표 상호작용은 \"{representative}\", "
            f"최근 메시지는 \"{message}\"였습니다."
        )
    return lines


def _llm_usage_lines(
    *,
    token_usage_report: TokenUsageReport,
    distribution_report: DistributionReport,
) -> list[str]:
    overall = token_usage_report.overall
    duration = distribution_report.overall["duration_seconds"]
    ttft = distribution_report.overall["ttft_seconds"]
    top_roles = sorted(
        token_usage_report.by_role.values(),
        key=lambda item: (-item.total_tokens_total, item.role),
    )[:3]
    lines = [
        "- "
        f"총 {overall.call_count}회 호출에서 전체 {overall.total_tokens_total}토큰이 사용됐습니다.",
        "- "
        f"대표 응답 속도는 TTFT p95 { _format_optional(ttft.p95_value, suffix='초') }, "
        f"전체 소요 시간 p95 { _format_optional(duration.p95_value, suffix='초') }입니다.",
    ]
    for summary in top_roles:
        lines.append(
            "- "
            f"{role_label(summary.role)}: {summary.call_count}회 호출, "
            f"총 {summary.total_tokens_total}토큰"
        )
    return lines


def _fixer_lines(fixer_report: FixerReport) -> list[str]:
    overall = fixer_report.overall
    if overall.fixer_call_count == 0:
        return ["- JSON 복구 호출은 없었습니다."]

    lines = [
        "- "
        f"JSON 복구 호출은 총 {overall.fixer_call_count}회, 세션 기준 {overall.session_count}건이었습니다.",
        "- "
        f"재시도는 총 {overall.retry_count}회였습니다.",
    ]
    affected_roles = [
        summary
        for summary in fixer_report.by_role.values()
        if summary.fixer_call_count > 0
    ]
    for summary in sorted(
        affected_roles,
        key=lambda item: (-item.fixer_call_count, item.role),
    ):
        lines.append(
            "- "
            f"{role_label(summary.role)}: fixer {summary.fixer_call_count}회, "
            f"재시도 {summary.retry_count}회"
        )
    return lines


def _where_to_look_lines() -> list[str]:
    return [
        "- `network/interactions.csv`: 관계·스레드별 대표 상호작용과 대표 메시지를 더 자세히 볼 때",
        "- `network/summary.md`: 관계망 수치와 구조 해설을 깊게 볼 때",
        "- `token_usage/summary.md`: 역할별 토큰 사용량을 확인할 때",
        "- `llm_calls.csv`: 개별 호출과 원문 응답을 직접 추적할 때",
    ]


def _format_optional(value: float | None, *, suffix: str) -> str:
    if value is None:
        return "-"
    return f"{value:.2f}{suffix}"
