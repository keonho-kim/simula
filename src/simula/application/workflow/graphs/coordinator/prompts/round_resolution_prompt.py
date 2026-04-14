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
- `stop_reason` must be `""` when the simulation should continue.
- `stop_reason` may be `"simulation_done"` only when this round clearly completes the simulation objective.
- Use `event_match_hints_json` as the code-first baseline for which major events may have advanced this round.
- `event_updates` may mention only event ids that exist in `event_memory_json`.
- Do not mark a major event as `completed` unless the round activities plausibly satisfy its participants and completion signals.
- Use `situation_json` and `coordination_frame_json` as hard realism rails for the next-step direction.
- Every field is required.
- Return only the JSON object that matches the required output schema.
- Do not return any prose, labels, headings, markdown, or commentary outside the JSON object.
- Do not add extra keys that are not in the output schema.
- Do not omit any required keys from the output schema.
- If a field is a string, return a JSON string and never wrap it in an array.
- If a field is an array, return a JSON array even when it has only one item.
- Each `updated_intent_states` item must keep `current_intent` concrete and add `thought` that explains why this actor chose that direction now.
- Keep each updated intent only one plausible beat ahead of the adopted actions. Do not jump straight to public commitment, marriage confirmation, room-wide approval, or shared-strategy leadership unless the supplied actions already justify that intensity.
- `actor_facing_scenario_digest` must describe the next round for actors, including relationship map, current pressures, talking points, repetition to avoid, and recommended tone.
- `actor_facing_scenario_digest.world_state_summary` must match the top-level `world_state_summary`.
- Keep the observer summary, world-state summary, and digest realistic for the scenario. They should sound like plausible next-step pressure, not abstract genre drift.
- If `stagnation_rounds` is high or repetition is visible, change the pressure with a new concrete conversational beat, target, or off-screen hook rather than rephrasing the same declaration.
- Do not introduce new contracts, formal plans, legal clauses, or institutional machinery unless they are grounded in the scenario or the accepted actions.

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

Actor intent states JSON:
{actor_intent_states_json}

Previous actor-facing scenario digest JSON:
{actor_facing_scenario_digest_json}

Simulation clock JSON:
{simulation_clock_json}

Stagnation rounds:
{stagnation_rounds}

Progression policy JSON:
{progression_plan_json}

Event memory JSON:
{event_memory_json}

Event match hints JSON:
{event_match_hints_json}

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
