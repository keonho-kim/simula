"""목적:
- Planner action catalog 단계 프롬프트 singleton을 제공한다.

설명:
- 상황 번들과 시나리오 해석을 바탕으로 scenario 전역 action catalog를 만든다.

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
    Your task is to derive a scenario-wide action catalog that later actors can choose from.

    # Input
    - Scenario:
    {scenario_text}
    - Scenario interpretation JSON:
    {interpretation_json}
    - Situation bundle JSON:
    {situation_json}

    # Output Format
    - Return format: {output_format_name}
    {format_rules}

    # Example
    {output_example}

    # Instructions
    - Write all natural-language values in Korean.
    - Keep identifiers, field names, and enum values in the required schema format.
    - Produce scenario-wide actions, not actor-specific copies.
    - Each action_type must describe a meaningful action, not a topic or mood.
    - `speech` must be treated as one possible action, not the default center of the simulation.
    - Include both conversational and non-conversational actions when the scenario supports them.
    - role_hints and group_hints should help later filtering, but they do not need to be exhaustive.
    - supported_visibility must only use `public`, `private`, `group`.
    - requires_target should reflect whether the action normally needs a direct target.
    - supports_utterance should be true only when speech or a speech-like output can naturally appear.
    """
    ).strip()
    + "\n"
    + _USER_FACING_STYLE
)

PROMPT = PromptTemplate.from_template(_PROMPT)
