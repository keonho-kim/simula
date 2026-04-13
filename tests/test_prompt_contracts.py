"""Purpose:
- Verify that every structured prompt explicitly enforces schema-only output.
"""

from __future__ import annotations

from simula.application.workflow.graphs.coordinator.prompts.round_directive_prompt import (
    PROMPT as ROUND_DIRECTIVE_PROMPT,
)
from simula.application.workflow.graphs.coordinator.prompts.round_resolution_prompt import (
    PROMPT as ROUND_RESOLUTION_PROMPT,
)
from simula.application.workflow.graphs.finalization.prompts.timeline_anchor_prompt import (
    PROMPT as TIMELINE_ANCHOR_PROMPT,
)
from simula.application.workflow.graphs.finalization.prompts.write_final_report_bundle_prompt import (
    PROMPT as FINAL_REPORT_BUNDLE_PROMPT,
)
from simula.application.workflow.graphs.generation.prompts.generate_actor_prompt import (
    PROMPT as GENERATE_ACTOR_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.build_execution_plan_prompt import (
    PROMPT as BUILD_EXECUTION_PLAN_PROMPT,
)
from simula.application.workflow.graphs.planning.prompts.build_planning_analysis_prompt import (
    PROMPT as BUILD_PLANNING_ANALYSIS_PROMPT,
)
from simula.application.workflow.graphs.runtime.prompts.actor_turn_prompt import (
    PROMPT as ACTOR_TURN_PROMPT,
)
from simula.infrastructure.llm.fixer import FIX_JSON_PROMPT
from simula.prompts.shared.output_schema_utils import build_json_prompt_bundle


REQUIRED_PROMPT_RULE_SNIPPETS = (
    "Return only the JSON object that matches the required output schema.",
    "Do not add extra keys that are not in the output schema.",
    "Do not omit any required keys from the output schema.",
    "If a field is a string, return a JSON string and never wrap it in an array.",
    "If a field is an array, return a JSON array even when it has only one item.",
)


def test_common_json_format_rules_enforce_schema_only_output() -> None:
    bundle = build_json_prompt_bundle(example={"value": "<string>"})
    format_rules = bundle["format_rules"]

    for snippet in REQUIRED_PROMPT_RULE_SNIPPETS:
        assert snippet in format_rules


def test_all_structured_prompts_explicitly_enforce_schema_only_output() -> None:
    prompt_texts = [
        BUILD_PLANNING_ANALYSIS_PROMPT,
        BUILD_EXECUTION_PLAN_PROMPT,
        ROUND_DIRECTIVE_PROMPT,
        ROUND_RESOLUTION_PROMPT,
        ACTOR_TURN_PROMPT.template,
        GENERATE_ACTOR_PROMPT.template,
        TIMELINE_ANCHOR_PROMPT.template,
        FINAL_REPORT_BUNDLE_PROMPT,
        FIX_JSON_PROMPT,
    ]

    for prompt_text in prompt_texts:
        for snippet in REQUIRED_PROMPT_RULE_SNIPPETS:
            assert snippet in prompt_text
