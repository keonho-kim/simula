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
    "anchor_iso": "<one absolute timestamp in YYYY-MM-DDTHH:MM:SS format>",
    "selection_reason": "<one short Korean sentence explaining which clues were used>",
}

_FINAL_REPORT_SECTIONS_EXAMPLE: dict[str, Any] = {
    "conclusion_section": "### 최종 상태\n- <one final-state bullet>\n### 핵심 판단 근거\n- <one reasoning bullet>",
    "actor_results_rows": "| <actor> | <result> | <counterparty> | <edge> | <reason> |",
    "timeline_section": "- <YYYY-MM-DD HH:MM | phase | event | impact>",
    "actor_dynamics_section": "### 현재 구도\n- <one bullet describing the current relationship map>\n### 관계 변화\n- <one bullet describing how relationships changed>",
    "major_events_section": "- <one bullet summarizing a major event>",
}
