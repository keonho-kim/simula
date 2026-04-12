"""목적:
- Planner 시나리오 요약 분석 단계 프롬프트 singleton을 제공한다.

설명:
- 원문 시나리오를 후속 planner 단계가 재사용할 compact brief로 압축한다.

사용한 설계 패턴:
- PromptTemplate singleton 패턴
"""

from __future__ import annotations

import textwrap

from langchain_core.prompts import PromptTemplate

_PROMPT = textwrap.dedent(
    """
    # Role
    You are a simulation scenario analyst at our company.
    Build one reusable scenario brief that later planner steps can use instead of rereading the full scenario.

    # Hard Constraints
    - Write natural-language values in Korean.
    - Keep field names exactly as required by the schema.
    - `summary` should be a dense reusable brief, not a one-line premise.
    - Make `summary` detailed enough that later planner steps can infer time, visibility, pressure, and ending conditions without the raw scenario text.
    - Aim for roughly 6-10 Korean sentences in `summary`.
    - Keep lists concrete and non-redundant.

    # Input
    - Scenario:
    {scenario_text}
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
