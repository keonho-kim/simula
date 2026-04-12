"""목적:
- 사용자에게 직접 보이는 자연어 스타일 규칙을 제공한다.

설명:
- planner/observer/finalization처럼 사람이 바로 읽는 출력에만 공통 문체 가이드를 적용한다.

사용한 설계 패턴:
- 공용 스타일 자산 패턴
"""

from __future__ import annotations

import re

_BASE_STYLE_LINES = [
    "Use short, direct Korean sentences that read easily on first pass.",
    "Name the subject and the target explicitly whenever possible.",
    "Prefer everyday words over analyst jargon.",
    "Prefer action verbs over abstract nouns.",
    "Avoid expressions such as `~축`, `수렴`, `정렬`, `재편`, `재배치`, `허브`, `다이내믹`, `텍스처` unless the scenario text clearly requires them.",
]

_RESULT_FIRST_LINE = (
    "Put the result first when the reader mainly cares about the outcome."
)

FORBIDDEN_USER_FACING_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("`~축` 표현", re.compile(r"(?:보조|중심|핵심|조정|관계|주도|영향)\s*축")),
    ("`수렴`", re.compile(r"수렴")),
    ("`정렬`", re.compile(r"정렬")),
    ("`재편`", re.compile(r"재편")),
    ("`재배치`", re.compile(r"재배치")),
    ("`허브`", re.compile(r"허브")),
    ("`다이내믹`", re.compile(r"다이내믹")),
    ("`텍스처`", re.compile(r"텍스처")),
)


def build_user_facing_style_block(
    *,
    include_result_first: bool = True,
    compact: bool = False,
) -> str:
    """사용자 노출 자연어 스타일 지침 블록을 만든다."""

    if compact:
        lines = [
            _BASE_STYLE_LINES[0],
            _RESULT_FIRST_LINE,
        ]
        if not include_result_first:
            lines = [_BASE_STYLE_LINES[0]]
    else:
        lines = list(_BASE_STYLE_LINES)
        if include_result_first:
            lines.insert(1, _RESULT_FIRST_LINE)
    return "\n".join(f"- {line}" for line in lines)


def find_forbidden_user_facing_term(
    *,
    text: str,
    scenario_text: str,
) -> str | None:
    """금지어가 있는지 확인하고 첫 위반 항목을 반환한다."""

    for label, pattern in FORBIDDEN_USER_FACING_PATTERNS:
        if pattern.search(text) and not pattern.search(scenario_text):
            return label
    return None
