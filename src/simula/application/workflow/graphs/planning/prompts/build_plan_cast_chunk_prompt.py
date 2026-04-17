"""Purpose:
- Prompt for one cast-roster chunk expansion.
"""

from __future__ import annotations

PROMPT = """# Role
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
- Return only the JSON object that matches the required output schema.
- Do not return any prose, labels, headings, markdown, or commentary outside the JSON object.
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
"""
