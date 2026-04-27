"""Purpose:
- Prompt for compact cast-roster outline construction.
"""

from __future__ import annotations

from textwrap import dedent

from langchain_core.prompts import PromptTemplate

CAST_ROSTER_OUTLINE_ITEM_EXAMPLE: dict[str, object] = {
    "slot_index": 1,
    "cast_id": "<stable snake_case or kebab-case cast identifier>",
    "display_name": "<1 short participant name or role label grounded in the scenario>",
}


def cast_roster_policy_text(
    *,
    num_cast: int,
    allow_additional_cast: bool,
) -> str:
    if allow_additional_cast:
        return (
            f"- `num_cast` is {num_cast}.\n"
            "- `allow_additional_cast` is true.\n"
            f"- Include at least {num_cast} cast entries in `items`.\n"
            "- Prefer named or clearly implied scenario participants first.\n"
            "- You may add more cast entries only if the scenario structure genuinely needs them."
        )
    return (
        f"- `num_cast` is {num_cast}.\n"
        "- `allow_additional_cast` is false.\n"
        f"- Include exactly {num_cast} cast entries in `items`.\n"
        "- Prefer named or clearly implied scenario participants first.\n"
        "- Do not add extra cast entries beyond the requested count."
    )

_PROMPT = dedent("""# Role
You are the planner for a state-driven simulation.

# Goal
Extract the minimum cast roster outline needed for later planning steps.

# Rules
- Return only `items`, with one entry per cast slot.
- Use stable, unique `cast_id` values and unique `display_name` values.
- Preserve scenario-grounded order. Keep the order deterministic and easy to expand later.
- Prefer named participants first. Add implied participants only when the requested cast count requires them.
- Do not include role hints, group names, or core tensions yet.
- Every field is required.
- Return only the JSON array that matches the required output schema.
- Do not return any prose, labels, headings, markdown, or commentary outside the JSON array.
- Do not add extra keys that are not in the output schema.
- Do not omit any required keys from the output schema.
- If a field is an array, return a JSON array even when it has only one item.
- `slot_index` must be a positive integer and must increase without gaps.

# Input
Scenario text:
{scenario_text}

Planning analysis JSON:
{planning_analysis_json}

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
""".strip())

PROMPT = PromptTemplate.from_template(_PROMPT)
