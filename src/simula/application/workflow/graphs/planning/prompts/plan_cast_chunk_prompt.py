"""Purpose:
- Prompt for one cast-roster chunk expansion.
"""

from __future__ import annotations

from textwrap import dedent

from langchain_core.prompts import PromptTemplate

PLAN_CAST_CHUNK_ITEM_EXAMPLE: dict[str, object] = {
    "cast_id": "<stable snake_case or kebab-case cast identifier>",
    "display_name": "<1 short participant name or role label grounded in the scenario>",
    "role_hint": "<1 short Korean role hint>",
    "group_name": "<1 short team, camp, faction, or participant group name>",
    "core_tension": "<1 Korean sentence describing this actor's core tension>",
}

_PROMPT = dedent("""# Role
You are the planner for a state-driven simulation.

# Goal
Expand the assigned cast outline items into complete cast roster items for this chunk only.

# Rules
- Return only the cast items for `assigned_outline_json.items`.
- Return exactly the same number of items as `assigned_outline_json.items`.
- Do not add any cast outside the assigned chunk.
- Reuse each assigned `cast_id` and `display_name` exactly as provided.
- Keep each item realistic and grounded in the scenario text.
- `group_name` must be concise and scenario-grounded.
- `role_hint` and `core_tension` must be concrete, not analytical labels.
- Every field is required.
- Return only the JSON array that matches the required output schema.
- Do not return any prose, labels, headings, markdown, or commentary outside the JSON array.
- Do not add extra keys that are not in the output schema.
- Do not omit any required keys from the output schema.
- If a field is an array, return a JSON array even when it has only one item.

# Input
Scenario text:
{scenario_text}

Planning analysis JSON:
{planning_analysis_json}

Execution plan frame JSON:
{execution_plan_frame_json}

Assigned outline JSON:
{assigned_outline_json}

# Output
Format:
{output_format_name}

Rules:
{format_rules}

Shape guide:
{output_example}
""".strip())

PROMPT = PromptTemplate.from_template(_PROMPT)
