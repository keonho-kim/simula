"""Purpose:
- Render deterministic Markdown summaries for network complexity analysis.
"""

from __future__ import annotations

from simula.application.analysis.models import (
    ActorNodeMetrics,
    NetworkLeaderboardEntry,
    NetworkReport,
)


def render_network_summary_markdown(*, run_id: str, report: NetworkReport) -> str:
    """Render one Korean Markdown report for the analyzed network."""

    summary = report.summary
    lines = [f"# {run_id} 네트워크 복잡도 분석", ""]

    lines.extend(
        [
            "## 개요",
            _coverage_line(report),
            _isolates_line(report),
            (
                f"- 채택된 액션 {summary.activity_count}건이 "
                f"{summary.edge_count}개의 방향 관계 엣지로 집계되었습니다."
            ),
        ]
    )
    if summary.empty_reason:
        lines.append(f"- 참고: {summary.empty_reason}")

    lines.extend(
        [
            "",
            "## 연결성",
            _density_line(report),
            _component_line(
                component_name="약연결",
                count=summary.weak_component_count,
                largest_size=summary.largest_weak_component_size,
                largest_ratio=summary.largest_weak_component_ratio,
            ),
            _component_line(
                component_name="강연결",
                count=summary.strong_component_count,
                largest_size=summary.largest_strong_component_size,
                largest_ratio=summary.largest_strong_component_ratio,
            ),
            _reciprocity_line(report),
            "",
            "## 허브/영향력",
            "- 허브 점수는 연결을 바깥으로 퍼뜨리는 정도를, 권위 점수와 페이지랭크는 연결이 모이는 위치와 영향력을 보여줍니다.",
        ]
    )
    _extend_leaderboard(
        lines,
        title="허브 상위 5",
        entries=report.leaderboards.get("hubs", []),
    )
    _extend_leaderboard(
        lines,
        title="권위 상위 5",
        entries=report.leaderboards.get("authorities", []),
    )
    _extend_leaderboard(
        lines,
        title="영향력 상위 5",
        entries=report.leaderboards.get("influence", []),
    )

    lines.extend(
        [
            "",
            "## 브로커/응집도",
            (
                "- 중개 중심성은 관계 흐름의 병목 지점을, 응집도 지표는 "
                "삼각 관계와 지역 결속 정도를 보여줍니다."
            ),
        ]
    )
    _extend_leaderboard(
        lines,
        title="브로커 상위 5",
        entries=report.leaderboards.get("brokers", []),
    )
    lines.extend(
        [
            f"- 평균 클러스터링 계수: {_format_float(summary.average_clustering)}",
            f"- 전이성: {_format_float(summary.transitivity)}",
            f"- 최대 코어 번호: {_format_int(summary.max_core_number)}",
            _effective_size_line(report.nodes),
            "",
            "## 커뮤니티",
        ]
    )
    if report.communities:
        lines.append(
            f"- 의미 있는 커뮤니티는 {summary.community_count}개이며, 서로 자주 엮이는 하위 그룹을 뜻합니다."
        )
        for community in report.communities:
            members = ", ".join(community.member_display_names)
            lines.append(
                f"- 커뮤니티 {community.community_index}: {members} "
                f"({community.actor_count}명, 내부 가중치 {_format_float(community.internal_weight)})"
            )
    else:
        lines.append("- 크기 2 이상으로 묶이는 의미 있는 커뮤니티는 관찰되지 않았습니다.")

    lines.extend(["", "## 계산 제외 지표"])
    if summary.skipped_metrics:
        for metric_name, reason in sorted(summary.skipped_metrics.items()):
            lines.append(f"- `{metric_name}`: {reason}")
    else:
        lines.append("- 없음")

    return "\n".join(lines).rstrip() + "\n"


def _coverage_line(report: NetworkReport) -> str:
    summary = report.summary
    if summary.total_actor_count <= 0:
        return (
            f"- 전체 캐스트 기준 정보가 없어 절대 인원만 표시합니다. "
            f"관계망에 등장한 행위자는 {summary.participating_actor_count}명입니다."
        )
    return (
        f"- 전체 {summary.total_actor_count}명 중 "
        f"{summary.participating_actor_count}명({_format_percent(summary.participating_actor_ratio)})이 "
        "관계망에 등장했습니다."
    )


def _isolates_line(report: NetworkReport) -> str:
    summary = report.summary
    if summary.total_actor_count <= 0:
        return f"- 고립된 행위자는 {summary.isolated_actor_count}명입니다."
    return (
        f"- 고립된 행위자는 {summary.isolated_actor_count}명"
        f"({_format_percent(summary.isolated_actor_ratio)})입니다."
    )


def _density_line(report: NetworkReport) -> str:
    summary = report.summary
    return (
        f"- 방향 그래프 밀도는 {_format_float(summary.density)}입니다. "
        "값이 높을수록 가능한 연결 대비 실제 연결이 더 촘촘합니다."
    )


def _component_line(
    *,
    component_name: str,
    count: int,
    largest_size: int,
    largest_ratio: float | None,
) -> str:
    ratio_text = _format_percent(largest_ratio)
    return (
        f"- {component_name} 컴포넌트는 {count}개이며, 가장 큰 묶음은 "
        f"{largest_size}명({ratio_text})입니다."
    )


def _reciprocity_line(report: NetworkReport) -> str:
    summary = report.summary
    if summary.reciprocity is None:
        return "- 상호성은 계산되지 않았습니다."
    return (
        f"- 상호성은 {_format_float(summary.reciprocity)}입니다. "
        "서로 주고받는 관계가 많을수록 값이 커집니다."
    )


def _extend_leaderboard(
    lines: list[str],
    *,
    title: str,
    entries: list[NetworkLeaderboardEntry],
) -> None:
    lines.append(f"### {title}")
    if not entries:
        lines.append("- 계산 가능한 항목이 없습니다.")
        return
    for index, entry in enumerate(entries, start=1):
        lines.append(
            f"{index}. {entry.display_name} (`{entry.cast_id}`) - {_format_float(entry.score)}"
        )


def _effective_size_line(nodes: list[ActorNodeMetrics]) -> str:
    ranked = sorted(
        (
            node
            for node in nodes
            if node.effective_size is not None
        ),
        key=lambda item: (-float(item.effective_size), item.display_name, item.cast_id),
    )
    if not ranked:
        return "- 유효 크기는 계산되지 않았습니다."
    top_actor = ranked[0]
    return (
        f"- 유효 크기 기준으로는 {top_actor.display_name}(`{top_actor.cast_id}`)가 "
        f"{_format_float(top_actor.effective_size)}로 가장 넓은 비중복 연결 창구를 가졌습니다."
    )


def _format_percent(value: float | None) -> str:
    if value is None:
        return "계산되지 않음"
    return f"{value * 100:.1f}%"


def _format_float(value: float | None) -> str:
    if value is None:
        return "계산되지 않음"
    return f"{value:.4f}"


def _format_int(value: int | None) -> str:
    if value is None:
        return "계산되지 않음"
    return str(value)
