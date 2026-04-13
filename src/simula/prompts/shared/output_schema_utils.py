"""목적:
- 그래프별 output schema shape guide를 prompt bundle로 감싸는 공용 유틸을 제공한다.

설명:
- instruction-only payload 자체는 각 그래프의 `output_schema` 폴더에 두고,
  형식 지시문과 최소화 규칙만 공통으로 재사용한다.

사용한 설계 패턴:
- 공용 prompt bundle utility 패턴
"""

from __future__ import annotations

import json
import textwrap
from typing import Any, Literal

ExampleMode = Literal["minimal", "compact"]

_JSON_FORMAT_RULES = textwrap.dedent(
    """
    - Return one JSON object only.
    - Return only the JSON object that matches the required output schema.
    - Do not add code fences, explanations, or extra commentary.
    - Do not return any prose, labels, headings, or commentary outside the JSON object.
    - Do not add extra keys that are not in the output schema.
    - Do not omit any required keys from the output schema.
    - If a field is a string, return a JSON string and never wrap it in an array.
    - If a field is an array, return a JSON array even when it has only one item.
    - Keep every string key explicitly wrapped in double quotes.
    - The shape guide below uses instruction strings only. Replace them with schema-valid values.
    """
).strip()

_NDJSON_FORMAT_RULES = textwrap.dedent(
    """
    - Return one JSON object per line.
    - Do not wrap the lines in a JSON array.
    - Do not add code fences, explanations, or blank lines.
    - Return only schema-valid JSON object lines and no extra prose.
    - Do not add extra keys that are not in the output schema.
    - Do not omit any required keys from the output schema.
    - If a field is a string, return a JSON string and never wrap it in an array.
    - If a field is an array, return a JSON array even when it has only one item.
    - Keep every string key explicitly wrapped in double quotes.
    - The shape guide below uses instruction strings only. Replace them with schema-valid values.
    """
).strip()


def build_json_prompt_bundle(
    *,
    example: dict[str, Any],
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    """JSON 출력 shape-guide 묶음을 만든다."""

    rendered = _render_example_payload(example, example_mode=example_mode)
    return {
        "output_format_name": "JSON",
        "format_rules": _JSON_FORMAT_RULES,
        "output_example": json.dumps(
            rendered,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
    }


def build_ndjson_prompt_bundle(
    *,
    example: dict[str, Any],
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    """NDJSON 출력 shape-guide 묶음을 만든다."""

    rendered = _render_example_payload(example, example_mode=example_mode)
    return {
        "output_format_name": "NDJSON",
        "format_rules": _NDJSON_FORMAT_RULES,
        "output_example": json.dumps(
            rendered,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
    }


def _render_example_payload(
    example: dict[str, Any],
    *,
    example_mode: ExampleMode,
) -> dict[str, Any]:
    if example_mode == "compact":
        return example
    return _minimize_example_value(example)


def _minimize_example_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: _minimize_example_value(item)
            for key, item in value.items()
        }
    if isinstance(value, list):
        if not value:
            return []
        return [_minimize_example_value(value[0])]
    return value
