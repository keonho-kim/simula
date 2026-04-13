"""Purpose:
- Prompt for the compact round directive.
"""

from __future__ import annotations

PROMPT = """# Role
You are the runtime coordinator.

# Goal
Choose the direct focus for this round and summarize deferred motion in the same object.

# Rules
- Keep the number of selected actors within the provided budget.
- `selected_actor_ids` must match the union of every `focus_actor_ids`.
- Only actors from `focus_candidates_json` may appear in `selected_actor_ids`.
- `background_updates` should only describe deferred actors.
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

Focus candidates JSON:
{focus_candidates_json}

Deferred actors JSON:
{deferred_actors_json}

Coordination frame JSON:
{coordination_frame_json}

Situation JSON:
{situation_json}

Simulation clock JSON:
{simulation_clock_json}

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

# Glossary
- A `round` is one outer simulation cycle.
- Elapsed time is a separate concept and is handled elsewhere.
"""
