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
- Ground every fact in the scenario text. If a duration, participant count, episode count, or format detail is not stated, do not infer a concrete value.
- Do not import outside genre knowledge, show conventions, or likely defaults.
- Do not turn the scenario into observation questions, analyst prompts, or viewer checklists.
- `progression_plan.max_rounds` is the maximum number of simulation rounds, not an elapsed-time unit.
- `progression_plan.allowed_elapsed_units` and `progression_plan.default_elapsed_unit` describe in-world elapsed time only.
- Allowed elapsed-time units are only `minute`, `hour`, `day`, and `week`.
- `progression_plan.max_rounds` must exactly equal the runtime round budget.

# Input
Scenario text:
{scenario_text}

Runtime round budget:
{max_rounds}

# Output
Format:
{output_format_name}

Rules:
{format_rules}

Shape guide:
{output_example}
"""
