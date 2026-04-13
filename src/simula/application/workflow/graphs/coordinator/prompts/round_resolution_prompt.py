"""Purpose:
- Prompt for the compact round resolution bundle.
"""

from __future__ import annotations

PROMPT = """# Role
You are the runtime resolver.

# Goal
Resolve this round in one object: adoption, updated intents, elapsed-time advance, observer summary, and stop signal.

# Rules
- Adopt only actor ids that appear in the pending proposal set.
- Keep the observer summary grounded in the supplied actions and background updates.
- `stop_reason` must be an empty string when the simulation should continue.
- Every field is required.
- Return only the JSON object that matches the required output schema.
- Do not return any prose, labels, headings, markdown, or commentary outside the JSON object.
- Do not add extra keys that are not in the output schema.
- Do not omit any required keys from the output schema.
- If a field is a string, return a JSON string and never wrap it in an array.
- If a field is an array, return a JSON array even when it has only one item.

# Inputs
Round index:
{round_index}

Round focus plan JSON:
{round_focus_plan_json}

Pending actor proposals JSON:
{pending_actor_proposals_json}

Latest background updates JSON:
{latest_background_updates_json}

Latest activities JSON:
{latest_activities_json}

Actor intent states JSON:
{actor_intent_states_json}

Simulation clock JSON:
{simulation_clock_json}

Progression policy JSON:
{progression_plan_json}

World state summary:
{world_state_summary}

# Output
Format:
{output_format_name}

Rules:
{format_rules}

Shape guide:
{output_example}

# Glossary
- A `round` is one outer simulation cycle.
- Elapsed time is in-world time and uses only `minute`, `hour`, `day`, or `week`.
"""
