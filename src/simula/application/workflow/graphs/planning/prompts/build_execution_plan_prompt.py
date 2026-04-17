"""Purpose:
- Prompt for compact execution-plan frame construction.
"""

from __future__ import annotations

PROMPT = """# Role
You are the planner for a state-driven simulation.

# Goal
Turn the planning analysis and cast outline into the minimum execution-plan frame bundle.

# Rules
- Keep the action catalog broad and small.
- Avoid near-duplicate action entries that only rename the same move.
- `action_catalog.actions` must contain at most 5 items.
- Each `action_catalog.actions` item must use a unique `action_type`.
- Each `action_catalog.selection_guidance` item should explain how to choose among the broad actions in this scenario.
- Generate `major_events` only when the scenario text implies concrete turning points, staged choices, checkpoints, or end conditions worth tracking.
- `major_events` may be an empty array when the scenario does not imply any specific shared event track.
- `major_events` must contain at most 6 items.
- Each `major_events` item must use a unique `event_id`.
- Each `major_events` item must use only cast ids that appear in `cast_roster_outline_json.items`.
- Use round windows for `major_events`. `earliest_round` and `latest_round` should fit within `planning_analysis_json.progression_plan.max_rounds`.
- In each `major_events` item, `participant_cast_ids` and `completion_action_types` must be unique arrays.
- In each `major_events` item, `participant_cast_ids`, `completion_action_types`, and `completion_signals` must stay non-empty whenever the event exists.
- In each `major_events` item, `earliest_round` must be less than or equal to `latest_round`.
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
- Do not import outside genre knowledge or default show formats. Only create major events that are explicitly stated or strongly implied by the scenario text.

# Input
Scenario text:
{scenario_text}

Planning analysis JSON:
{planning_analysis_json}

Cast roster outline JSON:
{cast_roster_outline_json}

Runtime hard ceiling:
{max_rounds}

# Output
Format:
{output_format_name}

Rules:
{format_rules}

Shape guide:
{output_example}
"""
