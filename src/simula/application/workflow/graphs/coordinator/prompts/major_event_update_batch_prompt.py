"""Purpose:
- Prompt for event updates only.
"""

from __future__ import annotations

PROMPT = """# Role
You are the runtime resolver.

# Goal
Generate only the event updates for this round.

# Rules
- `event_updates` may mention only event ids that exist in `event_memory_json`.
- Use `event_match_hints_json` as the code-first baseline for which major events may have advanced this round.
- Do not mark a major event as `completed` unless the round activities plausibly satisfy its participants and completion signals.
- Each item must keep `progress_summary` non-empty and concrete.
- Return only the JSON array that matches the required output schema.
- Do not return any prose, labels, headings, markdown, or commentary outside the JSON array.
- Do not add extra keys that are not in the output schema.
- Do not omit any required keys from the output schema.
- If a field is a string, return a JSON string and never wrap it in an array.
- If a field is an array, return a JSON array even when it has only one item.
- Each item must stay within the sentence or item limits shown in the shape guide.

# Inputs
Round index:
{round_index}

Resolution core JSON:
{resolution_core_json}

Pending actor proposals JSON:
{pending_actor_proposals_json}

Latest activities JSON:
{latest_activities_json}

Event memory JSON:
{event_memory_json}

Event match hints JSON:
{event_match_hints_json}

# Output
Format:
{output_format_name}

Rules:
{format_rules}

Shape guide:
{output_example}
"""
