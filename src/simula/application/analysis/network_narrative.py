"""Purpose:
- Build plain-language Korean connection-network descriptions from analyzer data.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence

from simula.application.analysis.metrics.network_leaders import (
    NetworkLeader,
    select_top_broker_leader,
    select_top_degree_leader,
    select_top_influence_leader,
)
from simula.application.analysis.models import (
    ActorNodeMetrics,
    NetworkGrowthRecord,
    NetworkGrowthReport,
    NetworkReport,
    PlannedActionRecord,
)


def action_label_map(planned_actions: Sequence[PlannedActionRecord]) -> dict[str, str]:
    """Return action labels keyed by action_type."""

    return {
        item.action_type: (item.label.strip() or item.action_type)
        for item in planned_actions
        if item.action_type.strip()
    }


def build_actor_connection_lines(
    *,
    nodes: Sequence[ActorNodeMetrics],
    label_by_action_type: dict[str, str],
    limit: int = 3,
) -> list[str]:
    """Render actor summaries with sent/received action breakdowns."""

    if not nodes:
        return ["- 중심으로 해석할 행위자 데이터가 없습니다."]

    lines: list[str] = []
    for node in nodes[:limit]:
        lines.append(
            "- "
            f"{node.display_name}(`{node.cast_id}`): "
            f"{node.counterpart_count}명과 연결됨 (발신 {node.initiated_actions}건, 수신 {node.received_actions}건)"
        )
        lines.append(
            f"  - 발신: {_format_action_breakdown(node.sent_action_counts, label_by_action_type)}"
        )
        lines.append(
            f"  - 수신: {_format_action_breakdown(node.received_action_counts, label_by_action_type)}"
        )
    return lines


def build_leader_lines(report: NetworkReport) -> list[str]:
    """Render final direct/broker/influence leader lines."""

    direct = select_top_degree_leader(report.nodes)
    broker = select_top_broker_leader(report.nodes)
    influence = select_top_influence_leader(report.nodes)
    return [
        _leader_line(
            title="가장 많은 사람과 직접 연결된 사람",
            leader=direct,
            formatter=lambda score: f"{score:.0f}명과 직접 연결",
        ),
        _leader_line(
            title="다른 사람 사이를 가장 많이 이어준 사람",
            leader=broker,
            formatter=lambda score: f"중개 중심성 {score:.4f}",
        ),
        _leader_line(
            title="간접 영향력이 가장 큰 사람",
            leader=influence,
            formatter=lambda score: f"간접 영향력 점수 {score:.4f}",
        ),
    ]


def build_growth_leader_shift_lines(growth_report: NetworkGrowthReport) -> list[str]:
    """Describe how direct/broker/influence leadership changes over rounds."""

    if growth_report.empty_reason:
        return [f"- {growth_report.empty_reason}"]
    if not growth_report.rows:
        return ["- 라운드별 연결 변화 기록이 없습니다."]

    direct_shift_round = _first_leader_shift_round(
        [item.top_degree_cast_id for item in growth_report.rows]
    )
    broker_appearance = _first_positive_round(
        growth_report.rows,
        kind="broker",
    )
    top_influence_row = max(
        growth_report.rows,
        key=lambda item: (_score_value(item.top_influence_score), -item.round_index),
    )

    lines: list[str] = []
    if direct_shift_round is not None:
        direct_row = growth_report.rows[direct_shift_round - 1]
        lines.append(
            "- "
            f"직접 연결의 중심은 {direct_shift_round}라운드에 "
            f"{direct_row.top_degree_display_name or direct_row.top_degree_cast_id} 쪽으로 바뀌었습니다."
        )
    else:
        final_row = growth_report.final_row
        if final_row is not None and final_row.top_degree_display_name:
            lines.append(
                "- "
                f"직접 연결의 중심은 시작부터 끝까지 "
                f"{final_row.top_degree_display_name} 쪽이 유지됐습니다."
            )

    if broker_appearance is not None:
        broker_row = growth_report.rows[broker_appearance - 1]
        lines.append(
            "- "
            f"중간 다리 역할은 {broker_appearance}라운드부터 "
            f"{broker_row.top_broker_display_name or broker_row.top_broker_cast_id}가 눈에 띄었습니다."
        )
    else:
        lines.append("- 중간 다리 역할이 두드러질 만큼 복잡한 연결 구조는 나타나지 않았습니다.")

    if top_influence_row.top_influence_display_name:
        lines.append(
            "- "
            f"간접 영향력은 {top_influence_row.round_index}라운드에 "
            f"{top_influence_row.top_influence_display_name} 쪽으로 가장 크게 몰렸습니다."
        )
    else:
        lines.append("- 간접 영향력이 한쪽으로 강하게 몰린 시점은 뚜렷하지 않았습니다.")
    return lines


def _format_action_breakdown(
    counts: dict[str, int],
    label_by_action_type: dict[str, str],
    *,
    limit: int = 3,
) -> str:
    if not counts:
        return "없음"
    ordered = sorted(
        counts.items(),
        key=lambda item: (-item[1], label_by_action_type.get(item[0], item[0]), item[0]),
    )
    parts = [
        f"{label_by_action_type.get(action_type, action_type)} ({count}회)"
        for action_type, count in ordered[:limit]
    ]
    if len(ordered) > limit:
        parts.append(f"외 {len(ordered) - limit}종")
    return ", ".join(parts)


def _leader_line(
    *,
    title: str,
    leader: NetworkLeader,
    formatter: Callable[[float], str],
) -> str:
    if not leader.cast_id or leader.score is None:
        return f"- {title}: 뚜렷한 후보를 계산하지 못했습니다."
    return (
        f"- {title}: {leader.display_name}(`{leader.cast_id}`), "
        f"{formatter(float(leader.score))}"
    )


def _first_leader_shift_round(values: list[str]) -> int | None:
    previous = ""
    for index, value in enumerate(values, start=1):
        if not value:
            continue
        if previous and value != previous:
            return index
        previous = value
    return None


def _first_positive_round(
    rows: Sequence[NetworkGrowthRecord],
    *,
    kind: str,
) -> int | None:
    for row in rows:
        if kind == "broker" and row.top_broker_cast_id and _score_value(row.top_broker_score) > 0.0:
            return row.round_index
    return None


def _score_value(value: float | None) -> float:
    if value is None:
        return 0.0
    return float(value)
