"""Purpose:
- Prompt for compact planning analysis.
"""

from __future__ import annotations

PROMPT = """# Role
You are the planner for a state-driven simulation.

# Goal
Compress the raw scenario into one reusable planning analysis object.

# Rules
- Keep the output compact and concrete.
- Preserve only information needed to drive later generation and runtime steps.
- Every field is required.
- Do not invent actors beyond what the scenario implies.
- `progression_plan.max_steps` must exactly equal the runtime hard ceiling.

# Input
Scenario text:
{scenario_text}

Runtime hard ceiling:
{max_steps}

# Output
Format:
{output_format_name}

Rules:
{format_rules}

Example:
{output_example}
"""
