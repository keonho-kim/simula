"""Purpose:
- Prompt for compact major-event planning.
"""

from __future__ import annotations

PROMPT = """# Role
You are the planner for a state-driven simulation.

# Goal
Generate only the major event batch for this scenario.

# Rules
- Generate `major_events` only when the scenario text implies concrete turning points, staged choices, checkpoints, or end conditions worth tracking.
- `major_events` may be an empty array when the scenario does not imply any specific shared event track.
- `major_events` must contain at most 6 items.
- Each `major_events` item must use a unique `event_id`.
- Each `major_events` item must use only cast ids that appear in `cast_roster_outline_json.items`.
- Each `major_events` item must use only action types that appear in `action_catalog_json.actions`.
- `participant_cast_ids`, `completion_action_types`, and `completion_signals` must stay non-empty arrays whenever the event exists.
- `participant_cast_ids` and `completion_action_types` must stay unique.
- `earliest_round` and `latest_round` must fit within the provided planned max rounds.
- `must_resolve` must be present on every event item and must be either true or false.
- Every field is required.
- Return only the JSON array that matches the required output schema.
- Do not return any prose, labels, headings, markdown, or commentary outside the JSON array.
- Do not add extra keys that are not in the output schema.
- Do not omit any required keys from the output schema.
- If a field is a string, return a JSON string and never wrap it in an array.
- If a field is an array, return a JSON array even when it has only one item.
- Each item must stay within the sentence or item limits shown in the shape guide.
- Only create major events that are explicitly stated or strongly implied by the scenario text.

# Input
Scenario text:
{scenario_text}

Planning analysis JSON:
{planning_analysis_json}

Cast roster outline JSON:
{cast_roster_outline_json}

Action catalog JSON:
{action_catalog_json}

Planned max rounds:
{planned_max_rounds}

# Output
Format:
{output_format_name}

Rules:
{format_rules}

Shape guide:
{output_example}
"""
