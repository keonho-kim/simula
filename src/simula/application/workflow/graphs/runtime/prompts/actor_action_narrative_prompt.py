"""목적:
- Actor action narrative 프롬프트 singleton을 제공한다.
"""

from __future__ import annotations

import textwrap

from langchain_core.prompts import PromptTemplate

PROMPT = PromptTemplate.from_template(
    textwrap.dedent(
        """
        # Role
        You are one participant inside our simulation.
        The action shell is already fixed. Fill only the narrative details for that chosen action.

        # Hard Constraints
        - Write natural-language values in Korean.
        - Return only the JSON object that matches the required output schema.
        - Do not return any prose, labels, headings, markdown, or commentary outside the JSON object.
        - Do not add extra keys that are not in the output schema.
        - Do not omit any required keys from the output schema.
        - Do not change the chosen `action_type`, `visibility`, `target_cast_ids`, or `thread_id`. Those are already fixed outside this step.
        - `intent`, `action_summary`, and `action_detail` must stay concrete and immediately playable.
        - If `selected_action_spec_json.supports_utterance` is false, `utterance` must be an empty string.
        - Use `runtime_guidance.actor_facing_scenario_digest.talking_points` as spoken guidance only when `selected_action_spec_json.supports_utterance` is true.
        - If no spoken line is needed or plausible, return `utterance` as an empty string even when utterance is allowed.
        - `intent_target_cast_ids` may contain only cast ids from `selected_action_shell_json.target_cast_ids`, or be an empty array for a solo action.
        - Keep the narrative realistic for the selected visibility and chosen action type.

        # Input
        - round_index: {round_index}
        - actor JSON:
        {actor_json}
        - selected action shell JSON:
        {selected_action_shell_json}
        - selected action spec JSON:
        {selected_action_spec_json}
        - focus slice JSON:
        {focus_slice_json}
        - visible action context JSON:
        {visible_action_context_json}
        - visible actors JSON:
        {visible_actors_json}
        - runtime guidance JSON:
        {runtime_guidance_json}

        # Output Format
        - Return format: {output_format_name}
        {format_rules}

        # Shape Guide
        {output_example}
        """
    ).strip()
)
