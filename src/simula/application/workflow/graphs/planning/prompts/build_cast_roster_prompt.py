"""목적:
- Planner 등장인물 roster 단계 프롬프트 singleton을 제공한다.

설명:
- 상황 번들을 바탕으로 unique cast roster를 NDJSON으로 생성한다.

사용한 설계 패턴:
- PromptTemplate singleton 패턴
"""

from __future__ import annotations

import textwrap

from langchain_core.prompts import PromptTemplate

_PROMPT = textwrap.dedent(
    """
    # Role
    You are a simulation casting planner at our company.
    Your task is to produce the unique cast roster that the actor generator will later expand.

    # Input
    - Scenario:
    {scenario_text}
    - Scenario interpretation JSON:
    {interpretation_json}
    - Situation bundle JSON:
    {situation_json}
    - Action catalog JSON:
    {action_catalog_json}

    # Output Format
    - Return format: {output_format_name}
    {format_rules}

    # Example
    {output_example}

    # Instructions
    - Write all natural-language values in Korean.
    - Output NDJSON only.
    - Every line must be one valid JSON object.
    - display_name and cast_id must be globally unique within this roster.
    - Do not invent duplicate people with slightly different wording.
    - Produce exactly the cast roster needed to express the situation bundle.
    - Make sure the roster can plausibly perform the action catalog, not only talk about it.
    """
).strip()

PROMPT = PromptTemplate.from_template(_PROMPT)
