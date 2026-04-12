"""목적:
- coordinator background update 프롬프트 singleton을 제공한다.

설명:
- 이번 step에서 직접 호출하지 않는 actor들의 배경 변화를 압축한다.

사용한 설계 패턴:
- PromptTemplate singleton 패턴
"""

from __future__ import annotations

import textwrap

from langchain_core.prompts import PromptTemplate

_PROMPT = textwrap.dedent(
    """
    # Role
    You are a simulation coordinator at our company.
    Your task is to summarize plausible background state movement for actors who are not directly simulated in this step.

    # Input
    - step_index: {step_index}
    - deferred actors JSON:
    {deferred_actors_json}
    - selected actor ids JSON:
    {selected_actor_ids_json}
    - latest adopted actions JSON:
    {latest_actions_json}
    - latest intent states JSON:
    {actor_intent_states_json}
    - current world state summary:
    {world_state_summary}
    - coordination frame JSON:
    {coordination_frame_json}

    # Output Format
    - Return format: {output_format_name}
    {format_rules}

    # Example
    {output_example}

    # Instructions
    - Write all natural-language values in Korean.
    - Keep identifiers, field names, and enum values in the required schema format.
    - Only include deferred actors whose background motion is worth carrying into the next step.
    - Every `background_updates[]` item must include the current `step_index`.
    - pressure_level must be exactly one of `low`, `medium`, `high`.
    - Do not fabricate detailed off-screen actions; summarize pressure, delay, preparation, or brewing response.
    """
).strip()

PROMPT = PromptTemplate.from_template(_PROMPT)
