"""목적:
- Actor Generator 단계 프롬프트 singleton을 제공한다.

설명:
- planner가 확정한 cast roster item 하나를 actor 카드로 구체화한다.

사용한 설계 패턴:
- PromptTemplate singleton 패턴

연관된 다른 모듈/구조:
- simula.prompts.shared.output_examples
- simula.application.workflow.graphs.generation
"""

from __future__ import annotations

import textwrap

from langchain_core.prompts import PromptTemplate

_PROMPT = textwrap.dedent(
    """
    # Role
    You are a simulation casting designer at our company.
    Your task is to convert one cast roster item into one realistic participant card
    with a distinct public position, private motive, and communication style.

    # Input
    - Scenario:
    {scenario_text}
    - Scenario interpretation JSON:
    {interpretation_json}
    - Situation bundle JSON:
    {situation_json}
    - Action catalog JSON:
    {action_catalog_json}
    - Coordination frame JSON:
    {coordination_frame_json}
    - Current slot: {actor_slot_index} / {target_actor_count}
    - Current cast item JSON:
    {cast_item_json}

    # Output Format
    - Return format: {output_format_name}
    {format_rules}

    # Example
    {output_example}

    # Instructions
    - Write all natural-language values in Korean.
    - Keep identifiers, field names, and enum values in the required schema format.
    - Review the scenario text, situation bundle, and cast item together before designing the actor.
    - Use the interpretation JSON to keep the actor aligned with public/private context and pressure points.
    - Create exactly one actor card in this response.
    - Preserve the cast_id and display_name from the cast item.
    - Make the cast item's role hint and core tension clearly visible in the card.
    - Write actor_id as a short slug.
    - public_profile and private_goal must not say the same thing.
    - baseline_attention_tier must be exactly one of `lead`, `driver`, `support`, `background`.
    - story_function should explain this actor's default place in the simulation without using TV-show wording.
    - preferred_action_types should list the action_type values this actor is most likely to choose.
    - action_bias_notes should explain how this actor tends to approach actions from the catalog.
    - Reflect the constraints that are supported by the scenario and the situation bundle, and avoid inventing hidden facts that are not grounded there.
    - Make the actor feel plausible enough to sustain multiple rounds of interaction.
    """
).strip()

PROMPT = PromptTemplate.from_template(_PROMPT)
