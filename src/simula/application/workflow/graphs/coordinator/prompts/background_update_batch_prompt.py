"""Purpose:
- Prompt for deferred background updates only.
"""

from __future__ import annotations

PROMPT = """# Role
You are the runtime coordinator.

# Goal
Generate only the deferred background updates for actors not selected for direct focus.

# Rules
- `background_updates` should only describe actors from `deferred_actors_json`.
- Each item must keep `summary` and `future_hook` non-empty and concrete.
- `pressure_level` must be exactly one of `low`, `medium`, or `high`.
- Keep the updates realistic and useful for the next round.
- Return only the JSON object that matches the required output schema.
- Do not return any prose, labels, headings, markdown, or commentary outside the JSON object.
- Do not add extra keys that are not in the output schema.
- Do not omit any required keys from the output schema.
- If a field is a string, return a JSON string and never wrap it in an array.
- If a field is an array, return a JSON array even when it has only one item.

# Inputs
Round index:
{round_index}

Deferred actors JSON:
{deferred_actors_json}

Focus core JSON:
{focus_core_json}

Coordination frame JSON:
{coordination_frame_json}

Situation JSON:
{situation_json}

Event memory JSON:
{event_memory_json}

Previous observer summary:
{previous_observer_summary}

# Output
Format:
{output_format_name}

Rules:
{format_rules}

Shape guide:
{output_example}
"""
