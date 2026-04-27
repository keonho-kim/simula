"""Purpose:
- Prompt for compact action-catalog planning.
"""

from __future__ import annotations

from textwrap import dedent

from langchain_core.prompts import PromptTemplate

ACTION_CATALOG_EXAMPLE: dict[str, object] = {
    "actions": [
        {
            "action_type": "<short snake_case action identifier>",
            "label": "<1 short Korean action label>",
            "description": "<1 Korean sentence describing the action>",
            "supported_visibility": [
                "<choose one or more of public, private, group>",
            ],
            "requires_target": False,
        },
    ],
}

_PROMPT = dedent("""# Role
You are the planner for a state-driven simulation.

# Goal
Generate only the broad action catalog for this scenario.

# Rules
- Keep the action catalog broad and small.
- Avoid near-duplicate action entries that only rename the same move.
- `actions` must contain at most 5 items.
- Each action must use a unique `action_type`.
- Every field is required.
- Return only the JSON object that matches the required output schema.
- Do not return any prose, labels, headings, markdown, or commentary outside the JSON object.
- Do not add extra keys that are not in the output schema.
- Do not omit any required keys from the output schema.
- If a field is a string, return a JSON string and never wrap it in an array.
- If a field is an array, return a JSON array even when it has only one item.
- Keep actions realistic for the scenario. Prefer concrete human behavior over abstract labels.
- Do not exceed the per-field sentence or item limits shown in the shape guide.

# Input
Scenario text:
{scenario_text}

Planning analysis JSON:
{planning_analysis_json}

# Output
Format:
{output_format_name}

Rules:
{format_rules}

Shape guide:
{output_example}
""".strip())

PROMPT = PromptTemplate.from_template(_PROMPT)
