"""Purpose:
- Provide compact finalization prompt examples.
"""

from __future__ import annotations

from typing import Any

from simula.prompts.shared.output_schema_utils import ExampleMode, build_json_prompt_bundle


def build_timeline_anchor_decision_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_TIMELINE_ANCHOR_DECISION_EXAMPLE,
        example_mode=example_mode,
    )


def build_final_report_sections_prompt_bundle(
    *,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    return build_json_prompt_bundle(
        example=_FINAL_REPORT_SECTIONS_EXAMPLE,
        example_mode=example_mode,
    )


_TIMELINE_ANCHOR_DECISION_EXAMPLE: dict[str, Any] = {
    "anchor_iso": "2027-06-18T03:20:00",
    "selection_reason": "시나리오에 날짜와 시작 시각이 같이 있어 그 값을 그대로 썼다.",
}

_FINAL_REPORT_SECTIONS_EXAMPLE: dict[str, Any] = {
    "conclusion_section": "### 최종 상태\n- 최종 선택이 가시화됐다.\n### 핵심 이유\n- 마지막 조율이 결론을 밀었다.",
    "actor_results_rows": "| 운영 총괄 | 재검토 관철 | 재무 총괄 | 우세 | 마지막 조율을 주도했다 |",
    "timeline_section": "- 2027-06-18 03:20 | 시작 단계 | 첫 직접 압박 | 다음 선택 압력이 커졌다.",
    "actor_dynamics_section": "### 현재 구도\n운영 총괄과 재무 총괄의 줄다리기가 핵심 축이다.\n### 관계 변화\n후반으로 갈수록 공개 신호보다 비공개 정렬이 더 중요해졌다.",
    "major_events_section": "- 운영 총괄이 재검토를 강하게 요청했다.\n- 재무 총괄이 결정을 미루지 못하게 됐다.",
}
