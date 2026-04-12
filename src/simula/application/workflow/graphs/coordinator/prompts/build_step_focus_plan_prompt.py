"""목적:
- coordinator step focus plan 프롬프트 singleton을 제공한다.

설명:
- 후보 actor pool과 조율 프레임을 읽고 이번 step의 focus slice를 결정한다.

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
    Decide which focus slices deserve direct simulation attention for this step.

    # Hard Constraints
    - Write natural-language values in Korean.
    - Keep field names and enum values exactly as required by the schema.
    - `focus_slices` may be empty, but must not exceed the max focus slice limit.
    - The union of `focus_actor_ids` across slices must not exceed the max actor-call limit.
    - One actor must not appear in more than one slice in the same step.
    - `selected_actor_ids` must match the union of `focus_actor_ids`.
    - `deferred_actor_ids` must include candidate actors not selected for direct simulation.

    # Input
    - step_index: {step_index}
    - candidate actors JSON:
    {focus_candidates_json}
    - coordination frame JSON:
    {coordination_frame_json}
    - situation bundle JSON:
    {situation_json}
    - simulation clock JSON:
    {simulation_clock_json}
    - previous observer summary:
    {previous_observer_summary}
    - max focus slices per step: {max_focus_slices_per_step}
    - max actor calls per step: {max_actor_calls_per_step}

    # Output Format
    - Return format: {output_format_name}
    {format_rules}

    # Example
    {output_example}

    # Priority
    - Prioritize continuity, direct pressure, unresolved tension, and meaningful state change.
    """
).strip()

PROMPT = PromptTemplate.from_template(_PROMPT)
