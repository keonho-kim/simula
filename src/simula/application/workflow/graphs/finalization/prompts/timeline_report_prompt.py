"""목적:
- 시뮬레이션 타임라인 섹션 프롬프트를 제공한다.

설명:
- 정제된 step packet을 바탕으로 절대시각 bullet 타임라인을 재구성한다.

사용한 설계 패턴:
- PromptTemplate singleton 패턴
"""

from __future__ import annotations

from simula.application.workflow.utils.report_section_prompt_builder import (
    build_report_section_prompt,
)

PROMPT = build_report_section_prompt(
    section_title="시뮬레이션 타임라인",
    section_goal="절대시각 기준으로 시뮬레이션 진행을 짧고 바로 읽히는 bullet 타임라인으로 재구성한다.",
    section_requirements=[
        "각 줄은 '- YYYY-MM-DD HH:mm | 국면 | 핵심 이벤트 | 결과/파급' 형식만 사용한다.",
        "raw activity를 그대로 나열하지 말고 step packet을 바탕으로 자연스럽게 재구성한다.",
        "국면은 `시작 단계`, `탐색 단계`, `관계 변화 단계`, `마무리 단계`처럼 쉬운 표현을 사용한다.",
        "핵심 이벤트와 결과/파급은 장면이 떠오르는 문장으로 쓰고, 시스템 용어를 복붙하지 않는다.",
    ],
    include_body_sections=False,
)
