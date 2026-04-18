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
- If unresolved required events remain in `event_memory_json`, do not return `"no_progress"` just because the pace slowed.
- Return only the JSON string value that matches the required output schema.
- Do not return any prose, labels, headings, markdown, or commentary outside the JSON string value.
- Do not wrap the value in a JSON object or JSON array.

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

Event memory JSON:
{event_memory_json}

# Output
Format:
{output_format_name}

Rules:
{format_rules}

Shape guide:
{output_example}
"""
