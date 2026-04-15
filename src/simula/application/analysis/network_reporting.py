"""Purpose:
- Render deterministic Markdown summaries for network complexity analysis.
"""

from __future__ import annotations

import math
from collections.abc import Sequence

from simula.application.analysis.models import ActorNodeMetrics, NetworkReport

_CONNECTIVITY_COLUMNS: tuple[tuple[str, str], ...] = (
    ("total_weight", "총 관계 가중치"),
    ("counterpart_count", "상대 수"),
    ("in_degree_centrality", "내향 중심성"),
    ("out_degree_centrality", "외향 중심성"),
)
_INFLUENCE_COLUMNS: tuple[tuple[str, str], ...] = (
    ("hub_score", "허브 점수"),
    ("authority_score", "권위 점수"),
    ("pagerank", "페이지랭크"),
)
_BROKERAGE_COLUMNS: tuple[tuple[str, str], ...] = (
    ("betweenness_centrality", "중개 중심성"),
    ("effective_size", "유효 크기"),
    ("core_number", "코어 번호"),
)
_INTEGER_METRICS = {
    "core_number",
    "counterpart_count",
    "total_weight",
}


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
    for warning in summary.input_warnings:
        lines.append(f"- 입력 경고: {warning}")

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
            (
                "- 방향 그래프 밀도는 `nx.density(...)`로 계산합니다. 가능한 방향 엣지 수 "
                "대비 실제 방향 엣지 수의 비율이라서, 1에 가까울수록 관계가 더 촘촘합니다."
            ),
            (
                "- 약연결 컴포넌트는 엣지 방향을 무시했을 때 이어지는 묶음 수입니다. "
                "한 번이라도 관계가 닿으면 같은 연결권으로 봅니다."
            ),
            (
                "- 강연결 컴포넌트는 엣지 방향을 유지했을 때 서로에게 돌아갈 경로가 있는 "
                "묶음 수입니다. 일방향 연결만 많으면 강연결 묶음은 잘 커지지 않습니다."
            ),
            (
                "- 상호성은 `nx.overall_reciprocity(...)`로 계산합니다. A→B가 있을 때 "
                "B→A도 함께 존재하는 비율이라서, 관계가 얼마나 맞물려 있는지 보여줍니다."
            ),
            (
                "- 내향 중심성과 외향 중심성은 각각 `nx.in_degree_centrality(...)`, "
                "`nx.out_degree_centrality(...)`로 계산합니다. 내향은 여러 사람에게 "
                "지목되는 정도, 외향은 여러 사람에게 관계를 보내는 정도를 뜻합니다."
            ),
            "",
            "### 전체 행위자 연결 점수",
            "- 각 셀은 `raw / min-max` 형식이며, min-max scaling은 이 보고서 안의 같은 지표끼리만 비교합니다.",
        ]
    )
    lines.extend(
        _render_actor_metric_table(
            nodes=report.nodes,
            columns=_CONNECTIVITY_COLUMNS,
        )
    )

    lines.extend(
        [
            "",
            "## 허브/권위/영향력",
            (
                "- 허브 점수와 권위 점수는 `nx.hits(..., normalized=True)`의 HITS 알고리즘 "
                "결과입니다. 허브는 권위 있는 상대에게 연결을 보내는 발신 거점이고, "
                "권위는 좋은 허브들에게 반복적으로 지목되는 수신 거점입니다."
            ),
            (
                "- 페이지랭크는 `nx.pagerank(weight=\"total_weight\")`로 계산합니다. "
                "단순히 많이 연결된 노드보다, 이미 중요한 노드로부터 큰 weight를 받는 "
                "행위자가 더 높은 값을 얻습니다."
            ),
            (
                "- 허브는 정보나 접촉을 퍼뜨리는 축인지, 권위는 관계가 모여드는 축인지, "
                "페이지랭크는 가중치까지 포함한 전체 영향력이 어디에 쏠리는지를 읽는 데 "
                "적합합니다."
            ),
            "",
            "### 전체 행위자 허브/권위/영향력 점수",
            "- 각 셀은 `raw / min-max` 형식입니다.",
        ]
    )
    lines.extend(
        _render_actor_metric_table(
            nodes=report.nodes,
            columns=_INFLUENCE_COLUMNS,
        )
    )

    lines.extend(
        [
            "",
            "## 브로커/응집도",
            (
                "- 중개 중심성은 먼저 `distance_weight = 1 / total_weight`를 만든 뒤 "
                "`nx.betweenness_centrality(..., weight=\"distance_weight\", "
                "normalized=True)`로 계산합니다. weight가 큰 연결일수록 더 가까운 "
                "관계로 보고, 그 최단 경로를 얼마나 자주 가로지르는지가 점수입니다."
            ),
            (
                "- 유효 크기는 `nx.effective_size(weight=\"total_weight\")`로 계산합니다. "
                "연결 상대 수가 많아도 서로가 서로를 많이 대체하면 값이 줄고, 덜 중복된 "
                "연결을 넓게 가진 브로커일수록 값이 커집니다."
            ),
            (
                "- 평균 클러스터링 계수는 `nx.average_clustering(weight=\"total_weight\")`, "
                "전이성은 `nx.transitivity(...)`로 계산합니다. 둘 다 삼각 관계가 얼마나 "
                "자주 닫히는지 보지만, 전자는 노드 평균이고 후자는 그래프 전체 비율입니다."
            ),
            (
                "- 코어 번호는 `nx.core_number(...)`로 계산합니다. 각 행위자가 최소 몇 개 "
                "이상의 연결을 유지하는 조밀한 핵심층까지 들어가 있는지를 뜻합니다."
            ),
            f"- 평균 클러스터링 계수: {_format_float(summary.average_clustering)}",
            f"- 전이성: {_format_float(summary.transitivity)}",
            f"- 최대 코어 번호: {_format_int(summary.max_core_number)}",
            _effective_size_line(report.nodes),
            "",
            "### 전체 행위자 브로커/응집 점수",
            "- 각 셀은 `raw / min-max` 형식입니다.",
        ]
    )
    lines.extend(
        _render_actor_metric_table(
            nodes=report.nodes,
            columns=_BROKERAGE_COLUMNS,
        )
    )

    lines.extend(
        [
            "",
            "## 커뮤니티",
            (
                "- 커뮤니티는 `nx.community.greedy_modularity_communities("
                "weight=\"total_weight\")`로 계산합니다. 내부 연결 가중치가 더 조밀한 "
                "노드 집합을 탐욕적으로 찾는 modularity 기반 군집화입니다."
            ),
            (
                "- 같은 커뮤니티는 서로 자주 엮이지만 바깥과의 연결은 상대적으로 약한 "
                "하위 그룹으로 읽을 수 있습니다."
            ),
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


def _render_actor_metric_table(
    *,
    nodes: Sequence[ActorNodeMetrics],
    columns: Sequence[tuple[str, str]],
) -> list[str]:
    if not nodes:
        return ["- 표시할 행위자 점수가 없습니다."]

    normalized_by_metric = {
        metric_name: _normalize_metric_for_nodes(nodes, metric_name=metric_name)
        for metric_name, _ in columns
    }
    header = "| 행위자 | " + " | ".join(label for _, label in columns) + " |"
    separator = "| --- | " + " | ".join("---" for _ in columns) + " |"
    lines = [header, separator]

    for node in nodes:
        actor_cell = _escape_markdown_cell(f"{node.display_name} (`{node.cast_id}`)")
        metric_cells: list[str] = []
        for metric_name, _ in columns:
            raw_value = getattr(node, metric_name)
            normalized_value = normalized_by_metric[metric_name][node.cast_id]
            metric_cells.append(
                _escape_markdown_cell(
                    _format_raw_and_normalized(
                        metric_name=metric_name,
                        raw_value=raw_value,
                        normalized_value=normalized_value,
                    )
                )
            )
        lines.append(f"| {actor_cell} | " + " | ".join(metric_cells) + " |")
    return lines


def _normalize_metric_for_nodes(
    nodes: Sequence[ActorNodeMetrics],
    *,
    metric_name: str,
) -> dict[str, float | None]:
    normalized = {
        node.cast_id: None
        for node in nodes
    }
    numeric_values: list[tuple[str, float]] = []
    for node in nodes:
        raw_value = getattr(node, metric_name)
        if not isinstance(raw_value, int | float):
            continue
        numeric_values.append((node.cast_id, float(raw_value)))

    if not numeric_values:
        return normalized

    values = [value for _, value in numeric_values]
    minimum = min(values)
    maximum = max(values)

    if math.isclose(minimum, maximum):
        fill_value = 0.5 if maximum > 0 else 0.0
        for cast_id, _ in numeric_values:
            normalized[cast_id] = fill_value
        return normalized

    scale = maximum - minimum
    for cast_id, value in numeric_values:
        normalized[cast_id] = (value - minimum) / scale
    return normalized


def _format_raw_and_normalized(
    *,
    metric_name: str,
    raw_value: object,
    normalized_value: float | None,
) -> str:
    if raw_value is None:
        return "계산되지 않음"
    return (
        f"{_format_metric_value(metric_name=metric_name, value=raw_value)} / "
        f"{_format_float(normalized_value)}"
    )


def _format_metric_value(*, metric_name: str, value: object) -> str:
    if value is None:
        return "계산되지 않음"
    if metric_name in _INTEGER_METRICS:
        return _format_int(_to_int(value))
    return _format_float(_to_float(value))


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


def _effective_size_line(nodes: Sequence[ActorNodeMetrics]) -> str:
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
    rounded = round(value, 4)
    if rounded == 0:
        rounded = 0.0
    return f"{rounded:.4f}"


def _format_int(value: int | None) -> str:
    if value is None:
        return "계산되지 않음"
    return str(value)


def _to_float(value: object) -> float | None:
    if isinstance(value, int | float):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _to_int(value: object) -> int | None:
    float_value = _to_float(value)
    if float_value is None:
        return None
    return int(round(float_value))


def _escape_markdown_cell(value: str) -> str:
    return value.replace("|", "\\|")
