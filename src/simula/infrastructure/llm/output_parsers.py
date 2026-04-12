"""목적:
- LangChain 출력 파서를 이용해 JSON 구조화 응답을 검증한다.

설명:
- JSON 경로는 항상 `json_repair` 를 사용해 복구를 시도한다.

사용한 설계 패턴:
- LangChain BaseOutputParser 패턴

연관된 다른 모듈/구조:
- simula.llm.factory
- simula.prompts.shared.output_examples
"""

from __future__ import annotations

import re
from typing import Any

from json_repair import repair_json
from langchain_core.exceptions import OutputParserException
from langchain_core.output_parsers import BaseOutputParser
from pydantic import BaseModel, Field, PrivateAttr, ValidationError

JSON_FENCE_PATTERN = re.compile(r"```(?:json)?\s*(\{.*\})\s*```", re.DOTALL)


class _PydanticParserBase(BaseOutputParser[Any]):
    """Pydantic schema 기반 출력 파서의 공통 베이스다."""

    target_schema: type[BaseModel] = Field(exclude=True)
    _type_name: str = PrivateAttr(default="structured_parser")

    @property
    def _type(self) -> str:
        return self._type_name


class JsonRepairOutputParser(_PydanticParserBase):
    """JSON 응답을 항상 repair 경로까지 시도해 검증한다."""

    _type_name: str = PrivateAttr(default="json_repair_output_parser")

    def parse(self, text: str) -> BaseModel:
        try:
            payload = _extract_json_like_text(text)
            repaired = repair_json(
                payload,
                return_objects=True,
                skip_json_loads=False,
            )
            return self.target_schema.model_validate(repaired)
        except (ValidationError, ValueError, TypeError) as exc:
            raise OutputParserException(f"JSON 파싱 실패: {exc}") from exc

    def get_format_instructions(self) -> str:
        return "Return exactly one JSON object."


def build_output_parser(schema: type[BaseModel]) -> JsonRepairOutputParser:
    """JSON 출력 파서를 생성한다."""

    return JsonRepairOutputParser(target_schema=schema)


def _extract_json_like_text(text: str) -> str:
    fenced = JSON_FENCE_PATTERN.search(text)
    if fenced:
        return fenced.group(1)
    return text.strip()
