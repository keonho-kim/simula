"""Purpose:
- Prompt for compact execution-plan construction.
"""

from __future__ import annotations

PROMPT = """# Role
You are the planner for a state-driven simulation.

# Goal
Turn the planning analysis into the minimum execution plan bundle.

# Rules
- Keep the action catalog broad and small.
- Keep the cast roster unique.
- Every field is required.
- Return only the JSON object that matches the required output schema.
- Do not return any prose, labels, headings, markdown, or commentary outside the JSON object.
- Do not add extra keys that are not in the output schema.
- Do not omit any required keys from the output schema.
- If a field is a string, return a JSON string and never wrap it in an array.
- If a field is an array, return a JSON array even when it has only one item.
- Keep the execution plan realistic for the scenario. The action catalog, tensions, and cast tensions must describe moves that could plausibly happen in-world.
- Do not introduce formal documents, legal frameworks, military doctrines, or institutional processes unless they are already grounded in the scenario text.
- Prefer concrete human or organizational behavior over abstract analysis labels.

# Input
Scenario text:
{scenario_text}

Planning analysis JSON:
{planning_analysis_json}

Runtime hard ceiling:
{max_rounds}

Requested cast count:
{num_cast}

Allow additional cast beyond the requested count:
{allow_additional_cast}

Cast roster policy:
{cast_roster_policy}

# Output
Format:
{output_format_name}

Rules:
{format_rules}

Shape guide:
{output_example}
"""
