"""Purpose:
- Prompt for the compact step resolution bundle.
"""

from __future__ import annotations

PROMPT = """# Role
You are the runtime resolver.

# Goal
Resolve this step in one object: adoption, updated intents, time advance, observer summary, and stop signal.

# Rules
- Adopt only actor ids that appear in the pending proposal set.
- Keep the observer summary grounded in the supplied actions and background updates.
- `stop_reason` must be an empty string when the simulation should continue.
- Every field is required.

# Inputs
Step index:
{step_index}

Step focus plan JSON:
{step_focus_plan_json}

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

Progression plan JSON:
{progression_plan_json}

World state summary:
{world_state_summary}

# Output
Format:
{output_format_name}

Rules:
{format_rules}

Example:
{output_example}
"""
