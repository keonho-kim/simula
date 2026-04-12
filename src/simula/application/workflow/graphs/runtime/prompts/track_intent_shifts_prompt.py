"""목적:
- actor intent 추적 프롬프트 singleton을 제공한다.

설명:
- 최신 action과 이전 intent snapshot을 읽고 현재 actor intent 상태를 다시 정리한다.

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
    You are a simulation observer who tracks how each actor's intent evolves.
    Your task is to read the latest actions, compare them with the previous intent snapshots,
    and produce the current actor intent state for this step.

    # Input
    - step_index: {step_index}
    - actors JSON:
    {actors_json}
    - latest actions JSON:
    {latest_actions_json}
    - previous intent states JSON:
    {previous_intent_states_json}
    - action catalog JSON:
    {action_catalog_json}

    # Output Format
    - Return format: {output_format_name}
    {format_rules}

    # Example
    {output_example}

    # Instructions
    - Write all natural-language values in Korean.
    - Keep identifiers, field names, and enum values in the required schema format.
    - Return one current intent snapshot per actor.
    - Actors without a meaningful change may keep their previous intent, but changed_from_previous must reflect the comparison.
    - supporting_action_type should point to the latest action_type that best explains the current intent.
    - confidence should express how clearly the latest step supports this interpretation.
    """
    ).strip()
    + "\n"
    + _USER_FACING_STYLE
)

PROMPT = PromptTemplate.from_template(_PROMPT)
