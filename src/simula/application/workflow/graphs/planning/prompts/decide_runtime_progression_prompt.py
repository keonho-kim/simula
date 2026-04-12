"""목적:
- Planner 실행 시간 진행 계획 단계 프롬프트 singleton을 제공한다.

설명:
- 시나리오에 맞는 허용 시간 단위와 pacing 규칙을 구조화해 반환한다.

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
    Design the execution time progression plan.

    # Hard Constraints
    - Write natural-language values in Korean.
    - Keep field names and enum values exactly as required by the schema.
    - `allowed_units` must be chosen from `minute`, `hour`, `day`, `week`.
    - `default_unit` is the most common ordinary step unit, not the only allowed one.
    - `max_steps` must exactly match the runtime hard ceiling below.
    - The plan must still allow the simulation to reach terminal resolution within `max_steps`.

    # Input
    - Scenario brief JSON:
    {scenario_brief_json}
    - Core premise:
    {core_premise}
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
