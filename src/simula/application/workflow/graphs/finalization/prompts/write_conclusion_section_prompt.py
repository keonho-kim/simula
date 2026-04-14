"""Purpose:
- Prompt for the final report conclusion section.
"""

from __future__ import annotations

from langchain_core.prompts import PromptTemplate

PROMPT = PromptTemplate.from_template(
    """# Role
You write one section of the final simulation report.

# Goal
Write only the conclusion section.

# Rules
- Return markdown for the section body only.
- Do not add a document title or any `##` heading.
- Use exactly these two subheadings:
  - `### 최종 상태`
  - `### 핵심 판단 근거`
- Write 1 to 2 bullet lines under each subheading.
- Keep the section concrete and concise.
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
