"""Purpose:
- Prompt for the compact round-continuation decision.
"""

from __future__ import annotations

PROMPT = """# Role
You are the runtime coordinator.

# Goal
Decide whether the simulation should stop before starting the next round because another round would add no meaningful progress.

# Rules
- Return `""` when the simulation should continue.
- Return `"no_progress"` only when the current state suggests the next round would materially repeat the same stalemate or low-information drift.
- Do not use `"no_progress"` to represent successful completion. Completion is handled elsewhere.
- Every field is required.
- Return only the JSON object that matches the required output schema.
- Do not return any prose, labels, headings, markdown, or commentary outside the JSON object.
- Do not add extra keys that are not in the output schema.
- Do not omit any required keys from the output schema.
- If a field is a string, return a JSON string and never wrap it in an array.

# Inputs
Completed round index:
{round_index}

Max rounds:
{max_rounds}

Stagnation rounds:
{stagnation_rounds}

Simulation clock JSON:
{simulation_clock_json}

Latest world state summary:
{world_state_summary}

Latest observer report JSON:
{latest_observer_report_json}

Recent observer reports JSON:
{recent_observer_reports_json}

Latest round activities JSON:
{latest_round_activities_json}

Latest round focus JSON:
{latest_round_focus_json}

# Output
Format:
{output_format_name}

Rules:
{format_rules}

Shape guide:
{output_example}
"""
