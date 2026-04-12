"""목적:
- 그래프별 output schema 예시를 prompt bundle로 감싸는 공용 유틸을 제공한다.

설명:
- 예시 payload 자체는 각 그래프의 `output_schema` 폴더에 두고,
  형식 지시문과 최소화 규칙만 공통으로 재사용한다.

사용한 설계 패턴:
- 공용 prompt bundle utility 패턴
"""

from __future__ import annotations

import json
from typing import Any, Literal

ExampleMode = Literal["minimal", "compact"]


def build_json_prompt_bundle(
    *,
    example: dict[str, Any],
    example_mode: ExampleMode = "minimal",
) -> dict[str, str]:
    """JSON 출력 예시 묶음을 만든다."""

    rendered = _render_example_payload(example, example_mode=example_mode)
    return {
        "output_format_name": "JSON",
        "format_rules": "\n".join(
            [
                "- Return one JSON object only.",
                "- Do not add code fences, explanations, or extra commentary.",
                "- Keep every string key explicitly wrapped in double quotes.",
            ]
        ),
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
    """NDJSON 출력 예시 묶음을 만든다."""

    rendered = _render_example_payload(example, example_mode=example_mode)
    return {
        "output_format_name": "NDJSON",
        "format_rules": "\n".join(
            [
                "- Return one JSON object per line.",
                "- Do not wrap the lines in a JSON array.",
                "- Do not add code fences, explanations, or blank lines.",
                "- Keep every string key explicitly wrapped in double quotes.",
            ]
        ),
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
