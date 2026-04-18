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
        - Do not change the chosen `action_type`, `visibility`, or `target_cast_ids`. Those are already fixed outside this step.
        - `goal`, `summary`, and `detail` must stay concrete and immediately playable.
        - If no spoken line is needed or plausible, return `utterance` as an empty string.
        - Keep the narrative realistic for the selected visibility and chosen action type.
        - Do not exceed the per-field sentence or item limits shown in the shape guide.

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
