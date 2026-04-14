"""Purpose:
- Prompt for the final report actor dynamics section.
"""

from __future__ import annotations

from langchain_core.prompts import PromptTemplate

PROMPT = PromptTemplate.from_template(
    """# Role
You write one section of the final simulation report.

# Goal
Write only the actor dynamics section.

# Rules
- Return markdown for the section body only.
- Do not add a document title or any `##` heading.
- Use exactly these two subheadings:
  - `### 현재 구도`
  - `### 관계 변화`
- Write 1 to 2 bullet lines under each subheading.
- Focus on the relationships that most affected the ending.
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
