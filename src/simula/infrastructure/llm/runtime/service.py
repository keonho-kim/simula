"""Structured contract service facade."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, TypeVar, cast

from pydantic import BaseModel

from simula.application.ports.llm import (
    LLMCallMeta,
    ObjectFailurePolicy,
    ObjectOutputSpec,
    ObjectSemanticCoercer,
    ObjectSemanticValidator,
    SimpleFailurePolicy,
    SimpleOutputSpec,
    SimpleSemanticValidator,
)
from simula.infrastructure.config.models import AppSettings
from simula.infrastructure.llm.output_parsers import (
    output_type_name,
    simple_format_instructions,
)
from simula.infrastructure.llm.runtime.object_contract import run_object_contract
from simula.infrastructure.llm.runtime.router import (
    StructuredLLMRouter,
    build_raw_model_router,
)
from simula.infrastructure.llm.runtime.simple_contract import run_simple_contract
from simula.infrastructure.llm.usage import LLMUsageTracker

SchemaT = TypeVar("SchemaT", bound=BaseModel)
SimpleT = TypeVar("SimpleT")


class AsyncStructuredLLMService:
    """object/simple/text contract 호출 서비스를 제공한다."""

    def __init__(self, router: StructuredLLMRouter) -> None:
        self.router = router

    @property
    def logger(self):  # noqa: ANN201
        return self.router.logger

    @logger.setter
    def logger(self, value) -> None:  # noqa: ANN001
        self.router.logger = value

    def configure_run_logging(
        self,
        *,
        run_id: str,
        stream_event_sink: Callable[[dict[str, object]], object] | None,
    ) -> None:
        """Attach per-run JSONL logging for raw LLM calls."""

        self.router.configure_run_logging(
            run_id=run_id,
            stream_event_sink=stream_event_sink,
        )

    async def ainvoke_object(
        self,
        role: str,
        prompt: str,
        schema: type[SchemaT],
    ) -> SchemaT:
        """비동기 object contract 결과만 반환한다."""

        parsed, _ = await self.ainvoke_object_with_meta(role, prompt, schema)
        return parsed

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

        spec = ObjectOutputSpec(
            schema=schema,
            failure_policy=failure_policy,
            default_payload=default_payload,
            repair_context=repair_context,
            semantic_validator=cast(
                Callable[[BaseModel], list[str]] | None,
                semantic_validator,
            ),
            semantic_coercer=cast(
                Callable[[BaseModel], tuple[BaseModel, list[str]]] | None,
                semantic_coercer,
            ),
            max_attempts=max_attempts,
        )
        return await run_object_contract(
            router=self.router,
            logger=self.logger,
            role=role,
            prompt=prompt,
            spec=spec,
            log_context=log_context,
        )

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

        spec = SimpleOutputSpec(
            annotation=annotation,
            failure_policy=failure_policy,
            default_value=default_value,
            repair_context=repair_context,
            semantic_validator=cast(
                Callable[[object], list[str]] | None,
                semantic_validator,
            ),
            format_instructions=simple_format_instructions(annotation),
            type_name=output_type_name(annotation),
            max_attempts=max_attempts,
        )
        return await run_simple_contract(
            router=self.router,
            logger=self.logger,
            role=role,
            prompt=prompt,
            spec=spec,
            log_context=log_context,
        )

    def invoke_text_with_meta(
        self,
        role: str,
        prompt: str,
        *,
        log_context: dict[str, object] | None = None,
    ) -> tuple[str, LLMCallMeta]:
        """동기 원문 응답 호출을 low-level router에 위임한다."""

        return self.router.invoke_text_with_meta(
            role,
            prompt,
            log_context=log_context,
        )

    async def ainvoke_text_with_meta(
        self,
        role: str,
        prompt: str,
        *,
        log_context: dict[str, object] | None = None,
    ) -> tuple[str, LLMCallMeta]:
        """비동기 원문 응답 호출을 low-level router에 위임한다."""

        return await self.router.ainvoke_text_with_meta(
            role,
            prompt,
            log_context=log_context,
        )


def build_model_router(
    settings: AppSettings,
    *,
    usage_tracker: LLMUsageTracker,
) -> AsyncStructuredLLMService:
    """앱이 사용할 LLM service를 생성한다."""

    return AsyncStructuredLLMService(
        build_raw_model_router(settings, usage_tracker=usage_tracker)
    )
