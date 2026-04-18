"""목적:
- 사용자에게 직접 보이는 자연어 스타일 규칙을 제공한다.

설명:
- planner/observer/finalization처럼 사람이 바로 읽는 출력에만 공통 문체 가이드를 적용한다.

사용한 설계 패턴:
- 공용 스타일 자산 패턴
"""

from __future__ import annotations

import textwrap

_FULL_STYLE_BLOCK = textwrap.dedent(
    """
    - Use short, direct Korean sentences that read easily on first pass.
    - Put the result first when the reader mainly cares about the outcome.
    - Name the subject and the target explicitly whenever possible.
    - Prefer everyday words over analyst jargon.
    - Prefer action verbs over abstract nouns.
    """
).strip()

_FULL_STYLE_BLOCK_WITHOUT_RESULT = textwrap.dedent(
    """
    - Use short, direct Korean sentences that read easily on first pass.
    - Name the subject and the target explicitly whenever possible.
    - Prefer everyday words over analyst jargon.
    - Prefer action verbs over abstract nouns.
    """
).strip()

_COMPACT_STYLE_BLOCK = textwrap.dedent(
    """
    - Use short, direct Korean sentences that read easily on first pass.
    - Put the result first when the reader mainly cares about the outcome.
    """
).strip()

_COMPACT_STYLE_BLOCK_WITHOUT_RESULT = textwrap.dedent(
    """
    - Use short, direct Korean sentences that read easily on first pass.
    """
).strip()


def build_user_facing_style_block(
    *,
    include_result_first: bool = True,
    compact: bool = False,
) -> str:
    """사용자 노출 자연어 스타일 지침 블록을 만든다."""

    if compact:
        if include_result_first:
            return _COMPACT_STYLE_BLOCK
        return _COMPACT_STYLE_BLOCK_WITHOUT_RESULT
    if include_result_first:
        return _FULL_STYLE_BLOCK
    return _FULL_STYLE_BLOCK_WITHOUT_RESULT
