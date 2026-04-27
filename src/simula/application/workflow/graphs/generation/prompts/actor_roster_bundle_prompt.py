"""Bundled actor roster generation prompt."""

from __future__ import annotations

from textwrap import dedent

from langchain_core.prompts import PromptTemplate

ACTOR_ROSTER_BUNDLE_EXAMPLE: dict[str, object] = {
    "actors": [
        {
            "cast_id": "cast-1",
            "display_name": "<copy display_name>",
            "role": "<specific role>",
            "narrative_profile": "<compact narrative pressure>",
            "private_goal": "<compact private goal>",
            "voice": "<compact speaking style for scene dialogue>",
            "preferred_action_types": ["speech"],
        }
    ]
}

_PROMPT = dedent("""# Role
You generate runtime actor cards for the assigned cast chunk.

# Goal
Return one ActorRosterBundle object containing exactly one actor card for each assigned cast item.

# Rules
- Use only assigned cast_id values.
- Copy cast_id and display_name exactly from assigned_cast_items.
- Return actors in the same order as assigned_cast_items.
- preferred_action_types must use action_type values from action_catalog.
- Generate only runtime-useful narrative policy fields: role, narrative_profile, private_goal, voice, preferred_action_types.
- Keep narrative_profile, private_goal, and voice compact and actionable for scene beats.
- Do not add actors outside the assigned chunk.

# Output format
{format_rules}

# Shape guide
{output_example}

# Controls
{controls_json}

# Compact plan
{compact_plan_json}

# Assigned cast items
{cast_items_json}
""".strip())

PROMPT = PromptTemplate.from_template(_PROMPT)
