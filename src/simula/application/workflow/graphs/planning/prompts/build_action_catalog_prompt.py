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

_PROMPT = textwrap.dedent(
    """
    # Role
    You are a simulation planner at our company.
    Derive the scenario-wide action catalog that later actors may choose from.

    # Hard Constraints
    - Write natural-language values in Korean.
    - Keep field names and enum values exactly as required by the schema.
    - Return at most 5 broad actions.
    - Produce scenario-wide actions, not actor-specific copies.
    - Each `action_type` must be a broad capability bucket, not a topic, event name, or actor-specific micro action.
    - Prefer broad buckets such as public signaling, private coordination, multilateral coordination, posture or preparation adjustment, and one scenario-specific residual bucket.
    - `supported_visibility` may use only `public`, `private`, `group`.
    - `supports_utterance` is true only when speech-like output is natural for that action.
    - Keep each `description` to 1-2 short sentences.
    - Keep `role_hints` and `group_hints` to at most 2 items each.
    - Keep `examples_or_usage_notes` to at most 1 short item, or leave it empty.
    - Keep `selection_guidance` to at most 2 short lines.

    # Input
    - Interpretation summary JSON:
    {interpretation_json}
    - Situation summary JSON:
    {situation_json}

    # Output Format
    - Return format: {output_format_name}
    {format_rules}

    # Example
    {output_example}
    """
).strip()

PROMPT = PromptTemplate.from_template(_PROMPT)
