"""Purpose:
- Prompt for compact action-catalog planning.
"""

from __future__ import annotations

PROMPT = """# Role
You are the planner for a state-driven simulation.

# Goal
Generate only the broad action catalog for this scenario.

# Rules
- Keep the action catalog broad and small.
- Avoid near-duplicate action entries that only rename the same move.
- `actions` must contain at most 5 items.
- Each action must use a unique `action_type`.
- `selection_guidance` must stay non-empty.
- Set `supports_utterance` to true when the action naturally includes a spoken reaction, question, comment, sharing beat, or conversation turn.
- Set `supports_utterance` to false when the action is mainly silent or non-verbal, such as a solo inspection, silent sampling, purchase click, or quiet observation.
- Every field is required.
- Return only the JSON object that matches the required output schema.
- Do not return any prose, labels, headings, markdown, or commentary outside the JSON object.
- Do not add extra keys that are not in the output schema.
- Do not omit any required keys from the output schema.
- If a field is a string, return a JSON string and never wrap it in an array.
- If a field is an array, return a JSON array even when it has only one item.
- Keep actions realistic for the scenario. Prefer concrete human behavior over abstract labels.

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
