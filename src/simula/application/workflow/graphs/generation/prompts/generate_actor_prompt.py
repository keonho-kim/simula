"""목적:
- Actor Generator 단계 프롬프트 singleton을 제공한다.

설명:
- planner가 확정한 cast roster item 하나를 actor 카드로 구체화한다.

사용한 설계 패턴:
- PromptTemplate singleton 패턴

연관된 다른 모듈/구조:
- simula.application.workflow.graphs.generation.output_schema
- simula.application.workflow.graphs.generation
"""

from __future__ import annotations

import textwrap

from langchain_core.prompts import PromptTemplate

_PROMPT = textwrap.dedent(
    """
    # Role
    You are a simulation casting designer at our company.
    Convert one cast roster item into one realistic participant card.

    # Hard Constraints
    - Write natural-language values in Korean.
    - Keep field names and enum values exactly as required by the schema.
    - Return only the JSON object that matches the required output schema.
    - Do not return any prose, labels, headings, markdown, or commentary outside the JSON object.
    - Do not add extra keys that are not in the output schema.
    - Do not omit any required keys from the output schema.
    - If a field is a string, return a JSON string and never wrap it in an array.
    - If a field is an array, return a JSON array even when it has only one item.
    - Create exactly one actor card.
    - `baseline_attention_tier` must be one of `lead`, `driver`, `support`, `background`.
    - `public_profile` and `private_goal` must not say the same thing.
    - Identity fields are fixed by the system. Do not invent new ids, names, or groups.
    - Make the cast item's `role_hint` and `core_tension` clearly visible in the card.

    # Input
    - Interpretation summary JSON:
    {interpretation_json}
    - Situation summary JSON:
    {situation_json}
    - Action catalog summary JSON:
    {action_catalog_json}
    - Coordination frame summary JSON:
    {coordination_frame_json}
    - Requested cast count: {requested_num_cast}
    - Allow additional cast beyond the requested count: {allow_additional_cast}
    - Current slot: {actor_slot_index} / {target_actor_count}
    - Current cast item JSON:
    {cast_item_json}

    # Output Format
    - Return format: {output_format_name}
    {format_rules}

    # Shape Guide
    {output_example}
    """
).strip()

PROMPT = PromptTemplate.from_template(_PROMPT)
