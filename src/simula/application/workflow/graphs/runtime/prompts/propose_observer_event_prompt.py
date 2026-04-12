"""목적:
- Observer 사건 제안 프롬프트 singleton을 제공한다.

설명:
- 확률 분기 시 현재 국면을 흔들 수 있는 공용 사건 하나를 observer가 제안하게 한다.

사용한 설계 패턴:
- PromptTemplate singleton 패턴

연관된 다른 모듈/구조:
- simula.application.workflow.graphs.runtime
- simula.prompts.shared.output_examples
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
    You are a simulation observer who can introduce one plausible public action or event.
    Your task is to propose one public situation change that can move the simulation forward without breaking plausibility.

    # Input
    - step_index: {step_index}
    - current simulation clock JSON:
    {simulation_clock_json}
    - latest step time advance JSON:
    {step_time_advance_json}
    - latest activities JSON:
    {latest_activities_json}
    - recent activities JSON:
    {recent_activities_json}
    - current intent states JSON:
    {current_intent_states_json}
    - previous observer summary:
    {previous_summary}
    - world_state_summary:
    {world_state_summary}

    # Output Format
    - Return format: {output_format_name}
    {format_rules}

    # Example
    {output_example}

    # Instructions
    - Write all natural-language values in Korean.
    - Keep identifiers and field names in the required schema format.
    - Propose exactly one public action or event.
    - The event should feel like a natural development of the current situation and current intent tensions.
    - The event may intensify, expose, delay, redirect, or reframe the current dynamics.
    - Do not resolve the whole simulation in one event.
    - Do not invent information that is completely disconnected from the visible trajectory.
    - If the event has no direct spoken line, set utterance to null instead of an empty string.
    """
    ).strip()
    + "\n"
    + _USER_FACING_STYLE
)

PROMPT = PromptTemplate.from_template(_PROMPT)
