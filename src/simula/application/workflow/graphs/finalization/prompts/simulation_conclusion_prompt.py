"""목적:
- 시뮬레이션 결론 섹션 프롬프트를 제공한다.

설명:
- 본문과 행위자 최종 결과를 모두 읽은 뒤 최상단 결론 bullet을 작성한다.

사용한 설계 패턴:
- PromptTemplate singleton 패턴
"""

from __future__ import annotations

from simula.application.workflow.utils.report_section_prompt_builder import (
    build_report_section_prompt,
)

PROMPT = build_report_section_prompt(
    section_title="시뮬레이션 결론",
    section_goal="본문 전체를 읽은 뒤 결론부터 보여 주는 bullet로 마지막 판정 이벤트와 최종 상태를 정리한다.",
    section_requirements=[
        "출력은 반드시 `### 최종 상태`와 `### 핵심 이유` 두 소제목만 사용한다.",
        "소제목 아래에는 bullet만 써라.",
        "각 bullet은 '- '로 시작해야 한다.",
        "첫 bullet부터 시나리오가 요구한 마지막 판정 이벤트와 최종 결과를 명확히 적어라.",
        "누가 누구를 선택했는지, 거절했는지, 보류했는지 직접 써라.",
        "연애/매칭류라면 `최종 선택 결과`를 직접 적고, 다른 장르라면 그 시나리오에 맞는 마지막 결과 명칭을 사용하라.",
        "근거가 부족하면 추상적으로 흐리지 말고 `미확정` 또는 `확정되지 않았다`고 명시하라.",
        "서론형 문단이나 장문 설명을 쓰지 않는다.",
    ],
    include_body_sections=True,
    include_actor_final_results=True,
)
