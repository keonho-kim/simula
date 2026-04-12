"""목적:
- Planner 압박/관찰 포인트 해석 단계 프롬프트 singleton을 제공한다.

설명:
- 시나리오의 핵심 압박과 관찰 포인트를 목록으로 정리한다.

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
    Your task is to identify the main pressures and observation points that will matter during execution.

    # Input
    - Scenario brief JSON:
    {scenario_brief_json}

    # Output Format
    - Return format: {output_format_name}
    {format_rules}

    # Example
    {output_example}

    # Instructions
    - Write all natural-language values in Korean.
    - key_pressures and observation_points must both be lists.
    - Focus on reusable execution signals, not on final conclusions.
    """
    ).strip()
    + "\n"
    + _USER_FACING_STYLE
)

PROMPT = PromptTemplate.from_template(_PROMPT)
