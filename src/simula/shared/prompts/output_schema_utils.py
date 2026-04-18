"""목적:
- graph별 output contract shape guide를 prompt bundle로 감싸는 공용 유틸을 제공한다.
"""

from __future__ import annotations

import json
import textwrap
from typing import Any, Literal

ExampleMode = Literal["minimal", "compact"]

_OBJECT_FORMAT_RULES = textwrap.dedent(
    """
    - Return exactly one JSON object.
    - Match the required object shape exactly.
    - Do not add prose, markdown, code fences, or extra keys.
    - Do not omit required keys.
    - Keep string fields as strings and array fields as arrays.
    - Replace the shape guide placeholders with schema-valid values.
    - Do not exceed the per-field sentence or item limits described inside the shape guide placeholders.
    - Treat the shape guide placeholders as output-length requirements, not just field descriptions.
    """
).strip()

_SIMPLE_ARRAY_FORMAT_RULES = textwrap.dedent(
    """
    - Return exactly one JSON array.
    - Do not wrap the array in an object.
    - Do not add prose, markdown, code fences, or extra wrapper keys.
    - Each array item must match the required item shape.
    - Replace the shape guide placeholders with schema-valid values.
    - Each item must stay within the sentence or item limits described inside the shape guide placeholders.
    """
).strip()

_SIMPLE_SCALAR_FORMAT_RULES = textwrap.dedent(
    """
    - Return exactly one JSON value.
    - Do not wrap the value in an object or array unless the contract requires it.
    - Do not add prose, markdown, code fences, labels, or commentary.
    - Replace the placeholder with one valid value only.
    - Keep the value within any length or sentence limit described in the shape guide placeholder.
    """
).strip()


def build_object_prompt_bundle(
    *,
    example: dict[str, Any],
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    """Object output contract prompt bundle을 생성한다."""

    rendered = _render_example_payload(example, example_mode=example_mode)
    return {
        "output_format_name": "JSON object",
        "format_rules": _OBJECT_FORMAT_RULES,
        "output_example": json.dumps(
            rendered,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
    }


def build_simple_array_prompt_bundle(
    *,
    example_item: dict[str, Any] | Any,
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    """Top-level JSON array prompt bundle을 생성한다."""

    rendered = _render_example_payload([example_item], example_mode=example_mode)
    return {
        "output_format_name": "JSON array",
        "format_rules": _SIMPLE_ARRAY_FORMAT_RULES,
        "output_example": json.dumps(
            rendered,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
    }


def build_simple_scalar_prompt_bundle(
    *,
    example_value: Any,
) -> dict[str, str]:
    """Top-level JSON scalar prompt bundle을 생성한다."""

    return {
        "output_format_name": "JSON value",
        "format_rules": _SIMPLE_SCALAR_FORMAT_RULES,
        "output_example": json.dumps(
            example_value,
            ensure_ascii=False,
            separators=(",", ":"),
        ),
    }


def _render_example_payload(
    example: Any,
    *,
    example_mode: ExampleMode,
) -> Any:
    if example_mode == "compact":
        return example
    return _minimize_example_value(example)


def _minimize_example_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _minimize_example_value(item) for key, item in value.items()}
    if isinstance(value, list):
        if not value:
            return []
        return [_minimize_example_value(value[0])]
    return value
