"""목적:
- provider별 chat model 생성과 원문/meta 수집을 담당한다.

설명:
- OpenAI, Anthropic, Google, Ollama, vLLM(OpenAI 호환) 연결을 한 곳에서 통일한다.
- structured parsing orchestration은 상위 서비스에서 수행하고,
  이 라우터는 role별 raw text 호출과 공통 로그/meta만 제공한다.

사용한 설계 패턴:
- 팩토리 + 역할 라우터 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.config.models
- simula.infrastructure.llm.service
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from langchain_core.language_models import BaseChatModel
from pydantic import BaseModel

from simula.application.llm_logging import ensure_llm_log_context
from simula.application.ports.llm import StructuredCallMeta
from simula.infrastructure.config.models import AppSettings
from simula.domain.log_events import build_llm_call_event
from simula.infrastructure.llm.providers import build_provider_chat_model
from simula.infrastructure.llm.renderers import (
    render_structured_response,
    render_text_response,
)
from simula.infrastructure.llm.usage import CallKind, LLMUsageTracker


@dataclass(slots=True)
class StructuredLLMRouter:
    """역할별 모델 선택과 raw 응답 수집을 담당한다."""

    logger: logging.Logger
    planner: BaseChatModel
    generator: BaseChatModel
    coordinator: BaseChatModel
    actor: BaseChatModel
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
    ) -> tuple[str, StructuredCallMeta]:
        """LLM 원문 응답과 메타데이터를 함께 반환한다."""

        normalized_log_context = ensure_llm_log_context(log_context, role=role)
        self._log_structured_call_start(role=role, log_context=log_context)
        (
            response,
            ttft_seconds,
            input_tokens,
            output_tokens,
            total_tokens,
            raw_response,
            duration_seconds,
        ) = (
            self._invoke_with_metrics(
                role,
                prompt,
                call_kind="text",
                log_context=normalized_log_context,
            )
        )
        content = _content_to_text(response.content).strip()
        if not content:
            raise ValueError("응답이 비어 있습니다.")
        self._emit_llm_call_event(
            role=role,
            call_kind="text",
            prompt=prompt,
            raw_response=raw_response,
            log_context=normalized_log_context,
            duration_seconds=duration_seconds,
            ttft_seconds=ttft_seconds,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
        )
        self._log_text_response(
            role=role,
            content=content,
            duration_seconds=duration_seconds,
            ttft_seconds=ttft_seconds,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            log_context=normalized_log_context,
        )
        return content, StructuredCallMeta(
            parse_failure_count=0,
            forced_default=False,
            duration_seconds=duration_seconds,
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

        normalized_log_context = ensure_llm_log_context(log_context, role=role)
        self._log_structured_call_start(role=role, log_context=log_context)
        (
            response,
            ttft_seconds,
            input_tokens,
            output_tokens,
            total_tokens,
            raw_response,
            duration_seconds,
        ) = await self._ainvoke_with_metrics(
            role,
            prompt,
            call_kind="text",
            log_context=normalized_log_context,
        )
        content = _content_to_text(response.content).strip()
        if not content:
            raise ValueError("응답이 비어 있습니다.")
        self._emit_llm_call_event(
            role=role,
            call_kind="text",
            prompt=prompt,
            raw_response=raw_response,
            log_context=normalized_log_context,
            duration_seconds=duration_seconds,
            ttft_seconds=ttft_seconds,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
        )
        self._log_text_response(
            role=role,
            content=content,
            duration_seconds=duration_seconds,
            ttft_seconds=ttft_seconds,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
            log_context=normalized_log_context,
        )
        return content, StructuredCallMeta(
            parse_failure_count=0,
            forced_default=False,
            duration_seconds=duration_seconds,
            last_content=content,
            ttft_seconds=ttft_seconds,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
        )

    def _invoke_with_metrics(
        self,
        role: str,
        prompt: str,
        *,
        call_kind: CallKind,
        log_context: dict[str, object] | None = None,
    ) -> tuple[
        Any,
        float | None,
        int | None,
        int | None,
        int | None,
        str,
        float,
    ]:
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
        return (
            merged_chunk,
            ttft_seconds,
            input_tokens,
            output_tokens,
            total_tokens,
            _content_to_text(getattr(merged_chunk, "content", merged_chunk)).strip(),
            duration_seconds,
        )

    async def _ainvoke_with_metrics(
        self,
        role: str,
        prompt: str,
        *,
        call_kind: CallKind,
        log_context: dict[str, object] | None = None,
    ) -> tuple[
        Any,
        float | None,
        int | None,
        int | None,
        int | None,
        str,
        float,
    ]:
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
        return (
            merged_chunk,
            ttft_seconds,
            input_tokens,
            output_tokens,
            total_tokens,
            _content_to_text(getattr(merged_chunk, "content", merged_chunk)).strip(),
            duration_seconds,
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
        """완료된 structured 응답을 보기 좋은 형태로 로그에 남긴다."""

        normalized_log_context = ensure_llm_log_context(log_context, role=role)
        pretty_text = _pretty_response_text(
            role=role,
            parsed=parsed,
            content=content,
            log_context=normalized_log_context,
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
        title = _format_response_title(role=role, log_context=normalized_log_context)
        suffix = _format_log_context_suffix(normalized_log_context)
        if suffix:
            title = f"{title} | {suffix}"
        summary = meta_line.replace("\n", " | ")
        if parse_error is None:
            self.logger.info("%s | %s", title, summary)
        else:
            self.logger.warning("%s | %s", title, summary)
        if pretty_text.strip():
            self.logger.debug("\n%s\n", pretty_text)

    def _log_structured_call_start(
        self,
        *,
        role: str,
        log_context: dict[str, object] | None,
    ) -> None:
        """structured LLM 호출 시작 로그를 남긴다."""

        normalized_log_context = ensure_llm_log_context(log_context, role=role)
        suffix = _format_log_context_suffix(normalized_log_context)
        message = _format_call_start_message(
            role=role,
            log_context=normalized_log_context,
        )
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

        normalized_log_context = ensure_llm_log_context(log_context, role=role)
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
            log_context=normalized_log_context,
        )
        title = _format_response_title(role=role, log_context=normalized_log_context)
        suffix = _format_log_context_suffix(normalized_log_context)
        if suffix:
            title = f"{title} | {suffix}"
        self.logger.info("%s | %s", title, meta_line)
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
    ) -> None:
        """Append one raw LLM call event to the run JSONL sink when configured."""

        if self.stream_event_sink is None or not self.run_id:
            return
        self.llm_call_sequence += 1
        normalized_log_context = ensure_llm_log_context(log_context, role=role)
        entry = build_llm_call_event(
            run_id=self.run_id,
            sequence=self.llm_call_sequence,
            role=role,
            call_kind=call_kind,
            prompt=prompt,
            raw_response=raw_response,
            log_context=_json_safe_mapping(normalized_log_context),
            duration_seconds=duration_seconds,
            ttft_seconds=ttft_seconds,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=total_tokens,
        )
        try:
            self.stream_event_sink(entry)
        except Exception as exc:  # noqa: BLE001
            self.logger.warning("llm call raw log append 실패 | role=%s | error=%s", role, exc)


def build_raw_model_router(
    settings: AppSettings,
    *,
    usage_tracker: LLMUsageTracker,
) -> StructuredLLMRouter:
    """역할별 raw 라우터를 생성한다."""

    return StructuredLLMRouter(
        logger=logging.getLogger("simula.llm"),
        planner=build_provider_chat_model(settings.models.planner),
        generator=build_provider_chat_model(settings.models.generator),
        coordinator=build_provider_chat_model(settings.models.coordinator),
        actor=build_provider_chat_model(settings.models.actor),
        observer=build_provider_chat_model(settings.models.observer),
        fixer=build_provider_chat_model(settings.models.fixer),
        usage_tracker=usage_tracker,
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
    artifact_key = log_context.get("artifact_key")
    if artifact_key is not None:
        parts.append(f"artifact={artifact_key}")

    schema_name = log_context.get("schema_name")
    if schema_name is not None:
        parts.append(f"schema={schema_name}")

    round_index = log_context.get("round_index")
    if round_index is not None:
        parts.append(f"round_index={round_index}")

    actor_display_name = log_context.get("actor_display_name")
    cast_id = log_context.get("cast_id")
    if actor_display_name is not None and cast_id is not None:
        parts.append(f"actor={actor_display_name}({cast_id})")
    elif actor_display_name is not None:
        parts.append(f"actor={actor_display_name}")
    elif cast_id is not None:
        parts.append(f"cast_id={cast_id}")

    slot_index = log_context.get("slot_index")
    if slot_index is not None:
        parts.append(f"slot_index={slot_index}")

    section = log_context.get("section")
    if section is not None:
        parts.append(f"section={section}")

    target_role = log_context.get("target_role")
    target_task_key = log_context.get("target_task_key")
    if target_role is not None and target_task_key is not None:
        parts.append(f"target={target_role}.{target_task_key}")

    target_artifact_key = log_context.get("target_artifact_key")
    if target_artifact_key is not None:
        parts.append(f"target_artifact={target_artifact_key}")

    target_schema_name = log_context.get("target_schema_name")
    if target_schema_name is not None:
        parts.append(f"target_schema={target_schema_name}")

    attempt = log_context.get("attempt")
    if attempt is not None:
        attempt_total = log_context.get("attempt_total")
        if attempt_total is not None and "/" not in str(attempt):
            parts.append(f"attempt={attempt}/{attempt_total}")
        else:
            parts.append(f"attempt={attempt}")

    prompt_variant = log_context.get("prompt_variant")
    if prompt_variant is not None:
        parts.append(f"prompt_variant={prompt_variant}")
    return " ".join(parts)


def _format_call_start_message(
    *,
    role: str,
    log_context: dict[str, object] | None,
) -> str:
    return f"{_format_response_header(role=role, log_context=log_context)} 시작"


def _format_response_header(
    *,
    role: str,
    log_context: dict[str, object] | None,
) -> str:
    if log_context:
        task_label = str(log_context.get("task_label", "")).strip()
        target_role = str(log_context.get("target_role", "")).strip()
        target_task_label = str(log_context.get("target_task_label", "")).strip()
        if role == "fixer" and task_label and target_role and target_task_label:
            return f"fixer · {task_label}"
        if task_label:
            return f"{role} · {task_label}"

    scope = str(log_context.get("scope")) if log_context else ""
    if role == "planner":
        return _planner_scope_label(scope)
    if role == "generator":
        return "generator"
    if role == "actor":
        return "actor"
    if role == "observer":
        return _observer_scope_label(scope)
    if role == "coordinator":
        return _coordinator_scope_label(scope)
    if role == "fixer":
        return _fixer_scope_label(scope)
    return role


def _format_response_title(
    *,
    role: str,
    log_context: dict[str, object] | None,
) -> str:
    return f"{_format_response_header(role=role, log_context=log_context)} 완료"


def _planner_scope_label(scope: str, *, suffix: str = "") -> str:
    labels = {
        "planning-analysis": "planner · 계획 분석",
        "execution-plan": "planner · 실행 계획 정리",
    }
    base = labels.get(scope, "planner")
    if suffix:
        return f"{base} {suffix}"
    return base


def _observer_scope_label(scope: str, *, suffix: str = "") -> str:
    labels = {
        "final-report": "observer · 최종 보고서 작성",
    }
    base = labels.get(scope, "관찰 요약")
    if suffix:
        return f"{base} {suffix}"
    return base


def _coordinator_scope_label(scope: str, *, suffix: str = "") -> str:
    labels = {
        "round-continuation": "coordinator · 라운드 지속 여부 판단",
        "round-directive": "coordinator · 라운드 지시안 작성",
        "round-resolution": "coordinator · 라운드 해소",
    }
    base = labels.get(scope, "coordinator")
    if suffix:
        return f"{base} {suffix}"
    return base


def _fixer_scope_label(scope: str, *, suffix: str = "") -> str:
    labels = {
        "json-fix": "fixer · JSON 복구",
    }
    base = labels.get(scope, "fixer")
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
    except (TypeError, ValueError):
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


def _json_safe_mapping(
    mapping: dict[str, object] | None,
) -> dict[str, object] | None:
    if mapping is None:
        return None
    return {
        str(key): _json_safe_value(value)
        for key, value in mapping.items()
    }


def _json_safe_value(value: object) -> object:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, Mapping):
        return {
            str(key): _json_safe_value(item)
            for key, item in value.items()
        }
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return [_json_safe_value(item) for item in value]
    return str(value)


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


def _format_optional_int(value: int | None) -> str:
    if value is None:
        return "-"
    return str(value)


def _format_optional_number(value: float | None) -> str:
    if value is None:
        return "-"
    return f"{value:.2f}s"


def _strip_json_fence(text: str) -> str:
    stripped = text.strip()
    if not stripped.startswith("```"):
        return stripped

    lines = stripped.splitlines()
    if lines and lines[0].startswith("```"):
        lines = lines[1:]
    if lines and lines[-1].startswith("```"):
        lines = lines[:-1]
    return "\n".join(lines).strip()
