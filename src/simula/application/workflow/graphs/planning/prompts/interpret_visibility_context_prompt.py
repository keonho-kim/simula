"""목적:
- Planner 공개/비공개 맥락 해석 단계 프롬프트 singleton을 제공한다.

설명:
- 시나리오의 공개 맥락과 비공개 맥락을 각각 목록으로 정리한다.

사용한 설계 패턴:
- PromptTemplate singleton 패턴
"""

from __future__ import annotations

import textwrap

from langchain_core.prompts import PromptTemplate
from simula.prompts.shared.user_facing_language import build_user_facing_style_block

_USER_FACING_STYLE = build_user_facing_style_block()

_PROMPT = (
    textwrap.dedent(
        """
    # Role
    You are a simulation scenario analyst at our company.
    Your task is to separate what is publicly observable from what remains private or hidden in the scenario.

    # Input
    - Scenario:
    {scenario_text}

    # Output Format
    - Return format: {output_format_name}
    {format_rules}

    # Example
    {output_example}

    # Instructions
    - Write all natural-language values in Korean.
    - public_context and private_context must both be lists.
    - Keep each list item concise and reusable.
    """
    ).strip()
    + "\n"
    + _USER_FACING_STYLE
)

PROMPT = PromptTemplate.from_template(_PROMPT)
