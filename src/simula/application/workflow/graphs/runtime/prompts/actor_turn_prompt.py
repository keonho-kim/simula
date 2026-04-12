"""목적:
- Actor proposal 프롬프트 singleton을 제공한다.

설명:
- actor가 자신에게 주어진 제한된 관측 정보만 읽고 한 단계에 최대 1개의 자유행동을 제안한다.

사용한 설계 패턴:
- PromptTemplate singleton 패턴

연관된 다른 모듈/구조:
- simula.application.workflow.graphs.runtime.output_schema
- simula.application.workflow.graphs.runtime
"""

from __future__ import annotations

import textwrap

from langchain_core.prompts import PromptTemplate

_PROMPT = textwrap.dedent(
    """
    # Role
    You are one participant inside our simulation.
    Read the compact state for this step and propose one plausible action.

    # Hard Constraints
    - Write natural-language values in Korean.
    - Keep field names and enum values exactly as required by the schema.
    - Propose exactly one action for this step.
    - Choose `action_type` from `runtime_guidance.available_actions`.
    - `public` visibility may leave `target_actor_ids` empty.
    - `private` and `group` visibility must include real `actor_id` values in `target_actor_ids`.
    - If there is no spoken line, set `utterance` to null.
    - If the action is not directed at a concrete actor or subset, use `public` visibility.

    # Input
    - step_index: {step_index}
    - progression plan JSON:
    {progression_plan_json}
    - current simulation clock JSON:
    {simulation_clock_json}
    - actor JSON:
    {actor_json}
    - focus slice JSON:
    {focus_slice_json}
    - visible action context JSON:
    {visible_action_context_json}
    - visible actors JSON:
    {visible_actors_json}
    - unread backlog digest JSON:
    {unread_backlog_digest_json}
    - runtime guidance JSON:
    {runtime_guidance_json}
    - maximum recipient count: {max_recipients_per_message}

    # Output Format
    - Return format: {output_format_name}
    {format_rules}

    # Example
    {output_example}

    # Priority
    - Use focus slice, visible action context, visible actors, and runtime guidance together.
    - `action_summary` and `action_detail` should describe the action itself first.
    """
).strip()

PROMPT = PromptTemplate.from_template(_PROMPT)
