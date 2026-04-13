"""목적:
- 구조화 LLM 호출 포트를 정의한다.

설명:
- 그래프 노드와 실행 서비스가 구체 LLM 구현에 직접 의존하지 않도록 공통 호출 계약을 둔다.

사용한 설계 패턴:
- 포트/프로토콜 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.llm.router
- simula.application.workflow.context
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Protocol, TypeVar

from pydantic import BaseModel

SchemaT = TypeVar("SchemaT", bound=BaseModel)
type SemanticValidator[SchemaT: BaseModel] = Callable[[SchemaT], list[str]]


@dataclass(slots=True)
class StructuredCallMeta:
    """구조화 호출 메타데이터다."""

    parse_failure_count: int
    forced_default: bool
    duration_seconds: float
    last_content: str
    ttft_seconds: float | None
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None


class StructuredLLM(Protocol):
    """구조화 LLM 라우터 공통 포트다."""

    async def ainvoke_structured(
        self, role: str, prompt: str, schema: type[SchemaT]
    ) -> SchemaT:
        """비동기 LLM을 호출하고 schema를 검증한다."""

    async def ainvoke_structured_with_meta(
        self,
        role: str,
        prompt: str,
        schema: type[SchemaT],
        *,
        allow_default_on_failure: bool = False,
        default_payload: dict[str, object] | None = None,
        log_context: dict[str, object] | None = None,
        semantic_validator: SemanticValidator[SchemaT] | None = None,
        repair_context: dict[str, object] | None = None,
    ) -> tuple[SchemaT, StructuredCallMeta]:
        """비동기 LLM 구조화 응답과 메타데이터를 함께 반환한다."""

    def invoke_text_with_meta(
        self,
        role: str,
        prompt: str,
        *,
        log_context: dict[str, object] | None = None,
    ) -> tuple[str, StructuredCallMeta]:
        """LLM 원문 응답과 메타데이터를 함께 반환한다."""

    async def ainvoke_text_with_meta(
        self,
        role: str,
        prompt: str,
        *,
        log_context: dict[str, object] | None = None,
    ) -> tuple[str, StructuredCallMeta]:
        """비동기 LLM 원문 응답과 메타데이터를 함께 반환한다."""
