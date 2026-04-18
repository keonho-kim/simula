"""Purpose:
- Prompt for compact coordination-frame planning.
"""

from __future__ import annotations

PROMPT = """# Role
You are the planner for a state-driven simulation.

# Goal
Generate only the compact runtime coordination policy for this scenario.

# Rules
- Every field is required.
- Keep each rule concrete and scenario-grounded.
- `focus_policy` and `background_policy` must be non-empty Korean strings.
- `max_focus_actors` must be a small positive integer that fits this scenario.
- Return only the JSON object that matches the required output schema.
- Do not return any prose, labels, headings, markdown, or commentary outside the JSON object.
- Do not add extra keys that are not in the output schema.
- Do not omit any required keys from the output schema.
- If a field is a string, return a JSON string and never wrap it in an array.
- If a field is an array, return a JSON array even when it has only one item.
- Do not exceed the per-field sentence or item limits shown in the shape guide.
- Keep the frame realistic for the scenario and cast roster outline.

# Input
Scenario text:
{scenario_text}

Planning analysis JSON:
{planning_analysis_json}

Cast roster outline JSON:
{cast_roster_outline_json}

Situation JSON:
{situation_json}

Action catalog JSON:
{action_catalog_json}

# Output
Format:
{output_format_name}

Rules:
{format_rules}

Shape guide:
{output_example}
"""
