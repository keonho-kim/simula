"""Purpose:
- Prompt for the narrative bodies of round resolution.
"""

from __future__ import annotations

PROMPT = """# Role
You are the runtime resolver.

# Goal
Generate only the observer-report body and actor-facing digest body for this round.

# Rules
- Use `resolution_core_json.world_state_summary` as the single source of truth for the round's global state.
- Keep the observer summary grounded in the supplied actions, event updates, and background updates.
- Keep the digest realistic for the next round. It should sound like plausible next-step pressure, not abstract drift.
- Do not introduce new contracts, formal plans, legal clauses, or institutional machinery unless they are grounded in the scenario or accepted actions.
- Return only the JSON object that matches the required output schema.
- Do not return any prose, labels, headings, markdown, or commentary outside the JSON object.
- Do not add extra keys that are not in the output schema.
- Do not omit any required keys from the output schema.
- If a field is a string, return a JSON string and never wrap it in an array.
- If a field is an array, return a JSON array even when it has only one item.
- Do not exceed the per-field sentence or item limits shown in the shape guide.

# Inputs
Round index:
{round_index}

Resolution core JSON:
{resolution_core_json}

Event updates JSON:
{event_updates_json}

Updated intent states JSON:
{intent_states_json}

Latest background updates JSON:
{latest_background_updates_json}

Latest activities JSON:
{latest_activities_json}

Situation JSON:
{situation_json}

Coordination frame JSON:
{coordination_frame_json}

Previous actor-facing scenario digest JSON:
{actor_facing_scenario_digest_json}

World state summary:
{world_state_summary}

# Output
Format:
{output_format_name}

Rules:
{format_rules}

Shape guide:
{output_example}
"""
