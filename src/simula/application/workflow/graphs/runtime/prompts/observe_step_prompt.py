"""목적:
- Observer 단계 프롬프트 singleton을 제공한다.

설명:
- observer가 단계 activity를 읽고 요약과 다음 단계용 상태 요약을 만든다.

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
    You are a simulation observer at our company.
    Your task is to read the latest step actions and current intent states,
    then summarize what changed in the simulation and how momentum is evolving.

    # Input
    - step_index: {step_index}
    - current simulation clock JSON:
    {simulation_clock_json}
    - latest step time advance JSON:
    {step_time_advance_json}
    - latest step actions JSON:
    {latest_activities_json}
    - recent actions JSON:
    {recent_activities_json}
    - current intent states JSON:
    {current_intent_states_json}
    - recent intent history JSON:
    {recent_intent_history_json}
    - latest background updates JSON:
    {latest_background_updates_json}
    - previous summary:
    {previous_summary}
    - current world state summary:
    {world_state_summary}

    # Output Format
    - Return format: {output_format_name}
    {format_rules}

    # Example
    {output_example}

    # Instructions
    - Write all natural-language values in Korean.
    - Keep identifiers, field names, and enum values in the required schema format.
    - momentum must be exactly one of `high`, `medium`, `low`.
    - Do not translate momentum into Korean words such as `높음`, `보통`, `낮음`.
    - Summarize what changed in this step, not the entire history.
    - notable_events should list concrete action or intent developments from the latest step.
    - atmosphere should capture the step's dominant tone in short Korean.
    - momentum is a rough speed signal for the current phase, not a final judgment.
    - world_state_summary should compress the current world state into a reusable summary for the next step.
    """
    ).strip()
    + "\n"
    + _USER_FACING_STYLE
)

PROMPT = PromptTemplate.from_template(_PROMPT)
