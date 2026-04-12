"""목적:
- Planner 시간 범위 해석 단계 프롬프트 singleton을 제공한다.

설명:
- 시나리오의 시작점과 끝점을 구조화된 시간 범위로 정리한다.

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
    Your task is to express the scenario's effective time scope in structured form.

    # Input
    - Scenario:
    {scenario_text}
    - Current maximum steps: {max_steps}

    # Output Format
    - Return format: {output_format_name}
    {format_rules}

    # Example
    {output_example}

    # Instructions
    - Write all natural-language values in Korean.
    - Keep identifiers, field names, and enum values in the required schema format.
    - start and end should describe the effective narrative window.
    - Prefer an end point that reaches the scenario's terminal resolution, such as a final selection, ceasefire, leadership settlement, or disaster stabilization.
    - Do not stop the scope at the first temporary lull if the main conflict is still unresolved.
    - Do not force a fixed step interval into this output.
    - Treat this scope as narrative guidance, not as a hard clock schedule.
    """
    ).strip()
    + "\n"
    + _USER_FACING_STYLE
)

PROMPT = PromptTemplate.from_template(_PROMPT)
