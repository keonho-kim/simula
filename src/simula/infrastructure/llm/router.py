"""목적:
- provider별 chat model 생성과 구조화 응답 파싱을 담당한다.

설명:
- OpenAI, Anthropic, Google, Ollama, vLLM(OpenAI 호환) 연결을 한 곳에서 통일한다.
- 응답은 LangChain 출력 파서를 통해 JSON 형식으로 검증한다.

사용한 설계 패턴:
- 팩토리 + 역할 라우터 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.config.models
- simula.domain.contracts
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, TypeAlias, TypeVar, cast

from langchain_core.exceptions import OutputParserException
from langchain_core.language_models import BaseChatModel
from langchain_core.runnables import RunnableLambda
from pydantic import BaseModel, ValidationError

from simula.application.ports.llm import StructuredCallMeta
from simula.infrastructure.config.models import AppSettings
from simula.infrastructure.llm.output_parsers import build_output_parser
from simula.infrastructure.llm.providers import build_provider_chat_model
from simula.infrastructure.llm.renderers import (
    render_structured_response,
    render_text_response,
)

SchemaT = TypeVar("SchemaT", bound=BaseModel)
ModelResponseMetrics: TypeAlias = tuple[
    Any, float | None, int | None, int | None, int | None
]


@dataclass(slots=True)
class StructuredLLMRouter:
    """역할별 모델 선택과 구조화 호출을 담당한다."""

    logger: logging.Logger
    planner: BaseChatModel
    generator: BaseChatModel
    coordinator: BaseChatModel
    actor: BaseChatModel
    observer: BaseChatModel

    def for_role(self, role: str) -> BaseChatModel:
        """역할 이름으로 모델을 반환한다."""

        try:
            return getattr(self, role)
        except AttributeError as exc:
            raise ValueError(f"지원하지 않는 역할입니다: {role}") from exc

    def invoke_structured(
        self, role: str, prompt: str, schema: type[SchemaT]
    ) -> SchemaT:
        """RunnableSequence로 LLM을 호출하고 schema를 검증한다."""

        runnable = _build_structured_runnable(self.for_role(role), schema)
        return cast(SchemaT, runnable.invoke(prompt))

    def invoke_structured_with_meta(
        self,
        role: str,
        prompt: str,
        schema: type[SchemaT],
        *,
        allow_default_on_failure: bool = False,
        default_payload: dict[str, object] | None = None,
        log_context: dict[str, object] | None = None,
    ) -> tuple[SchemaT, StructuredCallMeta]:
        """LLM 구조화 응답과 메타데이터를 함께 반환한다."""

        started_at = time.perf_counter()
        self._log_structured_call_start(role=role, log_context=log_context)
        return self._execute_structured_attempts(
            role=role,
            schema=schema,
            prompt=prompt,
            invoke_attempt=self._invoke_with_metrics,
            allow_default_on_failure=allow_default_on_failure,
            default_payload=default_payload,
            log_context=log_context,
            started_at=started_at,
        )

    async def ainvoke_structured(
        self, role: str, prompt: str, schema: type[SchemaT]
    ) -> SchemaT:
        """RunnableSequence로 비동기 LLM을 호출하고 schema를 검증한다."""

        runnable = _build_structured_runnable(self.for_role(role), schema)
        return cast(SchemaT, await runnable.ainvoke(prompt))

    async def ainvoke_structured_with_meta(
        self,
        role: str,
        prompt: str,
        schema: type[SchemaT],
        *,
        allow_default_on_failure: bool = False,
        default_payload: dict[str, object] | None = None,
        log_context: dict[str, object] | None = None,
    ) -> tuple[SchemaT, StructuredCallMeta]:
        """비동기 LLM 구조화 응답과 메타데이터를 함께 반환한다."""

        started_at = time.perf_counter()
        self._log_structured_call_start(role=role, log_context=log_context)
        return await self._aexecute_structured_attempts(
            role=role,
            schema=schema,
            prompt=prompt,
            invoke_attempt=self._ainvoke_with_metrics,
            allow_default_on_failure=allow_default_on_failure,
            default_payload=default_payload,
            log_context=log_context,
            started_at=started_at,
        )

    def invoke_text_with_meta(
        self,
        role: str,
        prompt: str,
        *,
        log_context: dict[str, object] | None = None,
    ) -> tuple[str, StructuredCallMeta]:
        """LLM 원문 응답과 메타데이터를 함께 반환한다."""

        started_at = time.perf_counter()
        self._log_structured_call_start(role=role, log_context=log_context)
        response, ttft_seconds, input_tokens, output_tokens, total_tokens = (
            self._invoke_with_metrics(role, prompt)
        )
        content = _content_to_text(response.content).strip()
        if not content:
            raise ValueError("응답이 비어 있습니다.")
        self._log_text_response(
            role=role,
            content=content,
            duration_seconds=time.perf_counter() - started_at,
            ttft_seconds=ttft_seconds,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            log_context=log_context,
        )
        return content, StructuredCallMeta(
            parse_failure_count=0,
            forced_default=False,
            duration_seconds=time.perf_counter() - started_at,
            last_content=content,
            ttft_seconds=ttft_seconds,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
        )

    async def ainvoke_text_with_meta(
        self,
        role: str,
        prompt: str,
        *,
        log_context: dict[str, object] | None = None,
    ) -> tuple[str, StructuredCallMeta]:
        """비동기 LLM 원문 응답과 메타데이터를 함께 반환한다."""

        started_at = time.perf_counter()
        self._log_structured_call_start(role=role, log_context=log_context)
        (
            response,
            ttft_seconds,
            input_tokens,
            output_tokens,
            total_tokens,
        ) = await self._ainvoke_with_metrics(role, prompt)
        content = _content_to_text(response.content).strip()
        if not content:
            raise ValueError("응답이 비어 있습니다.")
        self._log_text_response(
            role=role,
            content=content,
            duration_seconds=time.perf_counter() - started_at,
            ttft_seconds=ttft_seconds,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            log_context=log_context,
        )
        return content, StructuredCallMeta(
            parse_failure_count=0,
            forced_default=False,
            duration_seconds=time.perf_counter() - started_at,
            last_content=content,
            ttft_seconds=ttft_seconds,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
        )

    def _execute_structured_attempts(
        self,
        *,
        role: str,
        schema: type[SchemaT],
        prompt: str,
        invoke_attempt: Callable[[str, str], ModelResponseMetrics],
        allow_default_on_failure: bool,
        default_payload: dict[str, object] | None,
        log_context: dict[str, object] | None,
        started_at: float,
    ) -> tuple[SchemaT, StructuredCallMeta]:
        """동기 구조화 호출 공통 파이프라인이다."""

        parser = build_output_parser(schema)
        strict_suffix = parser.get_format_instructions()
        attempts = (
            prompt,
            f"{prompt}\n\n{strict_suffix}\nDo not add code fences or explanatory text.",
        )
        ttft_seconds: float | None = None
        input_tokens: int | None = None
        output_tokens: int | None = None
        total_tokens: int | None = None
        last_error: Exception | None = None
        last_content = ""
        parse_failure_count = 0

        for candidate in attempts:
            response, attempt_ttft, attempt_input, attempt_output, attempt_total = (
                invoke_attempt(role, candidate)
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
                self._log_structured_response(
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
                json.JSONDecodeError,
            ) as exc:
                last_error = exc
                parse_failure_count += 1

        if allow_default_on_failure and default_payload is not None:
            self._log_structured_response(
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

    async def _aexecute_structured_attempts(
        self,
        *,
        role: str,
        schema: type[SchemaT],
        prompt: str,
        invoke_attempt: Callable[
            [str, str],
            Awaitable[ModelResponseMetrics],
        ],
        allow_default_on_failure: bool,
        default_payload: dict[str, object] | None,
        log_context: dict[str, object] | None,
        started_at: float,
    ) -> tuple[SchemaT, StructuredCallMeta]:
        """비동기 구조화 호출 공통 파이프라인이다."""

        parser = build_output_parser(schema)
        strict_suffix = parser.get_format_instructions()
        attempts = (
            prompt,
            f"{prompt}\n\n{strict_suffix}\nDo not add code fences or explanatory text.",
        )
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
            ) = await invoke_attempt(role, candidate)
            ttft_seconds = _merge_ttft(ttft_seconds, attempt_ttft)
            input_tokens = _merge_token_count(input_tokens, attempt_input)
            output_tokens = _merge_token_count(output_tokens, attempt_output)
            total_tokens = _merge_token_count(total_tokens, attempt_total)
            try:
                content = _content_to_text(response.content).strip()
                last_content = content
                if not content:
                    raise ValueError("응답이 비어 있습니다.")
                parsed = cast(SchemaT, await asyncio.to_thread(parser.parse, content))
                self._log_structured_response(
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
                json.JSONDecodeError,
            ) as exc:
                last_error = exc
                parse_failure_count += 1

        if allow_default_on_failure and default_payload is not None:
            self._log_structured_response(
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

    def _invoke_with_metrics(
        self,
        role: str,
        prompt: str,
    ) -> tuple[Any, float | None, int | None, int | None, int | None]:
        """응답과 벤치마크용 메타데이터를 함께 수집한다."""

        model = self.for_role(role)
        started_at = time.perf_counter()
        first_chunk_at: float | None = None
        merged_chunk: Any | None = None
        for chunk in model.stream(prompt):
            if first_chunk_at is None:
                first_chunk_at = time.perf_counter()
            merged_chunk = chunk if merged_chunk is None else merged_chunk + chunk

        if merged_chunk is None:
            raise ValueError(f"{role} stream 응답이 비어 있습니다.")

        input_tokens, output_tokens, total_tokens = _extract_token_usage(merged_chunk)
        ttft_seconds = (
            first_chunk_at - started_at if first_chunk_at is not None else None
        )
        return (
            merged_chunk,
            ttft_seconds,
            input_tokens,
            output_tokens,
            total_tokens,
        )

    async def _ainvoke_with_metrics(
        self,
        role: str,
        prompt: str,
    ) -> tuple[Any, float | None, int | None, int | None, int | None]:
        """비동기 응답과 메타데이터를 함께 수집한다."""

        model = self.for_role(role)
        started_at = time.perf_counter()
        first_chunk_at: float | None = None
        merged_chunk: Any | None = None
        async for chunk in model.astream(prompt):
            if first_chunk_at is None:
                first_chunk_at = time.perf_counter()
            merged_chunk = chunk if merged_chunk is None else merged_chunk + chunk

        if merged_chunk is None:
            raise ValueError(f"{role} astream 응답이 비어 있습니다.")

        input_tokens, output_tokens, total_tokens = _extract_token_usage(merged_chunk)
        ttft_seconds = (
            first_chunk_at - started_at if first_chunk_at is not None else None
        )
        return (
            merged_chunk,
            ttft_seconds,
            input_tokens,
            output_tokens,
            total_tokens,
        )

    def _log_structured_response(
        self,
        *,
        role: str,
        content: str,
        parsed: BaseModel | None,
        duration_seconds: float,
        ttft_seconds: float | None,
        input_tokens: int | None,
        output_tokens: int | None,
        total_tokens: int | None,
        log_context: dict[str, object] | None,
        parse_error: Exception | None = None,
    ) -> None:
        """완료된 구조화 응답을 보기 좋은 형태로 로그에 남긴다."""

        pretty_text = _pretty_response_text(
            role=role,
            parsed=parsed,
            content=content,
            log_context=log_context,
        )
        meta_line = _format_metrics_line(
            duration_seconds=duration_seconds,
            ttft_seconds=ttft_seconds,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
        )
        if parse_error is not None:
            meta_line = f"{meta_line}\n파싱 경고: {parse_error}"

        self.logger.info(
            "\n%s\n%s\n%s\n",
            _format_response_title(role=role, log_context=log_context),
            pretty_text,
            meta_line,
        )

    def _log_structured_call_start(
        self,
        *,
        role: str,
        log_context: dict[str, object] | None,
    ) -> None:
        """구조화 LLM 호출 시작 로그를 남긴다."""

        suffix = _format_log_context_suffix(log_context)
        message = _format_call_start_message(role=role, log_context=log_context)
        if suffix:
            message = f"{message} | {suffix}"
        self.logger.info(message)

    def _log_text_response(
        self,
        *,
        role: str,
        content: str,
        duration_seconds: float,
        ttft_seconds: float | None,
        input_tokens: int | None,
        output_tokens: int | None,
        total_tokens: int | None,
        log_context: dict[str, object] | None,
    ) -> None:
        """완료된 원문 응답을 보기 좋은 형태로 로그에 남긴다."""
        meta_line = _format_metrics_line(
            duration_seconds=duration_seconds,
            ttft_seconds=ttft_seconds,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
        )
        pretty_text = render_text_response(
            role=role,
            content=_strip_json_fence(content),
            log_context=log_context,
        )
        self.logger.info(
            "\n%s\n%s\n%s\n",
            _format_response_title(role=role, log_context=log_context),
            pretty_text,
            meta_line,
        )


def build_model_router(
    settings: AppSettings,
) -> StructuredLLMRouter:
    """역할별 모델 라우터를 생성한다."""

    return StructuredLLMRouter(
        logger=logging.getLogger("simula.llm"),
        planner=build_provider_chat_model(settings.models.planner),
        generator=build_provider_chat_model(settings.models.generator),
        coordinator=build_provider_chat_model(settings.models.coordinator),
        actor=build_provider_chat_model(settings.models.actor),
        observer=build_provider_chat_model(settings.models.observer),
    )


def _merge_ttft(current: float | None, candidate: float | None) -> float | None:
    if current is not None:
        return current
    return candidate


def _merge_token_count(current: int | None, candidate: int | None) -> int | None:
    if candidate is None:
        return current
    if current is None:
        return candidate
    return current + candidate


def _extract_token_usage(
    message: Any,
) -> tuple[int | None, int | None, int | None]:
    usage_metadata = getattr(message, "usage_metadata", None)
    usage = usage_metadata if isinstance(usage_metadata, dict) else {}
    input_tokens = _coerce_token_count(
        usage.get("input_tokens") or usage.get("prompt_tokens")
    )
    output_tokens = _coerce_token_count(
        usage.get("output_tokens") or usage.get("completion_tokens")
    )
    total_tokens = _coerce_token_count(usage.get("total_tokens"))

    if (
        input_tokens is not None
        or output_tokens is not None
        or total_tokens is not None
    ):
        return input_tokens, output_tokens, total_tokens
    response_metadata = getattr(message, "response_metadata", None)
    if not isinstance(response_metadata, dict):
        return None, None, None

    token_usage = response_metadata.get("token_usage") or response_metadata.get("usage")
    if not isinstance(token_usage, dict):
        return None, None, None

    return (
        _coerce_token_count(
            token_usage.get("input_tokens") or token_usage.get("prompt_tokens")
        ),
        _coerce_token_count(
            token_usage.get("output_tokens") or token_usage.get("completion_tokens")
        ),
        _coerce_token_count(token_usage.get("total_tokens")),
    )


def _format_log_context_suffix(log_context: dict[str, object] | None) -> str:
    if not log_context:
        return ""

    parts: list[str] = []
    step_index = log_context.get("step_index")
    if step_index is not None:
        parts.append(f"step_index={step_index}")

    actor_display_name = log_context.get("actor_display_name")
    actor_id = log_context.get("actor_id")
    if actor_display_name is not None and actor_id is not None:
        parts.append(f"actor={actor_display_name}({actor_id})")
    elif actor_display_name is not None:
        parts.append(f"actor={actor_display_name}")
    elif actor_id is not None:
        parts.append(f"actor_id={actor_id}")

    slot_index = log_context.get("slot_index")
    if slot_index is not None:
        parts.append(f"slot_index={slot_index}")

    section = log_context.get("section")
    if section is not None:
        parts.append(f"section={section}")
    return " ".join(parts)


def _format_call_start_message(
    *,
    role: str,
    log_context: dict[str, object] | None,
) -> str:
    scope = str(log_context.get("scope")) if log_context else ""
    if role == "planner":
        if not scope:
            return "planner 호출 시작"
        return _planner_scope_label(scope, suffix="시작")
    if role == "generator":
        return "주체 카드 생성 시작"
    if role == "actor":
        return "행동 제안 시작"
    if role == "observer":
        return _observer_scope_label(scope, suffix="시작")
    return f"{role} 호출 시작"


def _format_response_header(
    *,
    role: str,
    log_context: dict[str, object] | None,
) -> str:
    scope = str(log_context.get("scope")) if log_context else ""
    if role == "planner":
        return _planner_scope_label(scope)
    if role == "generator":
        return "주체 카드 생성"
    if role == "actor":
        return "행동 제안"
    if role == "observer":
        return _observer_scope_label(scope)
    return role


def _format_response_title(
    *,
    role: str,
    log_context: dict[str, object] | None,
) -> str:
    return f"{_format_response_header(role=role, log_context=log_context)} 완료"


def _planner_scope_label(scope: str, *, suffix: str = "") -> str:
    labels = {
        "interpretation-core": "planner · 핵심 전제 정리",
        "runtime-window": "planner · 실행 시간축 결정",
        "interpretation-time": "planner · 시간 범위 정리",
        "interpretation-visibility": "planner · 공개/비공개 맥락 정리",
        "interpretation-pressure": "planner · 압박 요인·관찰 포인트 정리",
        "situation": "planner · 상황 정리",
        "cast_roster": "planner · 등장 주체 목록 확정",
    }
    base = labels.get(scope, "planner")
    if suffix:
        return f"{base} {suffix}"
    return base


def _observer_scope_label(scope: str, *, suffix: str = "") -> str:
    labels = {
        "event": "observer · 상황 이벤트 생성",
        "final-report": "observer · 최종 보고서 작성",
    }
    base = labels.get(scope, "관찰 요약")
    if suffix:
        return f"{base} {suffix}"
    return base


def _format_metrics_line(
    *,
    duration_seconds: float,
    ttft_seconds: float | None,
    input_tokens: int | None,
    output_tokens: int | None,
    total_tokens: int | None,
) -> str:
    return (
        f"소요 {duration_seconds:.2f}s"
        f" | 첫 응답 {_format_optional_number(ttft_seconds)}"
        f" | 토큰 입력 {_format_optional_int(input_tokens)}"
        f" / 출력 {_format_optional_int(output_tokens)}"
        f" / 전체 {_format_optional_int(total_tokens)}"
    )


def _coerce_token_count(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except TypeError, ValueError:
        return None


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


def _pretty_response_text(
    *,
    role: str,
    parsed: BaseModel | None,
    content: str,
    log_context: dict[str, object] | None,
) -> str:
    return render_structured_response(
        role=role,
        parsed=parsed,
        content=_strip_json_fence(content),
        log_context=log_context,
    )


def _build_structured_runnable(
    model: BaseChatModel,
    schema: type[SchemaT],
):
    """prompt -> model -> JSON 파싱 RunnableSequence를 생성한다."""

    parser = build_output_parser(schema)
    return (
        _coerce_model_runnable(model)
        | RunnableLambda(_extract_response_content)
        | RunnableLambda(parser.parse)
    )


def _extract_response_content(response: Any) -> str:
    """RunnableSequence 내부에서 모델 응답 content를 문자열로 정리한다."""

    content = _content_to_text(response.content).strip()
    if not content:
        raise ValueError("응답이 비어 있습니다.")
    return content


def _coerce_model_runnable(model: Any):
    """BaseChatModel 또는 테스트 더블을 Runnable로 감싼다."""

    if isinstance(model, BaseChatModel):
        return model
    return RunnableLambda(
        lambda prompt: model.invoke(prompt),
        afunc=lambda prompt: model.ainvoke(prompt),
    )


def _format_optional_int(value: int | None) -> str:
    if value is None:
        return "-"
    return str(value)


def _format_optional_number(value: float | None) -> str:
    if value is None:
        return "-"
    return f"{value:.2f}s"


def _strip_json_fence(content: str) -> str:
    stripped = content.strip()
    if stripped.startswith("```") and stripped.endswith("```"):
        lines = stripped.splitlines()
        if len(lines) >= 3:
            return "\n".join(lines[1:-1]).strip()
    return stripped
