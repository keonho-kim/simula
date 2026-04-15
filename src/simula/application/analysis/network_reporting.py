"""Purpose:
- Render readable Markdown summaries for relationship-network analysis outputs.
"""

from __future__ import annotations

from collections.abc import Sequence

from simula.application.analysis.models import (
    ActorEdgeMetrics,
    ActorNodeMetrics,
    InteractionDigestRecord,
    NetworkReport,
)


def render_network_summary_markdown(
    *,
    run_id: str,
    report: NetworkReport,
    interactions: Sequence[InteractionDigestRecord] | None = None,
) -> str:
    """Render one Korean Markdown report for the analyzed network."""

    summary = report.summary
    lines = [f"# {run_id} 관계망 참고 분석", ""]

    lines.extend(
        [
            "## 먼저 볼 것",
            _coverage_line(report),
            _edge_line(report),
            _isolates_line(report),
        ]
    )
    if summary.empty_reason:
        lines.append(f"- 참고: {summary.empty_reason}")
    for warning in summary.input_warnings:
        lines.append(f"- 입력 경고: {warning}")

    lines.extend(
        [
            "",
            "## 누가 중심에 있었나",
            *_top_actor_lines(report.nodes),
        ]
    )

    lines.extend(
        [
            "",
            "## 어떤 관계가 두드러졌나",
            *_interaction_lines(
                interactions=interactions or [],
                edges=report.edges,
            ),
        ]
    )

    lines.extend(
        [
            "",
            "## 구조 해석",
            _density_line(report),
            _component_line(
                component_name="가장 큰 연결권",
                count=summary.weak_component_count,
                largest_size=summary.largest_weak_component_size,
                largest_ratio=summary.largest_weak_component_ratio,
            ),
            _community_line(report),
        ]
    )

    lines.extend(
        [
            "",
            "## 계산 메모",
            "- 연결 밀도는 `nx.density(...)`, 관계 모둠은 `nx.community.greedy_modularity_communities(...)`를 기준으로 계산합니다.",
            "- 영향력 참고치는 `nx.pagerank(...)`, `nx.hits(...)`, `nx.betweenness_centrality(...)` 등을 사용하지만, 해석은 본문 위주로 읽으면 됩니다.",
            "- 더 자세한 숫자는 `network/nodes.csv`, `network/edges.csv`, `network/interactions.csv`에서 확인할 수 있습니다.",
        ]
    )

    return "\n".join(lines).rstrip() + "\n"


def _top_actor_lines(nodes: Sequence[ActorNodeMetrics]) -> list[str]:
    if not nodes:
        return ["- 중심으로 해석할 행위자 데이터가 없습니다."]

    lines: list[str] = []
    for node in nodes[:5]:
        lines.append(
            "- "
            f"{node.display_name}(`{node.cast_id}`): "
            f"총 관계 가중치 {node.total_weight}, 상대 {node.counterpart_count}명, "
            f"발신 액션 {node.initiated_actions}건, 수신 액션 {node.received_actions}건"
        )
    return lines


def _interaction_lines(
    *,
    interactions: Sequence[InteractionDigestRecord],
    edges: Sequence[ActorEdgeMetrics],
) -> list[str]:
    if interactions:
        lines: list[str] = []
        for item in interactions[:5]:
            participant_label = " ↔ ".join(item.participant_display_names[:3])
            if len(item.participant_display_names) > 3:
                participant_label += f" 외 {len(item.participant_display_names) - 3}명"
            message = item.latest_message or item.representative_message or item.representative_interaction
            lines.append(
                "- "
                f"{participant_label}: "
                f"{item.activity_count}건, "
                f"라운드 {item.round_start}-{item.round_end}, "
                f"최근 메시지 \"{message}\""
            )
        return lines

    if not edges:
        return ["- 두드러진 관계 엣지가 없습니다."]

    return [
        "- "
        f"{edge.source_display_name} → {edge.target_display_name}: "
        f"총 {edge.total_weight}건, 실제 대상 액션 {edge.action_count}건, "
        f"대표 상호작용 \"{edge.label_preview}\""
        for edge in edges[:5]
    ]


def _coverage_line(report: NetworkReport) -> str:
    summary = report.summary
    return (
        f"- 전체 {summary.total_actor_count}명 중 "
        f"{summary.participating_actor_count}명"
        f"({_format_ratio(summary.participating_actor_ratio)})이 실제 관계망에 등장했습니다."
    )


def _edge_line(report: NetworkReport) -> str:
    summary = report.summary
    return (
        f"- 채택된 액션 {summary.activity_count}건이 "
        f"{summary.edge_count}개의 방향 관계로 묶였습니다."
    )


def _isolates_line(report: NetworkReport) -> str:
    summary = report.summary
    return (
        f"- 고립된 행위자는 {summary.isolated_actor_count}명"
        f"({_format_ratio(summary.isolated_actor_ratio)})입니다."
    )


def _density_line(report: NetworkReport) -> str:
    summary = report.summary
    if summary.density is None:
        return "- 연결 밀도는 계산할 수 없었습니다."
    return (
        f"- 연결 밀도는 {_format_float(summary.density)}입니다. "
        "값이 높을수록 가능한 관계 대비 실제 연결이 더 촘촘합니다."
    )


def _component_line(
    *,
    component_name: str,
    count: int,
    largest_size: int,
    largest_ratio: float | None,
) -> str:
    return (
        f"- {component_name}은 {count}개이며, 가장 큰 묶음은 "
        f"{largest_size}명({_format_ratio(largest_ratio)})입니다."
    )


def _community_line(report: NetworkReport) -> str:
    summary = report.summary
    if not report.communities:
        return "- 내부적으로 뚜렷하게 묶이는 소그룹은 관찰되지 않았습니다."

    lead = report.communities[0]
    members = ", ".join(lead.member_display_names[:4])
    if len(lead.member_display_names) > 4:
        members += f" 외 {len(lead.member_display_names) - 4}명"
    return (
        f"- 의미 있는 커뮤니티는 {summary.community_count}개이며, "
        f"가장 큰 소그룹은 {members}입니다."
    )


def _format_float(value: float | None) -> str:
    if value is None:
        return "-"
    return f"{value:.4f}"


def _format_ratio(value: float | None) -> str:
    if value is None:
        return "-"
    return f"{value * 100:.1f}%"
