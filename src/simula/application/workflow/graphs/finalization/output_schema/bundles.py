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


_TIMELINE_ANCHOR_DECISION_EXAMPLE: dict[str, Any] = {
    "anchor_iso": "<one absolute timestamp in YYYY-MM-DDTHH:MM:SS format>",
    "selection_reason": "<one short Korean sentence explaining which clues were used>",
}
