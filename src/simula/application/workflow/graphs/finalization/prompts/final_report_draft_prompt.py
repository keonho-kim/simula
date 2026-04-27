"""Single-call final report draft prompt."""

from __future__ import annotations

from textwrap import dedent

from langchain_core.prompts import PromptTemplate

FINAL_REPORT_DRAFT_EXAMPLE: dict[str, object] = {
    "conclusion_section": "### 최종 상태\n- <bullet>\n### 핵심 판단 근거\n- <bullet>",
    "actor_dynamics_section": "### 현재 구도\n- <bullet>\n### 관계 변화\n- <bullet>",
    "major_events_section": "- <major event result>",
}

_PROMPT = dedent("""# Role
You write the final simulation report body in one pass.

# Goal
Return the narrative final report sections in one JSON object.

# Rules
- Write in Korean.
- Each section value must be a JSON string, not an array.
- Put multiple markdown bullets inside the string using newline characters (`\n`).
- conclusion_section must contain headings `### 최종 상태` and `### 핵심 판단 근거`.
- actor_dynamics_section must contain headings `### 현재 구도` and `### 관계 변화`.
- major_events_section must be bullet-only.
- Do not write the timeline section; it is rendered by code from structured timeline data.
- Do not add markdown fences.
- Do not request follow-up rewriting.

# Output format
{format_rules}

# Shape guide
{output_example}

# Compact input
{compact_input_json}
""".strip())

PROMPT = PromptTemplate.from_template(_PROMPT)
