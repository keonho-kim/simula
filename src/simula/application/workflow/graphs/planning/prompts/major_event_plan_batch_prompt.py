"""Purpose:
- Prompt for compact major-event planning.
"""

from __future__ import annotations

from textwrap import dedent

from langchain_core.prompts import PromptTemplate

MAJOR_EVENT_PLAN_ITEM_EXAMPLE: dict[str, object] = {
    "event_id": "<stable snake_case or kebab-case event identifier>",
    "title": "<1 short Korean title for a major scenario event>",
    "summary": "<1 Korean sentence describing what this event means>",
    "participant_cast_ids": ["<cast_id involved in this event>"],
    "earliest_round": 1,
    "latest_round": 2,
    "completion_action_types": ["<action_type that can complete this event>"],
    "completion_signals": [
        "<1 short Korean sentence or phrase that signals completion; return an array even for one signal>"
    ],
    "must_resolve": False,
}

_PROMPT = dedent("""# Role
You are the planner for a state-driven simulation.

# Goal
Generate only the major event batch for this scenario.

# Rules
- Generate `major_events` only when the scenario text implies concrete turning points, staged choices, checkpoints, or end conditions worth tracking.
- `major_events` may be an empty array when the scenario does not imply any specific shared event track.
- `major_events` must contain at most 6 items.
- Each `major_events` item must use a unique `event_id`.
- Each `major_events` item must use only cast ids that appear in `cast_roster_outline_json.items`.
- Each `major_events` item must use only action types that appear in Valid action types.
- Copy completion_action_types values exactly from Valid action types. Do not invent synonyms or new action_type values.
- `participant_cast_ids`, `completion_action_types`, and `completion_signals` must stay non-empty arrays whenever the event exists.
- `completion_signals` must be a JSON array even when there is only one signal, for example ["공식 발표 완료"].
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

Valid action types:
{valid_action_types_json}

Planned max rounds:
{planned_max_rounds}

# Output
Format:
{output_format_name}

Rules:
{format_rules}

Shape guide:
{output_example}
""".strip())

PROMPT = PromptTemplate.from_template(_PROMPT)
