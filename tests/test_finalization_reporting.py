"""목적:
- 최종 보고서 projection과 형식 검증 유틸을 테스트한다.

설명:
- anchor 파싱, 절대시각 라벨 계산, activity cluster 축약, 섹션 형식 검증을 확인한다.

사용한 설계 패턴:
- finalization 유틸 단위 테스트 패턴
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime
from types import SimpleNamespace

from langchain_core.prompts import PromptTemplate

from simula.application.workflow.graphs.finalization.nodes.build_report_projection import (
    build_report_projection,
    cluster_round_activities,
    format_report_time_label,
)
from simula.application.workflow.graphs.finalization.nodes.render_and_persist_final_report import (
    render_and_persist_final_report,
)
from simula.application.workflow.utils.finalization_sections import (
    build_report_prompt_inputs,
    normalize_conclusion_section,
    normalize_final_report_sections,
    render_markdown_table,
    write_report_section,
    validate_actor_dynamics_section,
    validate_bullet_section,
    validate_conclusion_section,
    validate_markdown_table_rows,
    validate_timeline_section,
)
from simula.application.workflow.graphs.finalization.nodes.resolve_timeline_anchor import (
    extract_explicit_anchor,
    extract_partial_anchor_hint,
)
from simula.prompts.shared.user_facing_language import build_user_facing_style_block


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


def test_validate_timeline_section_allows_single_line_minimum() -> None:
    error = validate_timeline_section(
        "- 2027-06-18 03:20 | 시작 단계 | 사건 발생 | 판세 변화"
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


def test_validate_bullet_section_allows_single_item_minimum_when_configured() -> None:
    error = validate_bullet_section("- 사건", min_items=1, max_items=5)

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


def test_build_user_facing_style_block_no_longer_mentions_forbidden_terms() -> None:
    style = build_user_facing_style_block()

    assert "Avoid expressions such as" not in style


def test_validate_conclusion_section_allows_terms_previously_blocked_as_jargon() -> None:
    error = validate_conclusion_section(
        "### 최종 상태\n"
        "- 마지막 협상안은 브리지 조건 쪽으로 수렴했다.\n"
        "### 핵심 판단 근거\n"
        "- 이사회 직전 구조가 재편되며 선택지가 줄었다."
    )

    assert error is None


def test_validate_actor_dynamics_section_allows_terms_previously_blocked_as_jargon() -> None:
    error = validate_actor_dynamics_section(
        "### 현재 구도\n"
        "- CFO와 CEO는 숫자 기준 정렬을 다시 맞추고 있다.\n\n"
        "### 관계 변화\n"
        "- 투자사 압박이 커지며 내부 역할이 재편됐다."
    )

    assert error is None


def test_write_report_section_accepts_valid_timeline_with_previously_forbidden_term() -> None:
    class FakeLLM:
        async def ainvoke_text_with_meta(self, role, prompt, **kwargs):  # noqa: ANN001
            del role, prompt, kwargs
            return (
                "- 2026-04-14 09:00 | 마무리 단계 | CFO가 표결 안건을 숫자 기준으로 정렬함 | 결론 직전 준비가 끝났다.",
                SimpleNamespace(),
            )

    runtime = SimpleNamespace(
        context=SimpleNamespace(
            llms=FakeLLM(),
        )
    )

    result = asyncio.run(
        write_report_section(
            runtime=runtime,  # type: ignore[arg-type]
            prompt=PromptTemplate.from_template("{scenario_text}"),
            prompt_inputs={"scenario_text": "테스트 시나리오"},
            section_title="timeline",
            task_key="final_report_section.timeline",
            task_label="타임라인 섹션 작성",
            artifact_key="report_timeline_section",
            validator=validate_timeline_section,
        )
    )

    assert "정렬함" in result


def test_render_markdown_table_keeps_header_when_body_is_empty() -> None:
    rendered = render_markdown_table(
        headers=["인물", "최종 결론", "상대/대상", "유불리/상태", "근거 요약"],
        section_body="",
    )

    assert rendered == (
        "| 인물 | 최종 결론 | 상대/대상 | 유불리/상태 | 근거 요약 |\n"
        "| --- | --- | --- | --- | --- |"
    )


def test_build_report_projection_returns_compact_context() -> None:
    projection = build_report_projection(
        {
            "activities": [],
            "observer_reports": [],
            "actors": [],
            "round_index": 2,
            "round_time_history": [
                {
                    "round_index": 1,
                    "total_elapsed_minutes": 30,
                    "total_elapsed_label": "30분",
                },
                {
                    "round_index": 2,
                    "total_elapsed_minutes": 60,
                    "total_elapsed_label": "1시간",
                },
            ],
            "round_focus_history": [],
            "background_updates": [],
            "report_timeline_anchor_json": {
                "anchor_iso": "2027-06-18T03:20:00",
            },
            "final_report": {
                "last_observer_summary": "",
                "notable_events": [],
            },
            "simulation_clock": {
                "total_elapsed_minutes": 60,
                "total_elapsed_label": "1시간",
            },
            "actor_intent_states": [],
            "actor_facing_scenario_digest": {},
            "event_memory": {"events": []},
            "event_memory_history": [
                {
                    "round_index": 2,
                    "source": "resolve_round",
                    "event_updates": [
                        {
                            "event_id": "final-choice",
                            "status": "completed",
                            "progress_summary": "최종 선택이 실행됐다.",
                            "matched_activity_ids": [],
                        }
                    ],
                    "event_memory_summary": {
                        "completed_event_ids": ["final-choice"],
                    },
                    "stop_context": {
                        "requested_stop_reason": "",
                        "effective_stop_reason": "",
                    },
                }
            ],
            "world_state_summary": "",
            "intent_history": [],
        }
    )

    assert '"timeline_highlights"' in projection["report_projection_json"]
    assert '"major_event_outcomes"' in projection["report_projection_json"]
    assert '"major_event_history"' not in projection["report_projection_json"]
    assert '"timeline_anchor":{"anchor_iso":"2027-06-18T03:20:00"}' in projection[
        "report_projection_json"
    ]


def test_build_report_prompt_inputs_compacts_long_scenario_and_summary() -> None:
    prompt_inputs = build_report_prompt_inputs(
        {
            "scenario": "A" * 2_000,
            "final_report": {
                "objective": "긴장 추적",
                "world_summary": "B" * 400,
                "world_state_summary": "C" * 400,
                "elapsed_simulation_label": "1시간",
                "rounds_completed": 4,
                "total_activities": 12,
                "last_observer_summary": "D" * 400,
                "notable_events": ["사건 1", "사건 2"],
                "errors": ["오류 없음"],
            },
            "report_projection_json": '{"summary_context":{}}',
        }
    )
    final_report_payload = json.loads(prompt_inputs["final_report_json"])

    assert len(prompt_inputs["scenario_text"]) < 2_000
    assert final_report_payload["objective"] == "긴장 추적"
    assert final_report_payload["rounds_completed"] == 4


def test_render_and_persist_final_report_omits_actor_results_section() -> None:
    saved: list[dict[str, object]] = []

    class FakeStore:
        def save_final_report(
            self,
            run_id: str,
            final_report: dict[str, object],
        ) -> None:
            saved.append({"run_id": run_id, "final_report": final_report})

    result = render_and_persist_final_report(
        {
            "run_id": "run-1",
            "final_report": {"run_id": "run-1"},
            "llm_usage_summary": {
                "total_calls": 1,
                "structured_calls": 0,
                "text_calls": 1,
                "calls_by_role": {"observer": 1},
                "parse_failures": 0,
                "forced_defaults": 0,
                "input_tokens": 10,
                "output_tokens": 20,
                "total_tokens": 30,
            },
            "report_conclusion_section": "### 최종 상태\n- 유지\n### 핵심 판단 근거\n- 근거",
            "report_timeline_section": "- 2027-06-18 03:20 | 시작 단계 | 사건 | 결과",
            "report_actor_dynamics_section": "### 현재 구도\n- A\n### 관계 변화\n- B",
            "report_major_events_section": "- 사건",
        },
        SimpleNamespace(
            context=SimpleNamespace(
                store=FakeStore(),
                logger=SimpleNamespace(info=lambda *args, **kwargs: None),
            )
        ),  # type: ignore[arg-type]
    )

    assert "## 행위자 별 최종 결과" not in result["final_report_markdown"]
    assert result["final_report_sections"]["actor_results_rows"] == ""
    assert saved == [{"run_id": "run-1", "final_report": {"run_id": "run-1"}}]
