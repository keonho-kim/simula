"""목적:
- 행위자 별 최종 결과 섹션 프롬프트를 제공한다.

설명:
- 본문을 읽은 뒤 행위자별 최종 결과 표의 본문 행만 작성한다.

사용한 설계 패턴:
- PromptTemplate singleton 패턴
"""

from __future__ import annotations

from simula.application.workflow.utils.report_section_prompt_builder import (
    build_report_section_prompt,
)

PROMPT = build_report_section_prompt(
    section_title="행위자 별 최종 결과",
    section_goal="행위자별 최종 결과를 markdown 표 본문 행으로 정리한다.",
    section_requirements=[
        "출력은 markdown 표 본문 행만 써라.",
        "헤더 행과 구분선은 쓰지 않는다.",
        "각 행은 정확히 5개 셀로 구성한다.",
        "주체, 최종 결론, 상대/대상, 유불리/상태, 근거 요약 순서를 지켜라.",
        "첫 행부터 마지막 판정이 바로 읽히게 써라.",
        "최종 결론 셀에는 추상 명사 대신 `누가 누구를 선택했다`, `누가 합의를 이끌었다`, `누가 밀려났다`처럼 구체 동사를 사용하라.",
        "`조정 축`, `보조 축`, `중심 축` 같은 표현은 쓰지 않는다.",
        "시나리오에 `최종 선택`, `최종 투표`, `최종 교전`, `최종 협상`처럼 마지막 판정 이벤트 이름이 있으면 그 표현을 우선 사용하라.",
        "근거 요약 셀에는 마지막 단계의 실제 행동이나 관찰 근거를 짧게 적어라.",
    ],
    include_body_sections=True,
)
