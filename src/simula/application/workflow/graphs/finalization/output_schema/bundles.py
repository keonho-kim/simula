"""목적:
- finalization 그래프 전용 출력 schema 예시 묶음을 제공한다.

설명:
- 최종 보고서 작성에 필요한 구조화 출력 예시를 로컬에 둔다.

사용한 설계 패턴:
- graph-local prompt asset 패턴
"""

from __future__ import annotations

from typing import Any

from simula.prompts.shared.output_schema_utils import (
    ExampleMode,
    build_json_prompt_bundle,
)


def build_timeline_anchor_decision_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_TIMELINE_ANCHOR_DECISION_EXAMPLE,
        example_mode=example_mode,
    )


_TIMELINE_ANCHOR_DECISION_EXAMPLE: dict[str, Any] = {
    "anchor_iso": "2027-06-18T03:20:00",
    "selection_reason": "시나리오에 날짜와 시작 시각이 같이 있어 그 값을 그대로 썼다.",
}
