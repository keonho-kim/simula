"""목적:
- Planner 상황 확정 단계 프롬프트 singleton을 제공한다.

설명:
- 시나리오 해석 결과를 실행용 상황 번들로 정리한다.

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
    You are a simulation planner at our company.
    Your task is to turn the scenario interpretation into a runnable situation bundle
    for an autonomous, activity-driven simulation.

    # Input
    - Scenario:
    {scenario_text}
    - Scenario interpretation JSON:
    {interpretation_json}
    - Maximum steps: {max_steps}

    # Output Format
    - Return format: {output_format_name}
    {format_rules}

    # Example
    {output_example}

    # Instructions
    - Write all natural-language values in Korean.
    - Keep identifiers, field names, and enum values in the required schema format.
    - Produce a concise but decision-complete situation bundle for later actor generation.
    - current_constraints should describe concrete limits, pressures, or asymmetries present in the scenario.
    """
    ).strip()
    + "\n"
    + _USER_FACING_STYLE
)

PROMPT = PromptTemplate.from_template(_PROMPT)
