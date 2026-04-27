"""목적:
- finalization 단계가 공통으로 쓰는 섹션 형식 유틸을 제공한다.
"""

from __future__ import annotations

import re


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

