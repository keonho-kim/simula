"""목적:
- 행위자 역학 관계 섹션 프롬프트를 제공한다.

설명:
- 행위자 사이의 현재 구도와 관계 변화를 압축적으로 분석한다.

사용한 설계 패턴:
- PromptTemplate singleton 패턴
"""

from __future__ import annotations

from simula.application.workflow.utils.report_section_prompt_builder import (
    build_report_section_prompt,
)

PROMPT = build_report_section_prompt(
    section_title="행위자 역학 관계",
    section_goal="누가 누구에게 영향을 주고 있는지와 관계가 어떻게 바뀌었는지 짧고 쉽게 정리한다.",
    section_requirements=[
        "출력은 반드시 `### 현재 구도`와 `### 관계 변화` 두 소제목을 사용한다.",
        "각 소제목 아래에는 짧은 문단만 써라. bullet은 쓰지 않는다.",
        "첫 문장부터 현재 누가 누구에게 영향을 주는지 분명히 적어라.",
        "단순 사건 나열 대신 관계 방향, 주도권 이동, 멀어짐과 가까워짐을 쉬운 말로 설명한다.",
        "`~축`, `허브`, `수렴` 같은 말은 쓰지 않는다.",
    ],
    include_body_sections=False,
)
