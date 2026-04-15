"""Purpose:
- Render one high-level analysis summary for non-specialist readers.
"""

from __future__ import annotations

from collections import Counter

from simula.application.analysis.models import (
    ActionCatalogReport,
    DistributionReport,
    FixerReport,
    LoadedRunAnalysis,
    NetworkGrowthReport,
    NetworkReport,
    TokenUsageReport,
)
from simula.application.analysis.localization import role_label
from simula.application.analysis.network_narrative import (
    action_label_map,
    build_actor_connection_lines,
    build_growth_leader_shift_lines,
    build_leader_lines,
)


def render_analysis_summary_markdown(
    *,
    run_id: str,
    loaded: LoadedRunAnalysis,
    distribution_report: DistributionReport,
    token_usage_report: TokenUsageReport,
    fixer_report: FixerReport,
    network_report: NetworkReport,
    action_report: ActionCatalogReport,
    growth_report: NetworkGrowthReport,
) -> str:
    """Render one human-friendly summary page for analysis outputs."""

    label_by_action_type = action_label_map(loaded.planned_actions)
    lines = [f"# {run_id} 분석 요약", ""]
    lines.extend(["## 한눈에 보기", *_overview_lines(loaded, network_report)])
    lines.extend(["", "## 무슨 일이 있었나", *_what_happened_lines(loaded, label_by_action_type)])
    lines.extend(
        [
            "",
            "## 누가 중심에 있었나",
            *build_actor_connection_lines(
                nodes=network_report.nodes,
                label_by_action_type=label_by_action_type,
                limit=3,
            ),
        ]
    )
    lines.extend(
        [
            "",
            "## 누가 직접·간접으로 퍼졌나",
            *build_leader_lines(network_report),
        ]
    )
    lines.extend(
        [
            "",
            "## 어떤 action이 준비됐고 무엇이 채택됐나",
            *_action_lines(action_report),
        ]
    )
    lines.extend(
        [
            "",
            "## 연결이 어떻게 늘어났나",
            *build_growth_leader_shift_lines(growth_report),
            *_growth_lines(growth_report),
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
        f"- LLM 호출 {len(loaded.llm_calls)}건을 기준으로 분석했습니다.",
        f"- 채택된 액션은 {len(loaded.adopted_activities)}건이며, 실제 연결에 들어온 행위자는 {network_report.summary.participating_actor_count}명이었습니다.",
        f"- 분석상 확인된 진행 라운드는 {rounds_completed}라운드입니다.",
    ]


def _what_happened_lines(
    loaded: LoadedRunAnalysis,
    label_by_action_type: dict[str, str],
) -> list[str]:
    if not loaded.adopted_activities:
        return ["- 채택된 액션이 없어 흐름 요약을 만들 수 없습니다."]

    visibility_counts = Counter(
        item.visibility for item in loaded.adopted_activities if item.visibility
    )
    action_type_counts = Counter(
        item.action_type for item in loaded.adopted_activities if item.action_type
    )
    most_common_action_type, most_common_action_count = action_type_counts.most_common(1)[0]
    latest_summaries = [
        item.action_summary
        for item in loaded.adopted_activities[-3:]
        if item.action_summary
    ]
    lines = [
        "- "
        f"가장 자주 채택된 행동은 "
        f"{label_by_action_type.get(most_common_action_type, most_common_action_type)} "
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


def _action_lines(action_report: ActionCatalogReport) -> list[str]:
    if action_report.empty_reason:
        return [f"- {action_report.empty_reason}"]

    lines: list[str] = []
    for item in action_report.rows:
        if item.adopted_count > 0:
            lines.append(
                "- "
                f"{item.label}(`{item.action_type}`): 채택 {item.adopted_count}건, "
                f"라운드 {item.first_adopted_round}-{item.last_adopted_round}"
            )
        else:
            lines.append(
                "- "
                f"{item.label}(`{item.action_type}`): 후보에는 있었지만 채택되지는 않았습니다."
            )
    return lines


def _growth_lines(growth_report: NetworkGrowthReport) -> list[str]:
    if growth_report.empty_reason:
        return [f"- {growth_report.empty_reason}"]
    if not growth_report.rows:
        return ["- 연결이 어떻게 늘었는지 계산할 수 없었습니다."]

    final_row = growth_report.final_row
    assert final_row is not None
    largest_new_edge = max(
        growth_report.rows,
        key=lambda item: (item.new_edge_count, item.new_actor_count, -item.round_index),
    )
    most_concentrated = max(
        growth_report.rows,
        key=lambda item: (
            _sort_value(item.top1_actor_share),
            _sort_value(item.actor_weight_hhi),
            -item.round_index,
        ),
    )

    return [
        "- "
        f"최종 라운드에는 참여 행위자 {final_row.participating_actor_count}명, 연결 {final_row.edge_count}개까지 커졌습니다.",
        "- "
        f"가장 크게 확장된 시점은 {largest_new_edge.round_index}라운드로, "
        f"새 행위자 {largest_new_edge.new_actor_count}명과 새 연결 {largest_new_edge.new_edge_count}개가 더해졌습니다.",
        "- "
        f"쏠림이 가장 강했던 시점은 {most_concentrated.round_index}라운드로, "
        f"상위 1명이 전체 연결의 {_format_percent(most_concentrated.top1_actor_share)}를 차지했습니다.",
    ]


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
        "- `actions/summary.csv`: 후보 action과 실제 채택 횟수를 비교할 때",
        "- `performance/summary.png`: 전체 호출 성능 분포를 한눈에 볼 때",
        "- `performance/summary.csv`: input/output 토큰 크기 조합별 TTFT·소요 시간 p90/p95/p99를 볼 때",
        "- `network/growth.csv`: 라운드별 연결 변화 수치를 직접 확인할 때",
        "- `network/growth_metrics.png`: 연결이 늘어나는 흐름을 빠르게 볼 때",
        "- `network/concentration.png`: 연결이 어느 쪽에 몰렸는지 볼 때",
        "- `network/growth.mp4`: 연결이 늘어나는 순서를 정지 가능한 영상으로 볼 때",
        "- `token_usage/summary.md`: 역할별 토큰 사용량을 확인할 때",
        "- `llm_calls.csv`: 개별 호출과 원문 응답을 직접 추적할 때",
    ]


def _format_optional(value: float | None, *, suffix: str) -> str:
    if value is None:
        return "-"
    return f"{value:.2f}{suffix}"


def _format_percent(value: float | None) -> str:
    if value is None:
        return "-"
    return f"{value * 100:.1f}%"


def _sort_value(value: float | None) -> float:
    if value is None:
        return -1.0
    return value
