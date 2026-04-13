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
- Return only the JSON object that matches the required output schema.
- Do not return any prose, labels, headings, markdown, or commentary outside the JSON object.
- Do not add extra keys that are not in the output schema.
- Do not omit any required keys from the output schema.
- If a field is a string, return a JSON string and never wrap it in an array.
- If a field is an array, return a JSON array even when it has only one item.
- Do not invent actors beyond what the scenario implies.
- Ground every fact in the scenario text. If a duration, participant count, episode count, or format detail is not stated, do not infer a concrete value.
- Do not import outside genre knowledge, show conventions, or likely defaults.
- Do not turn the scenario into observation questions, analyst prompts, or viewer checklists.
- Keep the analysis realistic and in-world. Preserve the kind of people, constraints, and actions that could actually happen in the described setting.
- Do not introduce off-screen systems, formal procedures, legal instruments, or expert frameworks unless the scenario text already implies them.
- `progression_plan.max_rounds` is the maximum number of simulation rounds, not an elapsed-time unit.
- Choose `progression_plan.max_rounds` from the scenario pacing itself. Do not copy a fixed default if the scenario implies a shorter or longer arc.
- `progression_plan.allowed_elapsed_units` and `progression_plan.default_elapsed_unit` describe in-world elapsed time only.
- Allowed elapsed-time units are only `minute`, `hour`, `day`, and `week`.
- `progression_plan.max_rounds` must be between 1 and the provided round cap.

# Input
Scenario text:
{scenario_text}

Round cap:
{max_rounds}

# Output
Format:
{output_format_name}

Rules:
{format_rules}

Shape guide:
{output_example}
"""
