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
from simula.prompts.shared.user_facing_language import build_user_facing_style_block

_USER_FACING_STYLE = build_user_facing_style_block()

_PROMPT = (
    textwrap.dedent(
        """
    # Role
    You are a simulation planner at our company.
    Your task is to derive the coordination frame that later runtime steps will use
    to decide which focus slices deserve direct simulation attention.

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
    - Keep identifiers, field names, and enum values in the required schema format.
    - focus_selection_rules should explain what kinds of pressure or interaction deserve direct step focus.
    - background_motion_rules should explain which movements may stay indirect and be summarized as background updates.
    - focus_archetypes should describe recurring focus slice patterns this simulation is likely to revisit.
    - attention_shift_rules should explain when quiet actors, newly pressured actors, or secondary actors should move forward.
    - budget_guidance should help runtime choose among multiple plausible slices under a limited actor-call budget.
    """
    ).strip()
    + "\n"
    + _USER_FACING_STYLE
)

PROMPT = PromptTemplate.from_template(_PROMPT)
