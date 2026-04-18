"""목적:
- LLM output contract 호출 포트를 정의한다.

설명:
- workflow 노드와 실행 서비스가 구체 LLM 구현에 직접 의존하지 않도록
  object/simple/text 계약 기준의 공통 호출 인터페이스를 둔다.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Literal, Protocol, TypeVar

from pydantic import BaseModel

SchemaT = TypeVar("SchemaT", bound=BaseModel)
SimpleT = TypeVar("SimpleT")

type ObjectSemanticValidator[SchemaT: BaseModel] = Callable[[SchemaT], list[str]]
type ObjectSemanticCoercer[SchemaT: BaseModel] = Callable[
    [SchemaT], tuple[SchemaT, list[str]]
]
type SimpleSemanticValidator[SimpleT] = Callable[[SimpleT], list[str]]

ContractKind = Literal["object", "simple", "text"]
ObjectFailurePolicy = Literal["fixer", "default", "fail"]
SimpleFailurePolicy = Literal["fixer", "default", "fail"]


@dataclass(slots=True)
class LLMCallMeta:
    """LLM 호출 메타데이터다."""

    contract_kind: ContractKind
    output_type_name: str
    parse_failure_count: int
    forced_default: bool
    duration_seconds: float
    last_content: str
    ttft_seconds: float | None
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None
    fixer_used: bool = False
    provider_structured_mode: str = "prompt_parse"
    prompt_variant: str = ""
    semantic_coercion_used: bool = False
    semantic_coercion_reasons: list[str] = field(default_factory=list)
    post_coercion_valid: bool | None = None
    retry_stage: str = ""
    retry_route: str = ""
    retry_attempt: int = 0
    retry_budget: int = 0
    retry_reason: str = ""
    missing_field_paths: list[str] = field(default_factory=list)
    transport_retry_attempt: int = 1
    transport_retry_budget: int = 1
    transport_error_type: str = ""


@dataclass(slots=True)
class ObjectOutputSpec:
    """Pydantic object output contract다."""

    schema: type[BaseModel]
    failure_policy: ObjectFailurePolicy = "fixer"
    default_payload: dict[str, object] | None = None
    repair_context: dict[str, object] | None = None
    semantic_validator: Callable[[BaseModel], list[str]] | None = None
    semantic_coercer: Callable[[BaseModel], tuple[BaseModel, list[str]]] | None = None
    max_attempts: int = 5


@dataclass(slots=True)
class SimpleOutputSpec:
    """Top-level simple output contract다."""

    annotation: Any
    failure_policy: SimpleFailurePolicy = "fail"
    default_value: object | None = None
    repair_context: dict[str, object] | None = None
    semantic_validator: Callable[[object], list[str]] | None = None
    format_instructions: str = ""
    type_name: str = field(default="")
    max_attempts: int = 5


class StructuredLLM(Protocol):
    """LLM output contract 호출 포트다."""

    async def ainvoke_object(
        self,
        role: str,
        prompt: str,
        schema: type[SchemaT],
    ) -> SchemaT:
        """비동기 object contract 호출 결과만 반환한다."""

    async def ainvoke_object_with_meta(
        self,
        role: str,
        prompt: str,
        schema: type[SchemaT],
        *,
        failure_policy: ObjectFailurePolicy = "fixer",
        default_payload: dict[str, object] | None = None,
        log_context: dict[str, object] | None = None,
        semantic_validator: ObjectSemanticValidator[SchemaT] | None = None,
        semantic_coercer: ObjectSemanticCoercer[SchemaT] | None = None,
        repair_context: dict[str, object] | None = None,
        max_attempts: int = 5,
    ) -> tuple[SchemaT, LLMCallMeta]:
        """비동기 object contract 응답과 메타데이터를 함께 반환한다."""

    async def ainvoke_simple_with_meta(
        self,
        role: str,
        prompt: str,
        annotation: Any,
        *,
        failure_policy: SimpleFailurePolicy = "fail",
        default_value: SimpleT | None = None,
        repair_context: dict[str, object] | None = None,
        log_context: dict[str, object] | None = None,
        semantic_validator: SimpleSemanticValidator[SimpleT] | None = None,
        max_attempts: int = 5,
    ) -> tuple[SimpleT, LLMCallMeta]:
        """비동기 simple contract 응답과 메타데이터를 함께 반환한다."""

    def invoke_text_with_meta(
        self,
        role: str,
        prompt: str,
        *,
        log_context: dict[str, object] | None = None,
    ) -> tuple[str, LLMCallMeta]:
        """LLM 원문 응답과 메타데이터를 함께 반환한다."""

    async def ainvoke_text_with_meta(
        self,
        role: str,
        prompt: str,
        *,
        log_context: dict[str, object] | None = None,
    ) -> tuple[str, LLMCallMeta]:
        """비동기 LLM 원문 응답과 메타데이터를 함께 반환한다."""
