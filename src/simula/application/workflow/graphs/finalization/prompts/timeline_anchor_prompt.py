"""목적:
- 최종 보고서 타임라인 시작 시각 결정 프롬프트를 제공한다.

설명:
- 시나리오 본문에서 절대 날짜/시각이 부족할 때 시작 anchor를 보완한다.

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
    You are the final observer for this simulation.
    Your task is to determine one absolute starting timestamp for the final report timeline.

    # Input
    - scenario text:
    {scenario_text}
    - extracted date hint:
    {date_hint}
    - extracted time hint:
    {time_hint}
    - extracted context hint:
    {context_hint}
    - total simulated elapsed label:
    {elapsed_simulation_label}
    - max rounds:
    {max_rounds}

    # Output Format
    - Return format: {output_format_name}
    {format_rules}

    # Example
    {output_example}

    # Instructions
    - Write all natural-language values in Korean.
    - Keep identifiers, field names, and enum values in the required schema format.
    - `anchor_iso` must be one absolute timestamp in `YYYY-MM-DDTHH:MM:SS` format.
    - Preserve any explicit date or time information found in the scenario whenever possible.
    - If the scenario gives only partial time information, fill the missing parts with the most plausible value from the scenario context.
    - If the scenario gives no absolute date or time, choose one internally consistent anchor that makes the report timeline readable.
    - `selection_reason` should briefly explain which clues you used.
    """
    ).strip()
    + "\n"
    + _USER_FACING_STYLE
)

PROMPT = PromptTemplate.from_template(_PROMPT)
