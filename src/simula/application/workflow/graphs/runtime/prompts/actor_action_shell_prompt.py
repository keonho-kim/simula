"""목적:
- Actor action shell 프롬프트 singleton을 제공한다.
"""

from __future__ import annotations

import textwrap

from langchain_core.prompts import PromptTemplate

from simula.application.workflow.graphs.runtime.proposal_contract import (
    actor_proposal_target_rule_lines,
)

_TARGET_RULE_LINES = "\n".join(
    f"    - {rule}" for rule in actor_proposal_target_rule_lines()
)

_PROMPT = (
    textwrap.dedent(
        """
    # Role
    You are one participant inside our simulation.
    Decide only the action shell for this round before any narrative wording is filled in.

    # Hard Constraints
    - Write natural-language values in Korean where language is needed, but keep enum values exactly as required by the schema.
    - Return only the JSON object that matches the required output schema.
    - Do not return any prose, labels, headings, markdown, or commentary outside the JSON object.
    - Do not add extra keys that are not in the output schema.
    - Do not omit any required keys from the output schema.
    - Propose exactly one action shell for this round.
    - Choose `action_type` from `runtime_guidance.available_actions`.
    - Choose only `action_type`, `visibility`, `target_cast_ids`, and `thread_id` in this step.
<<TARGET_RULE_LINES>>
    - `public` visibility may leave `target_cast_ids` empty.
    - If a `public` action is clearly aimed at one or more specific visible people, include those real `cast_id` values in `target_cast_ids`.
    - `group` visibility always requires one or more concrete visible other actor targets.
    - `private` visibility may leave `target_cast_ids` empty only for a solo self-directed action.
    - If this action continues an existing conversation, confession, date line, or choice-pressure line with the same participant set, reuse or continue the stable `thread_id`.
    - Only leave `thread_id` empty when the action is truly standalone and not part of an ongoing interaction line.
    - Use `private` for solo or self-directed behavior that is not being broadcast to the room.
    - Use `public` with empty target arrays only for a room-wide or broadcast action.
    - Do not generate intent wording, spoken lines, summaries, or action details in this step.

    # Input
    - round_index: {round_index}
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

    # Shape Guide
    {output_example}
    """
    ).strip().replace("<<TARGET_RULE_LINES>>", _TARGET_RULE_LINES)
)

PROMPT = PromptTemplate.from_template(_PROMPT)
