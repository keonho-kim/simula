"""목적:
- Planner coordinator frame 단계 프롬프트 singleton을 제공한다.

설명:
- 시나리오에서 어떤 actor와 압력이 전면으로 떠오를지를 조율하는 기준을 만든다.

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
    Derive the coordination frame that runtime will use to choose direct focus slices.

    # Hard Constraints
    - Write natural-language values in Korean.
    - Keep field names and enum values exactly as required by the schema.
    - `focus_selection_rules` must describe what deserves direct focus now.
    - `background_motion_rules` must describe what may stay indirect.
    - `attention_shift_rules` must explain when quieter or newly pressured actors move forward.
    - `budget_guidance` must help runtime choose under a limited actor-call budget.

    # Input
    - Interpretation summary JSON:
    {interpretation_json}
    - Situation summary JSON:
    {situation_json}
    - Action catalog summary JSON:
    {action_catalog_json}

    # Output Format
    - Return format: {output_format_name}
    {format_rules}

    # Example
    {output_example}
    """
).strip()

PROMPT = PromptTemplate.from_template(_PROMPT)
