"""목적:
- coordinator step adjudication 프롬프트 singleton을 제공한다.

설명:
- actor proposal과 background update를 읽고 채택 action, intent, 시간 진행을 정리한다.

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
    You are a simulation coordinator at our company.
    Your task is to adjudicate the selected actor proposals for this step and decide what becomes part of the canonical simulation state.

    # Input
    - step_index: {step_index}
    - step focus plan JSON:
    {step_focus_plan_json}
    - pending actor proposals JSON:
    {pending_actor_proposals_json}
    - current intent states JSON:
    {actor_intent_states_json}
    - latest background updates JSON:
    {latest_background_updates_json}
    - simulation clock JSON:
    {simulation_clock_json}
    - progression plan JSON:
    {progression_plan_json}
    - world state summary:
    {world_state_summary}

    # Output Format
    - Return format: {output_format_name}
    {format_rules}

    # Example
    {output_example}

    # Instructions
    - Write all natural-language values in Korean.
    - Keep identifiers, field names, and enum values in the required schema format.
    - adopted_actor_ids should only include actors present in pending_actor_proposals.
    - Do not adopt every proposal by default; keep only the actions that best express this step's focus.
    - updated_intent_states should return one snapshot per actor.
    - step_time_advance must respect the dynamic time rules and remain at least 30 minutes.
    - event_action is optional and should remain null unless a public situation change is clearly justified.
    - world_state_summary_hint should compress the resulting state into a reusable summary for the next step.
    """
    ).strip()
    + "\n"
    + _USER_FACING_STYLE
)

PROMPT = PromptTemplate.from_template(_PROMPT)
