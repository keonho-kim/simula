"""목적:
- provider별 chat model 생성과 원문/meta 수집을 담당한다.

설명:
- OpenAI, OpenAI-compatible, Anthropic, Google, Bedrock 연결을 한 곳에서 통일한다.
- structured parsing orchestration은 상위 서비스에서 수행하고,
  이 라우터는 role별 raw text 호출과 공통 로그/meta만 제공한다.

사용한 설계 패턴:
- 팩토리 + 역할 라우터 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.config.models
- simula.infrastructure.llm.runtime.service
"""

from __future__ import annotations
import asyncio
import logging
import random
import time
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import httpx
from langchain_core.language_models import BaseChatModel
from pydantic import BaseModel

from simula.shared.logging.llm import ensure_llm_log_context
from simula.application.ports.llm import LLMCallMeta
from simula.infrastructure.config.models import AppSettings, ModelConfig
from simula.domain.reporting.events import build_llm_call_event
from simula.infrastructure.llm.providers import build_provider_chat_model
from simula.infrastructure.llm.runtime.content import content_to_text
from simula.infrastructure.llm.runtime.logging import (
    format_call_start_message,
    format_log_context_suffix,
    format_metrics_line,
    format_response_title,
    json_safe_mapping,
    pretty_object_response_text,
    pretty_simple_response_text,
    pretty_text_response_text,
)
from simula.infrastructure.llm.runtime.metrics import extract_token_usage
from simula.infrastructure.llm.usage import CallKind, LLMUsageTracker

_SLOW_CALL_INFO_THRESHOLD_SECONDS = 15.0
_TRANSPORT_RETRY_BUDGET = 3
_TRANSPORT_RETRY_BASE_DELAY_SECONDS = 0.75
_TRANSPORT_RETRY_JITTER_SECONDS = 0.25


@dataclass(slots=True)
class TransportCallResult:
    """One raw transport call result with retry metadata."""

    response: Any
    ttft_seconds: float | None
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None
    raw_response: str
    duration_seconds: float
    transport_retry_attempt: int
    transport_retry_budget: int
    transport_error_type: str


@dataclass(slots=True)
class StructuredLLMRouter:
    """역할별 모델 선택과 raw 응답 수집을 담당한다."""

    logger: logging.Logger
    planner_config: ModelConfig
    generator_config: ModelConfig
    coordinator_config: ModelConfig
    observer_config: ModelConfig
    fixer_config: ModelConfig
    planner: BaseChatModel
    generator: BaseChatModel
    coordinator: BaseChatModel
    observer: BaseChatModel
    fixer: BaseChatModel
    usage_tracker: LLMUsageTracker
    run_id: str = ""
    stream_event_sink: Callable[[dict[str, object]], object] | None = None
    llm_call_sequence: int = 0

    def configure_run_logging(
        self,
        *,
        run_id: str,
        stream_event_sink: Callable[[dict[str, object]], object] | None,
    ) -> None:
        """Attach a per-run JSONL sink for raw LLM call logging."""

        self.run_id = run_id
        self.stream_event_sink = stream_event_sink
        self.llm_call_sequence = 0

    def for_role(self, role: str) -> BaseChatModel:
        """역할 이름으로 모델을 반환한다."""

        try:
            return getattr(self, role)
        except AttributeError as exc:
            raise ValueError(f"지원하지 않는 역할입니다: {role}") from exc

    def invoke_text_with_meta(
        self,
        role: str,
        prompt: str,
        *,
        log_context: dict[str, object] | None = None,
    ) -> tuple[str, LLMCallMeta]:
        """LLM 원문 응답과 메타데이터를 함께 반환한다."""

        normalized_log_context = ensure_llm_log_context(log_context, role=role)
        self._log_contract_call_start(role=role, log_context=log_context)
        transport = self._invoke_with_metrics(
            role,
            prompt,
            call_kind="text",
            log_context=normalized_log_context,
        )
        content = content_to_text(transport.response.content).strip()
        if not content:
            raise ValueError("응답이 비어 있습니다.")
        self._emit_llm_call_event(
            role=role,
            call_kind="text",
            prompt=prompt,
            raw_response=transport.raw_response,
            log_context=normalized_log_context,
            duration_seconds=transport.duration_seconds,
            ttft_seconds=transport.ttft_seconds,
            input_tokens=transport.input_tokens,
            output_tokens=transport.output_tokens,
            total_tokens=transport.total_tokens,
            contract_kind="text",
            output_type_name="text",
            transport_retry_attempt=transport.transport_retry_attempt,
            transport_retry_budget=transport.transport_retry_budget,
            transport_error_type=transport.transport_error_type,
        )
        self._log_text_response(
            role=role,
            content=content,
            duration_seconds=transport.duration_seconds,
            ttft_seconds=transport.ttft_seconds,
            input_tokens=transport.input_tokens,
            output_tokens=transport.output_tokens,
            total_tokens=transport.total_tokens,
            log_context=normalized_log_context,
        )
        return content, LLMCallMeta(
            contract_kind="text",
            output_type_name="text",
            parse_failure_count=0,
            forced_default=False,
            duration_seconds=transport.duration_seconds,
            last_content=content,
            ttft_seconds=transport.ttft_seconds,
            input_tokens=transport.input_tokens,
            output_tokens=transport.output_tokens,
            total_tokens=transport.total_tokens,
            transport_retry_attempt=transport.transport_retry_attempt,
            transport_retry_budget=transport.transport_retry_budget,
            transport_error_type=transport.transport_error_type,
        )

    async def ainvoke_text_with_meta(
        self,
        role: str,
        prompt: str,
        *,
        log_context: dict[str, object] | None = None,
    ) -> tuple[str, LLMCallMeta]:
        """비동기 LLM 원문 응답과 메타데이터를 함께 반환한다."""

        normalized_log_context = ensure_llm_log_context(log_context, role=role)
        self._log_contract_call_start(role=role, log_context=log_context)
        transport = await self._ainvoke_with_metrics(
            role,
            prompt,
            call_kind="text",
            log_context=normalized_log_context,
        )
        content = content_to_text(transport.response.content).strip()
        if not content:
            raise ValueError("응답이 비어 있습니다.")
        self._emit_llm_call_event(
            role=role,
            call_kind="text",
            prompt=prompt,
            raw_response=transport.raw_response,
            log_context=normalized_log_context,
            duration_seconds=transport.duration_seconds,
            ttft_seconds=transport.ttft_seconds,
            input_tokens=transport.input_tokens,
            output_tokens=transport.output_tokens,
            total_tokens=transport.total_tokens,
            contract_kind="text",
            output_type_name="text",
            transport_retry_attempt=transport.transport_retry_attempt,
            transport_retry_budget=transport.transport_retry_budget,
            transport_error_type=transport.transport_error_type,
        )
        self._log_text_response(
            role=role,
            content=content,
            duration_seconds=transport.duration_seconds,
            ttft_seconds=transport.ttft_seconds,
            input_tokens=transport.input_tokens,
            output_tokens=transport.output_tokens,
            total_tokens=transport.total_tokens,
            log_context=normalized_log_context,
        )
        return content, LLMCallMeta(
            contract_kind="text",
            output_type_name="text",
            parse_failure_count=0,
            forced_default=False,
            duration_seconds=transport.duration_seconds,
            last_content=content,
            ttft_seconds=transport.ttft_seconds,
            input_tokens=transport.input_tokens,
            output_tokens=transport.output_tokens,
            total_tokens=transport.total_tokens,
            transport_retry_attempt=transport.transport_retry_attempt,
            transport_retry_budget=transport.transport_retry_budget,
            transport_error_type=transport.transport_error_type,
        )

    def _invoke_with_metrics(
        self,
        role: str,
        prompt: str,
        *,
        call_kind: CallKind,
        log_context: dict[str, object] | None = None,
    ) -> TransportCallResult:
        """응답과 벤치마크용 메타데이터를 함께 수집한다."""

        model = self.for_role(role)
        timeout_seconds = self._config_for_role(role).timeout_seconds
        last_error_type = ""
        for attempt in range(1, _TRANSPORT_RETRY_BUDGET + 1):
            started_at = time.perf_counter()
            first_chunk_at: float | None = None
            merged_chunk: Any | None = None
            try:
                for chunk in model.stream(prompt):
                    if first_chunk_at is None:
                        first_chunk_at = time.perf_counter()
                    merged_chunk = chunk if merged_chunk is None else merged_chunk + chunk
                if merged_chunk is None:
                    raise ValueError(f"{role} stream 응답이 비어 있습니다.")
                input_tokens, output_tokens, total_tokens = extract_token_usage(
                    merged_chunk
                )
                self.usage_tracker.record_transport_call(
                    role=role,
                    log_context=log_context,
                    call_kind=call_kind,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=total_tokens,
                )
                ttft_seconds = (
                    first_chunk_at - started_at if first_chunk_at is not None else None
                )
                duration_seconds = time.perf_counter() - started_at
                return TransportCallResult(
                    response=merged_chunk,
                    ttft_seconds=ttft_seconds,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=total_tokens,
                    raw_response=content_to_text(
                        getattr(merged_chunk, "content", merged_chunk)
                    ).strip(),
                    duration_seconds=duration_seconds,
                    transport_retry_attempt=attempt,
                    transport_retry_budget=_TRANSPORT_RETRY_BUDGET,
                    transport_error_type=last_error_type,
                )
            except Exception as exc:  # noqa: BLE001
                error_type = self._retryable_transport_error_type(exc)
                if error_type is None or attempt >= _TRANSPORT_RETRY_BUDGET:
                    raise RuntimeError(
                        self._format_transport_error_message(
                            role=role,
                            log_context=log_context,
                            timeout_seconds=timeout_seconds,
                            error_type=type(exc).__name__,
                        )
                    ) from exc
                last_error_type = error_type
                delay = self._transport_retry_delay(attempt)
                self.logger.info(
                    "%s transport RETRY 시작 | attempt=%s/%s | error=%s | timeout=%.1fs | sleep=%.2fs",
                    role,
                    attempt + 1,
                    _TRANSPORT_RETRY_BUDGET,
                    error_type,
                    timeout_seconds,
                    delay,
                )
                time.sleep(delay)
        raise RuntimeError(f"{role} transport retry loop exited unexpectedly.")

    async def _ainvoke_with_metrics(
        self,
        role: str,
        prompt: str,
        *,
        call_kind: CallKind,
        log_context: dict[str, object] | None = None,
    ) -> TransportCallResult:
        """비동기 응답과 메타데이터를 함께 수집한다."""

        model = self.for_role(role)
        timeout_seconds = self._config_for_role(role).timeout_seconds
        last_error_type = ""
        for attempt in range(1, _TRANSPORT_RETRY_BUDGET + 1):
            started_at = time.perf_counter()
            first_chunk_at: float | None = None
            merged_chunk: Any | None = None
            try:
                async for chunk in model.astream(prompt):
                    if first_chunk_at is None:
                        first_chunk_at = time.perf_counter()
                    merged_chunk = chunk if merged_chunk is None else merged_chunk + chunk
                if merged_chunk is None:
                    raise ValueError(f"{role} astream 응답이 비어 있습니다.")
                input_tokens, output_tokens, total_tokens = extract_token_usage(
                    merged_chunk
                )
                self.usage_tracker.record_transport_call(
                    role=role,
                    log_context=log_context,
                    call_kind=call_kind,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=total_tokens,
                )
                ttft_seconds = (
                    first_chunk_at - started_at if first_chunk_at is not None else None
                )
                duration_seconds = time.perf_counter() - started_at
                return TransportCallResult(
                    response=merged_chunk,
                    ttft_seconds=ttft_seconds,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    total_tokens=total_tokens,
                    raw_response=content_to_text(
                        getattr(merged_chunk, "content", merged_chunk)
                    ).strip(),
                    duration_seconds=duration_seconds,
                    transport_retry_attempt=attempt,
                    transport_retry_budget=_TRANSPORT_RETRY_BUDGET,
                    transport_error_type=last_error_type,
                )
            except Exception as exc:  # noqa: BLE001
                error_type = self._retryable_transport_error_type(exc)
                if error_type is None or attempt >= _TRANSPORT_RETRY_BUDGET:
                    raise RuntimeError(
                        self._format_transport_error_message(
                            role=role,
                            log_context=log_context,
                            timeout_seconds=timeout_seconds,
                            error_type=type(exc).__name__,
                        )
                    ) from exc
                last_error_type = error_type
                delay = self._transport_retry_delay(attempt)
                self.logger.info(
                    "%s transport RETRY 시작 | attempt=%s/%s | error=%s | timeout=%.1fs | sleep=%.2fs",
                    role,
                    attempt + 1,
                    _TRANSPORT_RETRY_BUDGET,
                    error_type,
                    timeout_seconds,
                    delay,
                )
                await asyncio.sleep(delay)
        raise RuntimeError(f"{role} transport retry loop exited unexpectedly.")

    def _config_for_role(self, role: str) -> ModelConfig:
        """역할에 대응하는 model config를 반환한다."""

        config_name = f"{role}_config"
        try:
            return getattr(self, config_name)
        except AttributeError as exc:
            raise ValueError(f"지원하지 않는 역할 config입니다: {role}") from exc

    def _retryable_transport_error_type(self, exc: Exception) -> str | None:
        """재시도 가능한 transport 예외 타입을 판별한다."""

        if isinstance(
            exc,
            (
                httpx.ReadTimeout,
                httpx.ConnectTimeout,
                httpx.WriteTimeout,
                httpx.PoolTimeout,
                httpx.ReadError,
                httpx.WriteError,
                httpx.ConnectError,
                httpx.RemoteProtocolError,
            ),
        ):
            return type(exc).__name__
        module_name = exc.__class__.__module__
        class_name = exc.__class__.__name__
        if module_name.startswith("openai") and class_name in {
            "APIConnectionError",
            "APITimeoutError",
            "InternalServerError",
        }:
            return class_name
        return None

    def _transport_retry_delay(self, attempt: int) -> float:
        """transport retry backoff 지연을 계산한다."""

        jitter = random.uniform(0.0, _TRANSPORT_RETRY_JITTER_SECONDS)
        return (_TRANSPORT_RETRY_BASE_DELAY_SECONDS * (2 ** (attempt - 1))) + jitter

    def _format_transport_error_message(
        self,
        *,
        role: str,
        log_context: dict[str, object] | None,
        timeout_seconds: float,
        error_type: str,
    ) -> str:
        """사용자/로그에 남길 transport 실패 메시지를 만든다."""

        task_key = str((log_context or {}).get("task_key", "")).strip() or "transport"
        artifact_key = str((log_context or {}).get("artifact_key", "")).strip() or "-"
        provider = self._config_for_role(role).provider
        return (
            f"{role}.{task_key} transport timeout after {timeout_seconds:.1f}s "
            f"(provider={provider}, artifact={artifact_key}, error={error_type})"
        )

    def _log_object_response(
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
        """완료된 object 응답을 보기 좋은 형태로 로그에 남긴다."""

        normalized_log_context = ensure_llm_log_context(log_context, role=role)
        pretty_text = pretty_object_response_text(
            role=role,
            parsed=parsed,
            content=content,
            log_context=normalized_log_context,
        )
        meta_line = format_metrics_line(
            duration_seconds=duration_seconds,
            ttft_seconds=ttft_seconds,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
        )
        if parse_error is not None:
            meta_line = f"{meta_line}\n파싱 경고: {parse_error}"
        title = format_response_title(role=role, log_context=normalized_log_context)
        suffix = format_log_context_suffix(normalized_log_context)
        if suffix:
            title = f"{title} | {suffix}"
        summary = meta_line.replace("\n", " | ")
        if parse_error is None:
            self._log_success_response(
                role=role,
                title=title,
                summary=summary,
                duration_seconds=duration_seconds,
            )
        else:
            self.logger.warning("%s | %s", title, summary)
        if pretty_text.strip():
            self.logger.debug("\n%s\n", pretty_text)

    def _log_simple_response(
        self,
        *,
        role: str,
        parsed: object | None,
        content: str,
        output_type_name: str,
        duration_seconds: float,
        ttft_seconds: float | None,
        input_tokens: int | None,
        output_tokens: int | None,
        total_tokens: int | None,
        log_context: dict[str, object] | None,
        parse_error: Exception | None = None,
    ) -> None:
        """완료된 simple 응답을 보기 좋은 형태로 로그에 남긴다."""

        normalized_log_context = ensure_llm_log_context(log_context, role=role)
        pretty_text = pretty_simple_response_text(
            role=role,
            parsed=parsed,
            content=content,
            output_type_name=output_type_name,
            log_context=normalized_log_context,
        )
        meta_line = format_metrics_line(
            duration_seconds=duration_seconds,
            ttft_seconds=ttft_seconds,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
        )
        if parse_error is not None:
            meta_line = f"{meta_line}\n파싱 경고: {parse_error}"
        title = format_response_title(role=role, log_context=normalized_log_context)
        suffix = format_log_context_suffix(normalized_log_context)
        if suffix:
            title = f"{title} | {suffix}"
        summary = meta_line.replace("\n", " | ")
        if parse_error is None:
            self._log_success_response(
                role=role,
                title=title,
                summary=summary,
                duration_seconds=duration_seconds,
            )
        else:
            self.logger.warning("%s | %s", title, summary)
        if pretty_text.strip():
            self.logger.debug("\n%s\n", pretty_text)

    def _log_contract_call_start(
        self,
        *,
        role: str,
        log_context: dict[str, object] | None,
    ) -> None:
        """machine-readable contract 호출 시작 로그를 남긴다."""

        normalized_log_context = ensure_llm_log_context(log_context, role=role)
        suffix = format_log_context_suffix(normalized_log_context)
        message = format_call_start_message(
            role=role,
            log_context=normalized_log_context,
        )
        if suffix:
            message = f"{message} | {suffix}"
        self.logger.debug(message)

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

        normalized_log_context = ensure_llm_log_context(log_context, role=role)
        meta_line = format_metrics_line(
            duration_seconds=duration_seconds,
            ttft_seconds=ttft_seconds,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
        )
        pretty_text = pretty_text_response_text(
            role=role,
            content=content,
            log_context=normalized_log_context,
        )
        title = format_response_title(role=role, log_context=normalized_log_context)
        suffix = format_log_context_suffix(normalized_log_context)
        if suffix:
            title = f"{title} | {suffix}"
        self._log_success_response(
            role=role,
            title=title,
            summary=meta_line,
            duration_seconds=duration_seconds,
        )
        if pretty_text.strip():
            self.logger.debug("\n%s\n", pretty_text)

    def _emit_llm_call_event(
        self,
        *,
        role: str,
        call_kind: CallKind,
        prompt: str,
        raw_response: str,
        log_context: dict[str, object] | None,
        duration_seconds: float,
        ttft_seconds: float | None,
        input_tokens: int | None,
        output_tokens: int | None,
        total_tokens: int | None,
        contract_kind: str | None = None,
        output_type_name: str | None = None,
        parse_failure_count: int | None = None,
        forced_default: bool | None = None,
        fixer_used: bool | None = None,
        provider_structured_mode: str | None = None,
        prompt_variant: str | None = None,
        semantic_coercion_used: bool | None = None,
        semantic_coercion_reasons: list[str] | None = None,
        post_coercion_valid: bool | None = None,
        transport_retry_attempt: int | None = None,
        transport_retry_budget: int | None = None,
        transport_error_type: str | None = None,
    ) -> None:
        """Append one raw LLM call event to the run JSONL sink when configured."""

        if self.stream_event_sink is None or not self.run_id:
            return
        self.llm_call_sequence += 1
        normalized_log_context = ensure_llm_log_context(log_context, role=role)
        retry_stage = str(normalized_log_context.get("retry_stage", "")).strip() or None
        retry_route = str(normalized_log_context.get("retry_route", "")).strip() or None
        retry_reason = str(normalized_log_context.get("retry_reason", "")).strip() or None
        retry_attempt = normalized_log_context.get("retry_attempt")
        retry_budget = normalized_log_context.get("retry_budget")
        missing_field_paths = normalized_log_context.get("missing_field_paths", [])
        if transport_retry_attempt is None:
            value = normalized_log_context.get("transport_retry_attempt")
            if value is not None and str(value).strip():
                transport_retry_attempt = int(str(value))
        if transport_retry_budget is None:
            value = normalized_log_context.get("transport_retry_budget")
            if value is not None and str(value).strip():
                transport_retry_budget = int(str(value))
        if transport_error_type is None:
            transport_error_type = (
                str(normalized_log_context.get("transport_error_type", "")).strip()
                or None
            )
        entry = build_llm_call_event(
            run_id=self.run_id,
            sequence=self.llm_call_sequence,
            role=role,
            call_kind=call_kind,
            prompt=prompt,
            raw_response=raw_response,
            log_context=json_safe_mapping(normalized_log_context),
            duration_seconds=duration_seconds,
            ttft_seconds=ttft_seconds,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            contract_kind=contract_kind,
            output_type_name=output_type_name,
            parse_failure_count=parse_failure_count,
            forced_default=forced_default,
            fixer_used=fixer_used,
            provider_structured_mode=provider_structured_mode,
            prompt_variant=prompt_variant,
            semantic_coercion_used=semantic_coercion_used,
            semantic_coercion_reasons=semantic_coercion_reasons,
            post_coercion_valid=post_coercion_valid,
            retry_stage=retry_stage,
            retry_route=retry_route,
            retry_attempt=(
                int(str(retry_attempt))
                if retry_attempt is not None and str(retry_attempt).strip()
                else None
            ),
            retry_budget=(
                int(str(retry_budget))
                if retry_budget is not None and str(retry_budget).strip()
                else None
            ),
            retry_reason=retry_reason,
            missing_field_paths=(
                [str(item).strip() for item in missing_field_paths]
                if isinstance(missing_field_paths, list)
                else []
            ),
            transport_retry_attempt=transport_retry_attempt,
            transport_retry_budget=transport_retry_budget,
            transport_error_type=transport_error_type,
        )
        try:
            self.stream_event_sink(entry)
        except Exception as exc:  # noqa: BLE001
            self.logger.warning(
                "llm call raw log append 실패 | role=%s | error=%s",
                role,
                exc,
            )

    def _log_success_response(
        self,
        *,
        role: str,
        title: str,
        summary: str,
        duration_seconds: float,
    ) -> None:
        """Keep successful LLM calls out of INFO unless they are slow enough to surface."""

        if duration_seconds >= _SLOW_CALL_INFO_THRESHOLD_SECONDS:
            self.logger.info("%s | %s", title, summary)
            return
        self.logger.debug("%s | %s", title, summary)


def build_raw_model_router(
    settings: AppSettings,
    *,
    usage_tracker: LLMUsageTracker,
) -> StructuredLLMRouter:
    """역할별 raw 라우터를 생성한다."""

    return StructuredLLMRouter(
        logger=logging.getLogger("simula.llm"),
        planner_config=settings.models.planner,
        generator_config=settings.models.generator,
        coordinator_config=settings.models.coordinator,
        observer_config=settings.models.observer,
        fixer_config=settings.models.fixer,
        planner=build_provider_chat_model(settings.models.planner),
        generator=build_provider_chat_model(settings.models.generator),
        coordinator=build_provider_chat_model(settings.models.coordinator),
        observer=build_provider_chat_model(settings.models.observer),
        fixer=build_provider_chat_model(settings.models.fixer),
        usage_tracker=usage_tracker,
    )
