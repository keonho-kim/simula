"""목적:
- object/simple output contract 파서를 제공한다.

설명:
- object contract는 `json_repair + Pydantic validation`을 사용한다.
- simple contract는 top-level array/scalar JSON만 직접 파싱하고 repair는 하지 않는다.
"""

from __future__ import annotations

import re
from types import UnionType
from typing import Any, Union, get_args, get_origin

from json_repair import repair_json
from langchain_core.exceptions import OutputParserException
from langchain_core.output_parsers import BaseOutputParser
from pydantic import BaseModel, Field, PrivateAttr, TypeAdapter, ValidationError

JSON_FENCE_PATTERN = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.DOTALL)


class _PydanticParserBase(BaseOutputParser[Any]):
    """Pydantic schema 기반 object parser 공통 베이스다."""

    target_schema: type[BaseModel] = Field(exclude=True)
    _type_name: str = PrivateAttr(default="object_output_parser")

    @property
    def _type(self) -> str:
        return self._type_name


class JsonRepairObjectOutputParser(_PydanticParserBase):
    """Pydantic object output을 repair 경로까지 포함해 검증한다."""

    _type_name: str = PrivateAttr(default="json_repair_object_output_parser")

    def parse(self, text: str) -> BaseModel:
        try:
            payload = extract_json_like_text(text)
            repaired = repair_json(
                payload,
                return_objects=True,
                skip_json_loads=False,
            )
            normalized = _normalize_value_for_annotation(
                repaired,
                self.target_schema,
            )
            return self.target_schema.model_validate(normalized)
        except (ValidationError, ValueError, TypeError) as exc:
            raise OutputParserException(f"JSON object 파싱 실패: {exc}") from exc

    def get_format_instructions(self) -> str:
        return "Return exactly one JSON object."


def build_object_output_parser(
    schema: type[BaseModel],
) -> JsonRepairObjectOutputParser:
    """Object output parser를 생성한다."""

    return JsonRepairObjectOutputParser(target_schema=schema)


def parse_simple_output(text: str, annotation: Any) -> Any:
    """Top-level simple output을 파싱한다."""

    try:
        payload = extract_json_like_text(text)
        return TypeAdapter(annotation).validate_json(payload)
    except (ValidationError, ValueError, TypeError) as exc:
        raise OutputParserException(f"simple output 파싱 실패: {exc}") from exc


def simple_format_instructions(annotation: Any) -> str:
    """Simple contract용 format instructions를 생성한다."""

    if _is_list_annotation(annotation):
        return "Return exactly one JSON array."
    return "Return exactly one JSON value."


def output_type_name(annotation: Any) -> str:
    """Annotation이나 schema의 출력 타입 이름을 렌더링한다."""

    if isinstance(annotation, type):
        if issubclass(annotation, BaseModel):
            return annotation.__name__
        return annotation.__name__

    origin = get_origin(annotation)
    args = get_args(annotation)
    if origin is list and args:
        return f"list[{output_type_name(args[0])}]"
    if origin in (UnionType, Union):
        return " | ".join(output_type_name(arg) for arg in args)
    if str(origin).endswith("Literal") and args:
        return "Literal[" + ", ".join(repr(arg) for arg in args) + "]"
    return str(annotation)


def extract_json_like_text(text: str) -> str:
    """JSON fence 제거 후 JSON-like payload를 반환한다."""

    fenced = JSON_FENCE_PATTERN.search(text)
    if fenced:
        return fenced.group(1).strip()
    return text.strip()


def _normalize_value_for_annotation(value: Any, annotation: Any) -> Any:
    normalized_annotation = _unwrap_optional_annotation(annotation)
    nested_model = _extract_base_model(normalized_annotation)
    if nested_model is not None:
        return _normalize_model_payload(value, nested_model)

    origin = get_origin(normalized_annotation)
    args = get_args(normalized_annotation)

    if origin is list and args:
        item_annotation = _unwrap_optional_annotation(args[0])
        if isinstance(value, str):
            return [_normalize_value_for_annotation(value, item_annotation)]
        if not isinstance(value, list):
            return value
        return [
            _normalize_value_for_annotation(item, item_annotation) for item in value
        ]

    if origin is dict and len(args) == 2 and isinstance(value, dict):
        key_annotation = _unwrap_optional_annotation(args[0])
        value_annotation = _unwrap_optional_annotation(args[1])
        return {
            _normalize_value_for_annotation(key, key_annotation): (
                _normalize_value_for_annotation(item, value_annotation)
            )
            for key, item in value.items()
        }

    if normalized_annotation is str and isinstance(value, list):
        compact_items = [str(item).strip() for item in value if str(item).strip()]
        if len(compact_items) == 1:
            return compact_items[0]
    return value


def _normalize_model_payload(
    value: Any,
    schema: type[BaseModel],
) -> Any:
    if not isinstance(value, dict):
        return value

    normalized = dict(value)
    for field_name, field in schema.model_fields.items():
        if field_name not in normalized:
            continue
        normalized[field_name] = _normalize_value_for_annotation(
            normalized[field_name],
            field.annotation,
        )
    return normalized


def _unwrap_optional_annotation(annotation: Any) -> Any:
    origin = get_origin(annotation)
    if origin is None:
        return annotation
    if origin not in (UnionType, Union):
        return annotation

    args = tuple(arg for arg in get_args(annotation) if arg is not type(None))
    if len(args) == 1:
        return args[0]
    return annotation


def _extract_base_model(annotation: Any) -> type[BaseModel] | None:
    if isinstance(annotation, type) and issubclass(annotation, BaseModel):
        return annotation
    return None


def _is_list_annotation(annotation: Any) -> bool:
    return get_origin(annotation) is list
