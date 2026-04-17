"""Purpose:
- Render readable Markdown summaries for connection-network analysis outputs.
"""

from __future__ import annotations

from simula.application.analysis.models import NetworkGrowthReport, NetworkReport, PlannedActionRecord
from simula.application.analysis.network_narrative import (
    action_label_map,
    build_actor_connection_lines,
    build_growth_leader_shift_lines,
    build_leader_lines,
)


def render_network_summary_markdown(
    *,
    run_id: str,
    report: NetworkReport,
    growth_report: NetworkGrowthReport,
    planned_actions: list[PlannedActionRecord] | None = None,
) -> str:
    """Render one Korean Markdown report for the analyzed connection network."""

    summary = report.summary
    label_by_action_type = action_label_map(planned_actions or [])
    lines = [f"# {run_id} 연결망 참고 메모", ""]

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
            *build_actor_connection_lines(
                nodes=report.nodes,
                label_by_action_type=label_by_action_type,
                limit=5,
            ),
        ]
    )

    lines.extend(
        [
            "",
            "## 누가 직접·간접으로 퍼졌나",
            *build_leader_lines(report),
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
            "## 연결이 어디로 몰렸나",
            _concentration_line(growth_report),
            _density_line(report),
            _component_line(
                component_name="한 덩어리로 이어진 가장 큰 그룹",
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
            "## 벤치마크 지표",
            *_benchmark_lines(report),
        ]
    )

    lines.extend(
        [
            "",
            "## 계산 메모",
            "- 성장 추이는 라운드별 누적 연결을 다시 계산해 요약합니다.",
            "- 직접 연결, 중간 다리 역할, 간접 영향력은 각각 상대 수, 중개 중심성, 페이지랭크를 바탕으로 읽습니다.",
            "- 더 자세한 숫자는 `network/growth.csv`, `network/nodes.csv`, `network/edges.csv`에서 확인할 수 있습니다.",
        ]
    )

    return "\n".join(lines).rstrip() + "\n"


def _growth_lines(growth_report: NetworkGrowthReport) -> list[str]:
    if growth_report.empty_reason:
        return [f"- {growth_report.empty_reason}"]
    if not growth_report.rows:
        return ["- 라운드별 성장 기록이 없습니다."]

    final_row = growth_report.final_row
    assert final_row is not None
    earliest_growth = next(
        (item for item in growth_report.rows if item.edge_count > 0),
        None,
    )
    largest_jump = max(
        growth_report.rows,
        key=lambda item: (item.new_edge_count, item.new_actor_count, -item.round_index),
    )

    lines = []
    if earliest_growth is not None:
        lines.append(
            "- "
            f"연결이 눈에 띄게 생기기 시작한 시점은 {earliest_growth.round_index}라운드였습니다."
        )
    lines.append(
        "- "
        f"가장 큰 확장 구간은 {largest_jump.round_index}라운드로, "
        f"새 행위자 {largest_jump.new_actor_count}명과 새 연결 {largest_jump.new_edge_count}개가 추가됐습니다."
    )
    lines.append(
        "- "
        f"최종 상태에서는 참여 행위자 {final_row.participating_actor_count}명과 연결 {final_row.edge_count}개가 남았습니다."
    )
    return lines


def _coverage_line(report: NetworkReport) -> str:
    summary = report.summary
    return (
        f"- 전체 {summary.total_actor_count}명 중 "
        f"{summary.participating_actor_count}명"
        f"({_format_ratio(summary.participating_actor_ratio)})이 실제 연결에 들어왔습니다."
    )


def _edge_line(report: NetworkReport) -> str:
    summary = report.summary
    return (
        f"- 채택된 액션 {summary.activity_count}건이 "
        f"{summary.edge_count}개의 방향 연결로 묶였습니다."
    )


def _isolates_line(report: NetworkReport) -> str:
    summary = report.summary
    return (
        f"- 고립된 행위자는 {summary.isolated_actor_count}명"
        f"({_format_ratio(summary.isolated_actor_ratio)})입니다."
    )


def _concentration_line(growth_report: NetworkGrowthReport) -> str:
    final_row = growth_report.final_row
    if final_row is None:
        return "- 집중도를 계산할 수 없었습니다."
    return (
        f"- 최종 라운드 기준 가장 많이 연결된 1명이 전체 연결의 {_format_ratio(final_row.top1_actor_share)}를 차지했습니다. "
        f"쏠림 정도는 HHI {_format_float(final_row.actor_weight_hhi)}, Gini {_format_float(final_row.actor_weight_gini)}입니다."
    )


def _density_line(report: NetworkReport) -> str:
    summary = report.summary
    if summary.density is None:
        return "- 실제로 연결된 비율은 계산할 수 없었습니다."
    return (
        f"- 서로 연결될 수 있는 경우 중 실제로 연결된 비율은 {_format_ratio(summary.density)}입니다."
    )


def _component_line(
    *,
    component_name: str,
    count: int,
    largest_size: int,
    largest_ratio: float | None,
) -> str:
    return (
        f"- {component_name}은 {count}개이며, 가장 큰 그룹은 "
        f"{largest_size}명({_format_ratio(largest_ratio)})입니다."
    )


def _community_line(report: NetworkReport) -> str:
    summary = report.summary
    if not report.communities:
        return "- 내부적으로 따로 뭉쳐 움직인 소그룹은 뚜렷하지 않았습니다."

    lead = report.communities[0]
    members = ", ".join(lead.member_display_names[:4])
    if len(lead.member_display_names) > 4:
        members += f" 외 {len(lead.member_display_names) - 4}명"
    return (
        f"- 눈에 띄는 소그룹은 {summary.community_count}개였고, "
        f"가장 큰 그룹은 {members}입니다."
    )


def _benchmark_lines(
    report: NetworkReport,
) -> list[str]:
    benchmark = report.summary.benchmark_metrics
    return [
        "- "
        f"참여 분산 엔트로피는 {_format_float(benchmark.participation_entropy)}이고, "
        f"행동 다양성은 {_format_float(benchmark.action_type_diversity)}입니다.",
        "- "
        f"밀도는 {_format_ratio(benchmark.density)}, 평균 경로 깊이는 {_format_float(benchmark.average_path_depth)}, "
        f"지름은 {_format_int(benchmark.network_diameter)}입니다.",
        "- "
        f"중심화는 {_format_float(benchmark.centralization)}입니다.",
        "- "
        f"커뮤니티는 {benchmark.community_count}개, 모듈러리티는 {_format_float(benchmark.modularity)}입니다.",
        "- "
        f"평균 엣지 성장률은 {_format_float(benchmark.mean_edge_growth_rate)}, "
        f"평균 활성 actor 성장률은 {_format_float(benchmark.mean_active_actor_growth_rate)}입니다.",
        "- "
        f"상위 20% actor의 상호작용 점유율은 {_format_ratio(benchmark.top20_interaction_share)}입니다.",
        *[
            f"- 계산 제외: {metric} -> {reason}"
            for metric, reason in sorted(report.summary.skipped_metrics.items())
            if metric
            in {
                "participation_entropy",
                "action_type_diversity",
                "average_path_depth",
                "network_diameter",
                "modularity",
            }
        ],
    ]


def _format_float(value: float | None) -> str:
    if value is None:
        return "-"
    return f"{value:.4f}"


def _format_int(value: int | None) -> str:
    if value is None:
        return "-"
    return str(value)


def _format_ratio(value: float | None) -> str:
    if value is None:
        return "-"
    return f"{value * 100:.1f}%"
