"""Purpose:
- Prompt for updated intent snapshots only.
"""

from __future__ import annotations

PROMPT = """# Role
You are the runtime resolver.

# Goal
Generate only the updated intent snapshots for actors whose direction changed or needs reaffirmation.

# Rules
- `actor_intent_states` may contain a partial set, but each `cast_id` must be unique.
- Use only cast ids that exist in `actors_json`.
- Each item must keep `current_intent` concrete and add `thought` that explains why this actor chose that direction now.
- Keep each updated intent only one plausible beat ahead of the adopted actions and background pressure.
- Return only the JSON object that matches the required output schema.
- Do not return any prose, labels, headings, markdown, or commentary outside the JSON object.
- Do not add extra keys that are not in the output schema.
- Do not omit any required keys from the output schema.
- If a field is a string, return a JSON string and never wrap it in an array.
- If a field is an array, return a JSON array even when it has only one item.

# Inputs
Round index:
{round_index}

Resolution core JSON:
{resolution_core_json}

Round focus plan JSON:
{round_focus_plan_json}

Pending actor proposals JSON:
{pending_actor_proposals_json}

Latest background updates JSON:
{latest_background_updates_json}

Actors JSON:
{actors_json}

Current actor intent states JSON:
{actor_intent_states_json}

# Output
Format:
{output_format_name}

Rules:
{format_rules}

Shape guide:
{output_example}
"""
