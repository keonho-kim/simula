"""Purpose:
- Prompt for compact execution-plan construction.
"""

from __future__ import annotations

PROMPT = """# Role
You are the planner for a state-driven simulation.

# Goal
Turn the planning analysis into the minimum execution plan bundle.

# Rules
- Keep the action catalog broad and small.
- Keep the cast roster unique.
- Every field is required.
- Do not output commentary outside the JSON object.

# Input
Scenario text:
{scenario_text}

Planning analysis JSON:
{planning_analysis_json}

Runtime hard ceiling:
{max_rounds}

Requested cast count:
{num_cast}

Allow additional cast beyond the requested count:
{allow_additional_cast}

Cast roster policy:
{cast_roster_policy}

# Output
Format:
{output_format_name}

Rules:
{format_rules}

Shape guide:
{output_example}
"""
