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
                "source_actor_id": "alpha",
                "target_actor_ids": ["beta"],
                "action_summary": "첫 action",
                "visibility": "private",
            },
            {
                "thread_id": "same-thread",
                "source_actor_id": "alpha",
                "target_actor_ids": ["beta"],
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
        min_rows=1,
        max_rows=3,
    )

    assert error is None


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


def test_validate_actor_dynamics_section_requires_fixed_subheadings() -> None:
    error = validate_actor_dynamics_section(
        "### 현재 구도\n"
        "Alpha가 Beta에게 가장 큰 영향을 주고 있다.\n\n"
        "### 관계 변화\n"
        "처음에는 떨어져 있었지만 마지막 단계에서 두 사람의 연결이 강해졌다."
    )

    assert error is None


def test_validate_forbidden_report_terms_rejects_abstract_jargon() -> None:
    error = validate_forbidden_report_terms(
        "### 현재 구도\nAlpha는 조정 축으로 남았다.",
        scenario_text="테스트 시나리오",
    )

    assert error is not None
