"""목적:
- 주요 사건과 그 결과 섹션 프롬프트를 제공한다.

설명:
- 분기점이 된 사건과 그 결과를 연결해 설명하는 본론용 프롬프트다.

사용한 설계 패턴:
- PromptTemplate singleton 패턴
"""

from __future__ import annotations

from simula.application.workflow.utils.report_section_prompt_builder import (
    build_report_section_prompt,
)

PROMPT = build_report_section_prompt(
    section_title="주요 사건과 그 결과",
    section_goal="분기점이 된 사건이나 활동이 어떤 결과를 낳았는지 bullet로 압축한다.",
    section_requirements=[
        "출력은 bullet만 사용한다.",
        "각 bullet은 사건과 그 직접 결과를 함께 적어야 한다.",
        "공개 행동, 비공개 행동, observer 이벤트가 어떤 영향을 만들었는지 드러낸다.",
        "한 bullet 안에서 누가 무엇을 했는지와 그 결과가 어떻게 이어졌는지를 바로 읽히게 써라.",
    ],
    include_body_sections=False,
)
