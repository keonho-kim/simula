"""Purpose:
- Prompt for compact cast-roster outline construction.
"""

from __future__ import annotations

PROMPT = """# Role
You are the planner for a state-driven simulation.

# Goal
Extract the minimum cast roster outline needed for later planning steps.

# Rules
- Return only `items`, with one entry per cast slot.
- Use stable, unique `cast_id` values and unique `display_name` values.
- Preserve scenario-grounded order. Keep the order deterministic and easy to expand later.
- Prefer named participants first. Add implied participants only when the requested cast count requires them.
- Do not include role hints, group names, or core tensions yet.
- Every field is required.
- Return only the JSON array that matches the required output schema.
- Do not return any prose, labels, headings, markdown, or commentary outside the JSON array.
- Do not add extra keys that are not in the output schema.
- Do not omit any required keys from the output schema.
- If a field is an array, return a JSON array even when it has only one item.
- `slot_index` must be a positive integer and must increase without gaps.

# Input
Scenario text:
{scenario_text}

Planning analysis JSON:
{planning_analysis_json}

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
