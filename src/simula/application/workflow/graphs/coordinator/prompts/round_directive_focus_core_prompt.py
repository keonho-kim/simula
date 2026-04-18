"""Purpose:
- Prompt for the focus-only core of a round directive.
"""

from __future__ import annotations

PROMPT = """# Role
You are the runtime coordinator.

# Goal
Choose the direct focus for this round without generating deferred background motion yet.

# Rules
- Keep the number of focused actors within the provided budget.
- `focus_summary` and `reason` must be non-empty, concrete Korean strings.
- `focus_slices` must contain only cast ids from `focus_candidates_json`.
- Each `focus_slices` item must keep `stakes` and `reason` non-empty and concrete.
- Keep the directive realistic for the scenario and the current moment.
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

Focus candidates JSON:
{focus_candidates_json}

Coordination frame JSON:
{coordination_frame_json}

Situation JSON:
{situation_json}

Simulation clock JSON:
{simulation_clock_json}

Event memory JSON:
{event_memory_json}

Previous observer summary:
{previous_observer_summary}

Limits:
- max_focus_slices_per_step={max_focus_slices_per_step}
- max_actor_calls_per_step={max_actor_calls_per_step}

# Output
Format:
{output_format_name}

Rules:
{format_rules}

Shape guide:
{output_example}
"""
