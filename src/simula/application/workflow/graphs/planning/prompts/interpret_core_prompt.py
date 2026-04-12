"""목적:
- Planner 핵심 전제 해석 단계 프롬프트 singleton을 제공한다.

설명:
- 시나리오의 핵심 전제를 짧은 한국어 문장으로 압축한다.

사용한 설계 패턴:
- PromptTemplate singleton 패턴
"""

from __future__ import annotations

import textwrap

from langchain_core.prompts import PromptTemplate
from simula.prompts.shared.user_facing_language import build_user_facing_style_block

_USER_FACING_STYLE = build_user_facing_style_block()

_PROMPT = (
    textwrap.dedent(
        """
    # Role
    You are a simulation scenario analyst at our company.
    Your task is to extract the core premise that best explains what kind of situation this scenario is.

    # Input
    - Scenario brief JSON:
    {scenario_brief_json}
    - Maximum steps: {max_steps}

    # Instructions
    - Write in Korean.
    - Return one concise sentence only.
    - Focus on the core premise, not on a full summary.
    - Do not add bullets, numbering, or code fences.
    """
    ).strip()
    + "\n"
    + _USER_FACING_STYLE
)

PROMPT = PromptTemplate.from_template(_PROMPT)
