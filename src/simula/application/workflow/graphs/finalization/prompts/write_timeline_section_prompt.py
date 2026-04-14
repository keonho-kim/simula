"""Purpose:
- Prompt for the final report timeline section.
"""

from __future__ import annotations

from langchain_core.prompts import PromptTemplate

PROMPT = PromptTemplate.from_template(
    """# Role
You write one section of the final simulation report.

# Goal
Write only the timeline section.

# Rules
- Return markdown for the section body only.
- Do not add a document title or any `##` heading.
- Write 3 to 5 bullet lines only.
- Each line must follow this exact format:
  - `- YYYY-MM-DD HH:MM | phase | event | impact`
- Prefer the turning points that explain the final outcome.
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
