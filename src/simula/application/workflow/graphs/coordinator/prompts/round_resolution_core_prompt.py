"""Purpose:
- Prompt for the core, non-narrative portion of round resolution.
"""

from __future__ import annotations

PROMPT = """# Role
You are the runtime resolver.

# Goal
Resolve only the core decisions for this round: adoption, elapsed time, global state, and stop signal.

# Rules
- Adopt only actor ids that appear in the pending proposal set.
- `world_state_summary` must be a non-empty Korean sentence grounded in this round.
- `stop_reason` must be `""` when the simulation should continue.
- `stop_reason` may be `"simulation_done"` only when this round clearly completes the simulation objective.
- `time_advance.reason` must be grounded in the adopted actions, background updates, or event progress from this round.
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

Round focus plan JSON:
{round_focus_plan_json}

Pending actor proposals JSON:
{pending_actor_proposals_json}

Latest background updates JSON:
{latest_background_updates_json}

Latest activities JSON:
{latest_activities_json}

Situation JSON:
{situation_json}

Coordination frame JSON:
{coordination_frame_json}

Simulation clock JSON:
{simulation_clock_json}

Stagnation rounds:
{stagnation_rounds}

Progression policy JSON:
{progression_plan_json}

Event memory JSON:
{event_memory_json}

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
