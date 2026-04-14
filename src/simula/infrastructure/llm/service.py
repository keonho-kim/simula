"""목적:
- async-only structured LLM 호출과 fixer helper orchestration을 담당한다.

설명:
- primary structured parse 실패 시 fixer helper를 실행한다.
- low-level transport/meta 수집은 `StructuredLLMRouter`에 위임한다.

사용한 설계 패턴:
- service + helper orchestration 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.llm.router
- simula.infrastructure.llm.fixer
"""

from __future__ import annotations

import time
from typing import Any, TypeVar, cast

from langchain_core.exceptions import OutputParserException
from pydantic import BaseModel, ValidationError

from simula.application.ports.llm import SemanticValidator, StructuredCallMeta
from simula.infrastructure.config.models import AppSettings
from simula.application.workflow.helper.fixer import repair_structured_json
from simula.infrastructure.llm.output_parsers import build_output_parser
from simula.infrastructure.llm.router import (
    StructuredLLMRouter,
    _merge_token_count,
    _merge_ttft,
    build_raw_model_router,
)
from simula.infrastructure.llm.usage import LLMUsageTracker

SchemaT = TypeVar("SchemaT", bound=BaseModel)


class AsyncStructuredLLMService:
    """async structured calls와 fixer orchestration을 제공한다."""

    def __init__(self, router: StructuredLLMRouter) -> None:
        self.router = router

    @property
    def logger(self):  # noqa: ANN201
        return self.router.logger

    @logger.setter
    def logger(self, value) -> None:  # noqa: ANN001
        self.router.logger = value

    async def ainvoke_structured(
        self, role: str, prompt: str, schema: type[SchemaT]
    ) -> SchemaT:
        """비동기 structured 호출 결과만 반환한다."""

        parsed, _ = await self.ainvoke_structured_with_meta(role, prompt, schema)
        return parsed

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
        """비동기 structured 호출과 fixer fallback을 수행한다."""

        started_at = time.perf_counter()
        self.router._log_structured_call_start(role=role, log_context=log_context)

        parser = build_output_parser(schema)
        attempts = _build_structured_attempt_prompts(prompt, parser)
        ttft_seconds: float | None = None
        input_tokens: int | None = None
        output_tokens: int | None = None
        total_tokens: int | None = None
        last_error: Exception | None = None
        last_content = ""
        parse_failure_count = 0

        for candidate in attempts:
            (
                response,
                attempt_ttft,
                attempt_input,
                attempt_output,
                attempt_total,
            ) = await self.router._ainvoke_with_metrics(
                role,
                candidate,
                call_kind="structured",
            )
            ttft_seconds = _merge_ttft(ttft_seconds, attempt_ttft)
            input_tokens = _merge_token_count(input_tokens, attempt_input)
            output_tokens = _merge_token_count(output_tokens, attempt_output)
            total_tokens = _merge_token_count(total_tokens, attempt_total)
            try:
                content = _content_to_text(response.content).strip()
                last_content = content
                if not content:
                    raise ValueError("응답이 비어 있습니다.")
                parsed = cast(SchemaT, parser.parse(content))
                semantic_issues = _run_semantic_validator(
                    parsed,
                    semantic_validator=semantic_validator,
                )
                if semantic_issues:
                    raise ValueError(
                        "Semantic validation failed: "
                        + "; ".join(semantic_issues)
                    )
                self.router._log_structured_response(
                    role=role,
                    content=content,
                    parsed=parsed,
                    duration_seconds=time.perf_counter() - started_at,
                    ttft_seconds=ttft_seconds,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=total_tokens,
                    log_context=log_context,
                )
                self.router.usage_tracker.record_structured_outcome(
                    parse_failures=parse_failure_count,
                    forced_default=False,
                )
                return parsed, StructuredCallMeta(
                    parse_failure_count=parse_failure_count,
                    forced_default=False,
                    duration_seconds=time.perf_counter() - started_at,
                    last_content=last_content,
                    ttft_seconds=ttft_seconds,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=total_tokens,
                )
            except (
                OutputParserException,
                ValidationError,
                ValueError,
            ) as exc:
                last_error = exc
                parse_failure_count += 1

        _log_primary_parse_failure(
            logger=self.logger,
            role=role,
            last_error=last_error,
            last_content=last_content,
            log_context=log_context,
        )
        fixer_outcome = await repair_structured_json(
            router=self.router,
            content=last_content,
            parser=parser,
            semantic_validator=semantic_validator,
            repair_context=repair_context,
            failure_feedback=[str(last_error)] if last_error is not None else None,
        )
        last_content = fixer_outcome.content or last_content
        last_error = fixer_outcome.parse_error or last_error
        parse_failure_count += fixer_outcome.parse_failure_count
        ttft_seconds = _merge_ttft(ttft_seconds, fixer_outcome.ttft_seconds)
        input_tokens = _merge_token_count(input_tokens, fixer_outcome.input_tokens)
        output_tokens = _merge_token_count(output_tokens, fixer_outcome.output_tokens)
        total_tokens = _merge_token_count(total_tokens, fixer_outcome.total_tokens)

        if fixer_outcome.succeeded:
            parsed = cast(SchemaT, parser.parse(last_content))
            semantic_issues = _run_semantic_validator(
                parsed,
                semantic_validator=semantic_validator,
            )
            if semantic_issues:
                last_error = ValueError(
                    "Semantic validation failed after fixer: "
                    + "; ".join(semantic_issues)
                )
            else:
                self.router._log_structured_response(
                    role=role,
                    content=last_content,
                    parsed=parsed,
                    duration_seconds=time.perf_counter() - started_at,
                    ttft_seconds=ttft_seconds,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=total_tokens,
                    log_context=log_context,
                )
                self.router.usage_tracker.record_structured_outcome(
                    parse_failures=parse_failure_count,
                    forced_default=False,
                )
                return parsed, StructuredCallMeta(
                    parse_failure_count=parse_failure_count,
                    forced_default=False,
                    duration_seconds=time.perf_counter() - started_at,
                    last_content=last_content,
                    ttft_seconds=ttft_seconds,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=total_tokens,
                )

        if allow_default_on_failure and default_payload is not None:
            self.router._log_structured_response(
                role=role,
                content=last_content,
                parsed=None,
                duration_seconds=time.perf_counter() - started_at,
                ttft_seconds=ttft_seconds,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=total_tokens,
                log_context=log_context,
                parse_error=last_error,
            )
            self.logger.warning("%s 응답을 파싱하지 못해 기본값으로 강등합니다.", role)
            try:
                default_parsed = schema.model_validate(default_payload)
            except (ValidationError, ValueError, TypeError) as exc:
                raise ValueError(
                    f"{role} 기본 강등 payload가 스키마를 만족하지 않습니다. error={exc}"
                ) from exc
            self.router.usage_tracker.record_structured_outcome(
                parse_failures=parse_failure_count,
                forced_default=True,
            )
            return default_parsed, StructuredCallMeta(
                parse_failure_count=parse_failure_count,
                forced_default=True,
                duration_seconds=time.perf_counter() - started_at,
                last_content=last_content,
                ttft_seconds=ttft_seconds,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=total_tokens,
            )

        raise ValueError(
            f"{role} 구조화 응답 파싱에 실패했습니다. error={last_error}"
        ) from last_error

    def invoke_text_with_meta(
        self,
        role: str,
        prompt: str,
        *,
        log_context: dict[str, object] | None = None,
    ) -> tuple[str, StructuredCallMeta]:
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
    ) -> tuple[str, StructuredCallMeta]:
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
    """앱이 사용할 structured LLM service를 생성한다."""

    return AsyncStructuredLLMService(
        build_raw_model_router(settings, usage_tracker=usage_tracker)
    )


def _build_structured_attempt_prompts(prompt: str, parser: Any) -> tuple[str, str]:
    strict_suffix = parser.get_format_instructions()
    return (
        prompt,
        f"{prompt}\n\n{strict_suffix}\nDo not add code fences or explanatory text.",
    )


def _content_to_text(content: Any) -> str:
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        chunks: list[str] = []
        for item in content:
            if isinstance(item, str):
                chunks.append(item)
            elif isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    chunks.append(text)
        return "\n".join(chunks)

    return str(content)


def _log_primary_parse_failure(
    *,
    logger: Any,
    role: str,
    last_error: Exception | None,
    last_content: str,
    log_context: dict[str, object] | None,
) -> None:
    if last_error is None:
        return

    logger.debug(
        "\n%s primary structured parse failed\ncontext: %s\nparse_error: %s\nfull_response:\n%s\n",
        role,
        log_context or {},
        last_error,
        last_content,
    )


def _run_semantic_validator(
    parsed: SchemaT,
    *,
    semantic_validator: SemanticValidator[SchemaT] | None,
) -> list[str]:
    if semantic_validator is None:
        return []
    issues = semantic_validator(parsed)
    return [issue.strip() for issue in issues if issue.strip()]
