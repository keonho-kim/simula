"""목적:
- 최종 보고서 projection과 형식 검증 유틸을 테스트한다.

설명:
- anchor 파싱, 절대시각 라벨 계산, activity cluster 축약, 섹션 형식 검증을 확인한다.

사용한 설계 패턴:
- finalization 유틸 단위 테스트 패턴
"""

from __future__ import annotations

from datetime import datetime

from simula.application.workflow.graphs.finalization.nodes.build_report_projection import (
    cluster_round_activities,
    format_report_time_label,
)
from simula.application.workflow.utils.finalization_sections import (
    normalize_conclusion_section,
    normalize_final_report_sections,
    render_markdown_table,
    validate_actor_dynamics_section,
    validate_bullet_section,
    validate_conclusion_section,
    validate_forbidden_report_terms,
    validate_markdown_table_rows,
    validate_timeline_section,
)
from simula.application.workflow.graphs.finalization.nodes.resolve_timeline_anchor import (
    extract_explicit_anchor,
    extract_partial_anchor_hint,
)


def test_extract_explicit_anchor_parses_date_and_time() -> None:
    scenario = "\n".join(
        [
            "## 시점",
            "- 가상 시점: 2027년 6월 18일",
            "- 시작 시각: 03:20",
        ]
    )

    parsed = extract_explicit_anchor(scenario)

    assert parsed == datetime(2027, 6, 18, 3, 20)


def test_extract_partial_anchor_hint_keeps_date_without_time() -> None:
    scenario = "\n".join(
        [
            "## 검색 기준일",
            "- 2026년 4월 10일",
            "## 배경",
            "- 시점은 자기소개 타임 직후 밤부터다.",
        ]
    )

    hint = extract_partial_anchor_hint(scenario)

    assert hint["date_hint"] == "2026-04-10"
    assert hint["time_hint"] == "없음"
    assert "시점" in hint["context_hint"]


def test_format_report_time_label_uses_absolute_timestamp() -> None:
    label = format_report_time_label(
        anchor=datetime(2027, 6, 18, 3, 20),
        total_elapsed_minutes=390,
    )

    assert label == "2027-06-18 09:50"


def test_cluster_round_activities_prioritizes_thread_grouping() -> None:
    actors_by_id = {
        "alpha": {"display_name": "Alpha"},
        "beta": {"display_name": "Beta"},
    }
    clusters = cluster_round_activities(
        round_activities=[
            {
                "thread_id": "same-thread",
                "source_cast_id": "alpha",
                "target_cast_ids": ["beta"],
                "action_summary": "첫 action",
                "visibility": "private",
            },
            {
                "thread_id": "same-thread",
                "source_cast_id": "alpha",
                "target_cast_ids": ["beta"],
                "action_summary": "둘째 action",
                "visibility": "private",
            },
        ],
        actors_by_id=actors_by_id,
    )

    assert len(clusters) == 1
    assert clusters[0]["activity_count"] == 2
    assert clusters[0]["source_actors"] == ["Alpha"]
    assert clusters[0]["target_actors"] == ["Beta"]


def test_validate_bullet_section_rejects_plain_paragraph() -> None:
    error = validate_bullet_section(
        "문단 하나만 있다.",
        min_items=3,
    )

    assert error is not None


def test_validate_markdown_table_rows_accepts_body_rows_only() -> None:
    error = validate_markdown_table_rows(
        "| A | 결과 | B | 우세 | 근거 |\n| B | 관망 | A | 열세 | 근거 |",
    )

    assert error is None


def test_validate_markdown_table_rows_allows_empty_body() -> None:
    assert validate_markdown_table_rows("") is None


def test_validate_markdown_table_rows_allows_more_than_fourteen_rows() -> None:
    rows = "\n".join(
        f"| A{i} | 결과{i} | B{i} | 우세 | 근거{i} |"
        for i in range(15)
    )

    assert validate_markdown_table_rows(rows) is None


def test_validate_timeline_section_requires_fixed_timestamp_pattern() -> None:
    error = validate_timeline_section(
        "- 2027-06-18 03:20 | 시작 단계 | 사건 발생 | 판세 변화\n"
        "- 2027-06-18 06:20 | 탐색 단계 | 재조정 | 긴장 유지"
    )

    assert error is None


def test_validate_conclusion_section_requires_two_subheadings() -> None:
    error = validate_conclusion_section(
        "### 최종 상태\n"
        "- 최종 선택 결과가 나왔다.\n"
        "### 핵심 판단 근거\n"
        "- 마지막 단계에서 선택이 분명해졌다."
    )

    assert error is None


def test_normalize_conclusion_section_promotes_plain_lines_to_bullets() -> None:
    normalized = normalize_conclusion_section(
        "### 최종 상태\n"
        "최종 선택 결과가 나왔다.\n"
        "### 핵심 판단 근거\n"
        "마지막 단계에서 선택이 분명해졌다."
    )

    assert "### 최종 상태\n- 최종 선택 결과가 나왔다." in normalized
    assert "### 핵심 판단 근거\n- 마지막 단계에서 선택이 분명해졌다." in normalized
    assert validate_conclusion_section(normalized) is None


def test_normalize_final_report_sections_drops_table_header_rows() -> None:
    normalized = normalize_final_report_sections(
        {
            "conclusion_section": "### 최종 상태\n유지\n### 핵심 판단 근거\n유지",
            "actor_results_rows": "| 행위자 | 결과 | 상대 | 우세 | 근거 |\n| --- | --- | --- | --- | --- |\n| A | 결과 | B | 우세 | 근거 |",
            "timeline_section": "2027-06-18 03:20 | 시작 단계 | 사건 | 결과",
            "actor_dynamics_section": "### 현재 구도\nA\n### 관계 변화\nB",
            "major_events_section": "사건",
        }
    )

    assert normalized["actor_results_rows"] == "| A | 결과 | B | 우세 | 근거 |"
    assert normalized["timeline_section"].startswith("- ")
    assert normalized["actor_dynamics_section"] == "### 현재 구도\n- A\n### 관계 변화\n- B"
    assert normalized["major_events_section"].startswith("- ")


def test_validate_actor_dynamics_section_requires_fixed_subheadings() -> None:
    error = validate_actor_dynamics_section(
        "### 현재 구도\n"
        "- Alpha가 Beta에게 가장 큰 영향을 주고 있다.\n\n"
        "### 관계 변화\n"
        "- 처음에는 떨어져 있었지만 마지막 단계에서 두 사람의 연결이 강해졌다."
    )

    assert error is None


def test_validate_forbidden_report_terms_rejects_abstract_jargon() -> None:
    error = validate_forbidden_report_terms(
        "### 현재 구도\nAlpha는 조정 축으로 남았다.",
        scenario_text="테스트 시나리오",
    )

    assert error is not None


def test_render_markdown_table_keeps_header_when_body_is_empty() -> None:
    rendered = render_markdown_table(
        headers=["인물", "최종 결론", "상대/대상", "유불리/상태", "근거 요약"],
        section_body="",
    )

    assert rendered == (
        "| 인물 | 최종 결론 | 상대/대상 | 유불리/상태 | 근거 요약 |\n"
        "| --- | --- | --- | --- | --- |"
    )
