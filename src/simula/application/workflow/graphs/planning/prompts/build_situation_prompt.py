"""Purpose:
- Prompt for compact situation planning.
"""

from __future__ import annotations

PROMPT = """# Role
You are the planner for a state-driven simulation.

# Goal
Extract only the reusable situation object for the execution plan.

# Rules
- Keep the output compact and concrete.
- Every field is required.
- Return only the JSON object that matches the required output schema.
- Do not return any prose, labels, headings, markdown, or commentary outside the JSON object.
- Do not add extra keys that are not in the output schema.
- Do not omit any required keys from the output schema.
- If a field is a string, return a JSON string and never wrap it in an array.
- If a field is an array, return a JSON array even when it has only one item.
- Do not exceed the per-field sentence or item limits shown in the shape guide.
- Ground every fact in the scenario text and planning analysis.
- Keep `initial_tensions` and `current_constraints` as non-empty arrays of concrete Korean strings.
- Keep `channel_guidance` realistic for how actions should be expressed in this scenario.

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
"""
