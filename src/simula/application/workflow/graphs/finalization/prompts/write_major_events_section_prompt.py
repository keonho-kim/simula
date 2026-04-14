"""Purpose:
- Prompt for the final report major events section.
"""

from __future__ import annotations

from langchain_core.prompts import PromptTemplate

PROMPT = PromptTemplate.from_template(
    """# Role
You write one section of the final simulation report.

# Goal
Write only the major events section.

# Rules
- Return markdown for the section body only.
- Do not add a document title or any `##` heading.
- Write 2 to 5 bullet lines only.
- Every non-empty line must begin with `- `.
- If the inputs show completed or missed major events, mention them explicitly.
- Use only facts supported by the inputs.

# Inputs
Scenario summary:
{scenario_text}

Final report summary JSON:
{final_report_json}

Final report context JSON:
{report_projection_json}
"""
)
