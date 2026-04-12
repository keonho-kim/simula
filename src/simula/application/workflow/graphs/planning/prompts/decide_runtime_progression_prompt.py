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
from simula.prompts.shared.user_facing_language import build_user_facing_style_block

_USER_FACING_STYLE = build_user_facing_style_block()

_PROMPT = (
    textwrap.dedent(
        """
    # Role
    You are a simulation planner at our company.
    Your task is to design the execution time progression plan that keeps the scenario realistic while preserving meaningful intermediate states.

    # Instructions
    - Write all natural-language values in Korean.
    - Keep identifiers, field names, and enum values in the required schema format.
    - Write all natural-language values in Korean.
    - Keep identifiers, field names, and enum values in the required schema format.
    - allowed_units must be chosen from `minute`, `hour`, `day`, `week`.
    - You may include multiple units when the scenario naturally alternates between short conversational beats and larger operational jumps.
    - default_unit should be the most common unit for ordinary steps, not the only allowed one.
    - Do not assume that every step advances by the same amount of time.
    - max_steps must match the runtime hard ceiling shown below.
    - The pacing plan must still allow the simulation to reach the scenario's terminal resolution within max_steps.
    - Use larger time jumps after clear turning points instead of ending early at a short local lull.
    - pacing_guidance should explain when short steps are appropriate and when larger jumps are appropriate.
    - selection_reason should explain why this progression plan keeps the simulation believable and readable.
    
    # Input
    - Scenario:
    {scenario_text}
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
    + "\n"
    + _USER_FACING_STYLE
)

PROMPT = PromptTemplate.from_template(_PROMPT)
