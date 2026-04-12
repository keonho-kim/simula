"""목적:
- step별 시간 경과 추론 프롬프트 singleton을 제공한다.

설명:
- 최신 action과 intent 상태를 읽고 이번 step이 실제로 얼마나 진행됐는지 추정한다.

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
    You are a simulation observer who estimates how much simulation time actually passed during the latest step.

    # Input
    - step_index: {step_index}
    - latest step actions JSON:
    {latest_actions_json}
    - current intent states JSON:
    {current_intent_states_json}
    - progression plan JSON:
    {progression_plan_json}
    - previous simulation clock JSON:
    {simulation_clock_json}
    - scenario interpretation JSON:
    {interpretation_json}
    - situation JSON:
    {situation_json}

    # Output Format
    - Return format: {output_format_name}
    {format_rules}

    # Example
    {output_example}

    # Instructions
    - Write all natural-language values in Korean.
    - Keep identifiers, field names, and enum values in the required schema format.
    - elapsed_unit must be one of the units allowed by progression_plan.allowed_units.
    - The normalized elapsed time must be at least 30 minutes.
    - Choose shorter advances for dense conversational or reactive steps.
    - Choose larger advances for waiting, relocation, regrouping, logistical movement, diplomatic cooling, or strategic repositioning.
    - Do not assume every step advances by the same amount of time.
    - selection_reason should explain why this amount feels natural for the latest actions.
    - signals should list 2-4 concrete cues that influenced the decision.
    """
    ).strip()
    + "\n"
    + _USER_FACING_STYLE
)

PROMPT = PromptTemplate.from_template(_PROMPT)
