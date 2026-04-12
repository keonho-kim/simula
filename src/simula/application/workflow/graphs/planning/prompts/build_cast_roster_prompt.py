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
    Produce the unique cast roster that the actor generator will later expand.

    # Hard Constraints
    - Write natural-language values in Korean.
    - Keep field names exactly as required by the schema.
    - Return one JSON object with an `items` array.
    - Every `items[]` entry must include `cast_id`, `display_name`, `role_hint`, `group_name`, `core_tension`.
    - `cast_id` and `display_name` must be globally unique within this roster.
    - Do not invent duplicate people with slightly different wording.
    - The roster must be able to plausibly perform the listed actions, not only comment on them.

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
