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

_PROMPT = textwrap.dedent(
    """
    # Role
    You are a simulation planner at our company.
    Turn the interpretation into one runnable situation bundle.

    # Hard Constraints
    - Write natural-language values in Korean.
    - Keep field names and enum values exactly as required by the schema.
    - Return one compact, decision-complete situation bundle.
    - `current_constraints` must describe concrete limits, pressures, or asymmetries.

    # Input
    - Interpretation summary JSON:
    {interpretation_json}
    - Runtime max steps:
    {max_steps}

    # Output Format
    - Return format: {output_format_name}
    {format_rules}

    # Example
    {output_example}
    """
).strip()

PROMPT = PromptTemplate.from_template(_PROMPT)
