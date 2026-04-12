"""목적:
- Actor proposal 프롬프트 singleton을 제공한다.

설명:
- actor가 자신에게 주어진 제한된 관측 정보만 읽고 한 단계에 최대 1개의 자유행동을 제안한다.

사용한 설계 패턴:
- PromptTemplate singleton 패턴

연관된 다른 모듈/구조:
- simula.prompts.shared.output_examples
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

    # Instructions
    - Write all natural-language values in Korean.
    - Keep identifiers, field names, and enum values in the required schema format.
    - Propose exactly one action for this step.
    - Choose action_type from the available actions provided in runtime guidance.
    - The action may be conversational, observational, strategic, operational, or passive.
    - `발화`는 optional 결과다. 말하지 않는 action이면 utterance는 빈 문자열이 아니라 null로 둬라.
    - public visibility may leave target_actor_ids empty.
    - private and group visibility must include real actor_id values in target_actor_ids.
    - If the action is not directed at a concrete actor or actor subset, do not choose private/group. Use public visibility instead.
    - Use focus slice, visible action context, visible actors, and runtime guidance together.
    - previous_observer_momentum is a rough speed signal, and previous_observer_atmosphere is a tone signal.
    - action_summary와 action_detail은 액션 자체를 먼저 설명하고, 발화가 있다면 utterance에 따로 적어라.
    """
).strip()

PROMPT = PromptTemplate.from_template(_PROMPT)
