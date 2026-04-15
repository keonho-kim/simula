"""목적:
- finalization 단계가 공통으로 쓰는 섹션 유틸을 제공한다.

설명:
- 최종 보고서 프롬프트 입력 조립, 섹션 형식 검증, 재생성 제어를 담당한다.

사용한 설계 패턴:
- shared utility 패턴
"""

from __future__ import annotations

import json
import re
from collections.abc import Callable

from langchain_core.prompts import PromptTemplate
from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationWorkflowState,
)
from simula.application.workflow.utils.prompt_projections import truncate_text


def build_report_prompt_inputs(
    state: SimulationWorkflowState,
) -> dict[str, str]:
    """최종 보고서 프롬프트 공통 입력을 만든다."""

    return {
        "scenario_text": truncate_text(state["scenario"], 1_600),
        "final_report_json": json.dumps(
            _build_compact_final_report_summary(state),
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        "report_projection_json": str(state.get("report_projection_json", "{}")),
    }


def normalize_final_report_sections(sections: dict[str, object]) -> dict[str, object]:
    """Normalize final report sections to the validator's exact shape."""

    normalized = dict(sections)
    normalized["conclusion_section"] = normalize_conclusion_section(
        str(sections.get("conclusion_section", ""))
    )
    normalized["major_events_section"] = normalize_bullet_only_section(
        str(sections.get("major_events_section", ""))
    )
    normalized["timeline_section"] = normalize_timeline_section(
        str(sections.get("timeline_section", ""))
    )
    normalized["actor_dynamics_section"] = normalize_actor_dynamics_section(
        str(sections.get("actor_dynamics_section", ""))
    )
    normalized["actor_results_rows"] = normalize_markdown_table_rows(
        str(sections.get("actor_results_rows", ""))
    )
    return normalized


async def write_report_section(
    *,
    runtime: Runtime[WorkflowRuntimeContext],
    prompt: PromptTemplate,
    prompt_inputs: dict[str, str],
    section_title: str,
    validator: Callable[[str], str | None] | None = None,
    normalizer: Callable[[str], str] | None = None,
) -> str:
    """observer를 호출해 보고서 섹션 본문을 작성한다."""

    feedback: str | None = None
    for attempt in range(2):
        rendered_prompt = prompt.format(**prompt_inputs)
        if feedback:
            rendered_prompt += (
                "\n\n# Retry Notice\n"
                f"- 이전 출력은 형식 검증에 실패했다: {feedback}\n"
                "- 전체 내용을 처음부터 다시 쓰고, 형식 요구사항을 정확히 지켜라.\n"
            )
        section_body, _ = await runtime.context.llms.ainvoke_text_with_meta(
            "observer",
            rendered_prompt,
            log_context={
                "scope": "final-report",
                "section": section_title,
                "attempt": attempt + 1,
            },
        )
        normalized_body = section_body.strip()
        if normalizer is not None:
            normalized_body = normalizer(normalized_body)
        if validator is None:
            feedback = None
        else:
            feedback = validator(normalized_body)
        if feedback is None:
            return normalized_body

    raise ValueError(f"{section_title} 섹션 형식 검증에 두 번 실패했습니다: {feedback}")


def assemble_body_sections_markdown(report_body_sections: list[dict[str, str]]) -> str:
    """본론 섹션 리스트를 markdown 문자열로 조립한다."""

    return "\n\n".join(
        f"## {section['title']}\n\n{section['body']}".strip()
        for section in report_body_sections
    )


def validate_bullet_section(
    section_body: str,
    *,
    min_items: int,
    max_items: int | None = None,
) -> str | None:
    """bullet 전용 섹션 형식을 검증한다."""

    lines = [line.strip() for line in section_body.splitlines() if line.strip()]
    if len(lines) < min_items:
        return f"bullet 수는 최소 {min_items}개여야 합니다."
    if max_items is not None and len(lines) > max_items:
        return f"bullet 수는 최대 {max_items}개여야 합니다."
    if any(not line.startswith("- ") for line in lines):
        return "모든 줄은 '- '로 시작하는 bullet이어야 합니다."
    return None


def normalize_conclusion_section(section_body: str) -> str:
    """Normalize conclusion headings and bullet lines without changing meaning."""

    parsed = _parse_subheaded_sections(
        section_body,
        ["### 최종 상태", "### 핵심 판단 근거"],
    )
    if isinstance(parsed, str):
        return section_body.strip()

    blocks: list[str] = []
    for heading in ("### 최종 상태", "### 핵심 판단 근거"):
        lines = _normalize_bullet_lines(parsed.get(heading, []))
        blocks.append(heading)
        blocks.extend(lines)
    return "\n".join(blocks).strip()


def normalize_bullet_only_section(section_body: str) -> str:
    """Normalize a section so every non-empty line is a bullet."""

    lines = [line.strip() for line in section_body.splitlines() if line.strip()]
    return "\n".join(_normalize_bullet_lines(lines)).strip()


def normalize_timeline_section(section_body: str) -> str:
    """Normalize timeline lines to bullet-prefixed rows."""

    lines = [line.strip() for line in section_body.splitlines() if line.strip()]
    normalized: list[str] = []
    for line in lines:
        if line.startswith("- "):
            normalized.append(line)
            continue
        normalized.append(f"- {line}")
    return "\n".join(normalized).strip()


def normalize_actor_dynamics_section(section_body: str) -> str:
    """Normalize actor dynamics subheadings so each body line becomes a bullet."""

    parsed = _parse_subheaded_sections(
        section_body,
        ["### 현재 구도", "### 관계 변화"],
    )
    if isinstance(parsed, str):
        return section_body.strip()

    blocks: list[str] = []
    for heading in ("### 현재 구도", "### 관계 변화"):
        lines = _normalize_bullet_lines(parsed.get(heading, []))
        blocks.append(heading)
        blocks.extend(lines)
    return "\n".join(blocks).strip()


def normalize_markdown_table_rows(section_body: str) -> str:
    """Drop accidental markdown table headers and keep only body rows."""

    lines = [line.strip() for line in section_body.splitlines() if line.strip()]
    if len(lines) >= 2 and _is_markdown_table_separator(lines[1]):
        lines = lines[2:]
    return "\n".join(lines).strip()


def validate_conclusion_section(section_body: str) -> str | None:
    """결론 섹션의 소제목과 bullet 구조를 검증한다."""

    return validate_subheaded_bullet_section(
        section_body,
        headings=["### 최종 상태", "### 핵심 판단 근거"],
        min_items=2,
    )


def validate_timeline_section(section_body: str) -> str | None:
    """타임라인 bullet 형식을 검증한다."""

    # Prompt line-count ranges are quality guidance. Validation only enforces the
    # minimum safe shape needed for downstream rendering and report consistency.
    error = validate_bullet_section(section_body, min_items=1)
    if error is not None:
        return error

    pattern = re.compile(r"^- \d{4}-\d{2}-\d{2} \d{2}:\d{2} \| .+ \| .+ \| .+$")
    for line in [line.strip() for line in section_body.splitlines() if line.strip()]:
        if not pattern.match(line):
            return (
                "타임라인 각 줄은 '- YYYY-MM-DD HH:mm | 국면 | 핵심 이벤트 | 결과/파급' "
                "형식을 따라야 합니다."
            )
    return None


def validate_actor_dynamics_section(section_body: str) -> str | None:
    """행위자 역학 관계 섹션의 소제목 구조를 검증한다."""

    return validate_subheaded_bullet_section(
        section_body,
        headings=["### 현재 구도", "### 관계 변화"],
        min_items=2,
    )


def validate_markdown_table_rows(
    section_body: str,
) -> str | None:
    """헤더 없는 markdown 표 본문 행 형식을 검증한다."""

    lines = [line.strip() for line in section_body.splitlines() if line.strip()]
    if not lines:
        return None
    if any(not line.startswith("|") or not line.endswith("|") for line in lines):
        return "표 본문은 각 줄이 '|'로 시작하고 끝나야 합니다."
    for line in lines:
        cells = [cell.strip() for cell in line.split("|")[1:-1]]
        if len(cells) != 5:
            return "표 본문 각 행은 정확히 5개 셀을 가져야 합니다."
        if any(not cell for cell in cells):
            return "표 본문 셀은 비어 있으면 안 됩니다."
    return None


def render_markdown_table(
    *,
    headers: list[str],
    section_body: str,
) -> str:
    """표 헤더와 본문 행을 합쳐 markdown 표로 만든다."""

    header_row = "| " + " | ".join(headers) + " |"
    separator_row = "| " + " | ".join("---" for _ in headers) + " |"
    body_rows = "\n".join(
        line.strip() for line in section_body.splitlines() if line.strip()
    )
    return f"{header_row}\n{separator_row}\n{body_rows}".strip()


def prepend_subheading(*, subheading: str, body: str) -> str:
    """고정 소제목과 본문을 결합한다."""

    return f"### {subheading}\n\n{body.strip()}".strip()


def _build_compact_final_report_summary(
    state: SimulationWorkflowState,
) -> dict[str, object]:
    final_report = state.get("final_report", {})
    if not isinstance(final_report, dict):
        return {}

    def _safe_int(value: object) -> int:
        try:
            return int(str(value))
        except (TypeError, ValueError):
            return 0

    return {
        "objective": truncate_text(final_report.get("objective", ""), 180),
        "world_summary": truncate_text(final_report.get("world_summary", ""), 220),
        "world_state_summary": truncate_text(
            final_report.get("world_state_summary", ""),
            220,
        ),
        "elapsed_simulation_label": str(
            final_report.get("elapsed_simulation_label", "")
        ),
        "rounds_completed": _safe_int(final_report.get("rounds_completed", 0)),
        "total_activities": _safe_int(final_report.get("total_activities", 0)),
        "last_observer_summary": truncate_text(
            final_report.get("last_observer_summary", ""),
            220,
        ),
        "notable_events": [
            truncate_text(item, 120)
            for item in final_report.get("notable_events", [])
            if str(item).strip()
        ][:5],
        "errors": [
            truncate_text(item, 120)
            for item in final_report.get("errors", [])
            if str(item).strip()
        ][:4],
    }


def validate_subheaded_bullet_section(
    section_body: str,
    *,
    headings: list[str],
    min_items: int,
    max_items: int | None = None,
) -> str | None:
    """소제목 아래 bullet만 허용되는 섹션 형식을 검증한다."""

    parsed = _parse_subheaded_sections(section_body, headings)
    if isinstance(parsed, str):
        return parsed

    bullet_count = 0
    for heading, lines in parsed.items():
        if not lines:
            return f"{heading} 아래에는 bullet이 최소 1개 필요합니다."
        for line in lines:
            if not line.startswith("- "):
                return f"{heading} 아래 모든 줄은 '- '로 시작해야 합니다."
            bullet_count += 1

    if bullet_count < min_items:
        return f"전체 bullet 수는 최소 {min_items}개여야 합니다."
    if max_items is not None and bullet_count > max_items:
        return f"전체 bullet 수는 최대 {max_items}개여야 합니다."
    return None


def validate_subheaded_text_section(
    section_body: str,
    *,
    headings: list[str],
) -> str | None:
    """소제목 아래 자유 서술이 들어가는 섹션 형식을 검증한다."""

    parsed = _parse_subheaded_sections(section_body, headings)
    if isinstance(parsed, str):
        return parsed

    for heading, lines in parsed.items():
        if not lines:
            return f"{heading} 아래에는 본문이 필요합니다."
        if any(line.startswith("- ") for line in lines):
            return f"{heading} 아래에는 bullet이 아니라 짧은 문단을 써야 합니다."
    return None


def _parse_subheaded_sections(
    section_body: str,
    headings: list[str],
) -> dict[str, list[str]] | str:
    lines = [line.strip() for line in section_body.splitlines() if line.strip()]
    if not lines:
        return "본문이 비어 있습니다."

    expected_index = 0
    current_heading: str | None = None
    sections = {heading: [] for heading in headings}

    for line in lines:
        if line.startswith("### "):
            if expected_index >= len(headings):
                return "허용되지 않은 소제목이 포함되어 있습니다."
            expected_heading = headings[expected_index]
            if line != expected_heading:
                return f"소제목 순서는 {' -> '.join(headings)} 이어야 합니다."
            current_heading = line
            expected_index += 1
            continue
        if current_heading is None:
            return "소제목 없이 시작할 수 없습니다."
        sections[current_heading].append(line)

    if expected_index != len(headings):
        return f"소제목은 {' -> '.join(headings)} 모두 포함해야 합니다."
    return sections


def _normalize_bullet_lines(lines: list[str]) -> list[str]:
    normalized: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("- "):
            normalized.append(stripped)
            continue
        normalized.append(f"- {stripped.lstrip('-* ').strip()}")
    return normalized


def _is_markdown_table_separator(line: str) -> bool:
    stripped = line.strip()
    if not stripped.startswith("|") or not stripped.endswith("|"):
        return False
    cells = [cell.strip() for cell in stripped.split("|")[1:-1]]
    if not cells:
        return False
    return all(cell.replace("-", "").replace(":", "") == "" for cell in cells)
