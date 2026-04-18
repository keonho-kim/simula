"""Simple structured contract runner."""

from __future__ import annotations

import time
from typing import Any, TypeVar, cast

from pydantic import TypeAdapter

from simula.shared.logging.llm import ensure_llm_log_context
from simula.application.ports.llm import (
    LLMCallMeta,
    SimpleOutputSpec,
    SimpleSemanticValidator,
)
from simula.application.workflow.fixer import repair_structured_json
from simula.infrastructure.llm.output_parsers import parse_simple_output
from simula.infrastructure.llm.runtime.contract_runner import (
    ContractLoopFailure,
    ContractLoopSuccess,
    ParseResult,
    run_contract_loop,
)
from simula.infrastructure.llm.runtime.logging import log_primary_parse_failure
from simula.infrastructure.llm.runtime.router import StructuredLLMRouter
from simula.infrastructure.llm.runtime.structured_retry import (
    emit_contract_attempt_events,
    final_prompt_variant,
)

SimpleT = TypeVar("SimpleT")


async def run_simple_contract(
    *,
    router: StructuredLLMRouter,
    logger: Any,
    role: str,
    prompt: str,
    spec: SimpleOutputSpec,
    log_context: dict[str, object] | None,
) -> tuple[SimpleT, LLMCallMeta]:
    started_at = time.perf_counter()
    retry_budget = max(1, spec.max_attempts)
    normalized_log_context = ensure_llm_log_context(log_context, role=role)
    normalized_log_context["contract_kind"] = "simple"
    normalized_log_context["output_type_name"] = spec.type_name
    router._log_contract_call_start(role=role, log_context=normalized_log_context)

    adapter = TypeAdapter(spec.annotation)
    provider_structured_mode = "prompt_parse"

    def parse_content(content: str) -> ParseResult[SimpleT]:
        parsed = cast(SimpleT, parse_simple_output(content, spec.annotation))
        semantic_issues = _run_simple_semantic_validator(
            parsed,
            semantic_validator=cast(
                SimpleSemanticValidator[SimpleT] | None,
                spec.semantic_validator,
            ),
        )
        if semantic_issues:
            raise ValueError("; ".join(semantic_issues))
        return ParseResult(parsed=parsed)

    async def invoke_fixer(
        content: str,
        last_error: Exception | None,
        attempt_index: int,
        classification: Any,
    ):
        return await repair_structured_json(
            router=router,
            target_role=role,
            target_log_context=normalized_log_context,
            annotation=spec.annotation,
            output_type_name=spec.type_name,
            content=content,
            semantic_validator=cast(
                SimpleSemanticValidator[Any] | None,
                spec.semantic_validator,
            ),
            repair_context=spec.repair_context,
            failure_feedback=[str(last_error)] if last_error is not None else None,
            attempt=attempt_index,
            retry_budget=retry_budget,
            retry_reason=classification.reason,
            missing_field_paths=classification.missing_field_paths,
        )

    loop_result = await run_contract_loop(
        router=router,
        logger=logger,
        role=role,
        prompt=prompt,
        normalized_log_context=normalized_log_context,
        format_instructions=spec.format_instructions,
        failure_policy=spec.failure_policy,
        retry_budget=retry_budget,
        parse_content=parse_content,
        invoke_fixer=invoke_fixer,
    )

    if isinstance(loop_result, ContractLoopSuccess):
        emit_contract_attempt_events(
            router=router,
            role=role,
            contract_kind="simple",
            output_type_name=spec.type_name,
            attempts=loop_result.attempts,
            provider_structured_mode=provider_structured_mode,
            forced_default=False,
            fixer_used=loop_result.fixer_used,
        )
        router._log_simple_response(
            role=role,
            parsed=loop_result.parsed,
            content=loop_result.content,
            output_type_name=spec.type_name,
            duration_seconds=time.perf_counter() - started_at,
            ttft_seconds=loop_result.aggregate_metrics.ttft_seconds,
            input_tokens=loop_result.aggregate_metrics.input_tokens,
            output_tokens=loop_result.aggregate_metrics.output_tokens,
            total_tokens=loop_result.aggregate_metrics.total_tokens,
            log_context=loop_result.final_retry_context,
        )
        router.usage_tracker.record_structured_outcome(
            parse_failures=loop_result.parse_failure_count,
            forced_default=False,
        )
        return loop_result.parsed, LLMCallMeta(
            contract_kind="simple",
            output_type_name=spec.type_name,
            parse_failure_count=loop_result.parse_failure_count,
            forced_default=False,
            duration_seconds=time.perf_counter() - started_at,
            last_content=loop_result.content,
            ttft_seconds=loop_result.aggregate_metrics.ttft_seconds,
            input_tokens=loop_result.aggregate_metrics.input_tokens,
            output_tokens=loop_result.aggregate_metrics.output_tokens,
            total_tokens=loop_result.aggregate_metrics.total_tokens,
            fixer_used=loop_result.fixer_used,
            provider_structured_mode=provider_structured_mode,
            prompt_variant=str(loop_result.final_retry_context.get("prompt_variant", "")),
            retry_stage=str(loop_result.final_retry_context.get("retry_stage", "")),
            retry_route=str(loop_result.final_retry_context.get("retry_route", "")),
            retry_attempt=int(str(loop_result.final_retry_context.get("retry_attempt", 0) or 0)),
            retry_budget=retry_budget,
            retry_reason=str(loop_result.final_retry_context.get("retry_reason", "")),
            missing_field_paths=list(
                loop_result.final_retry_context.get("missing_field_paths", [])
            ),
            transport_retry_attempt=int(
                str(loop_result.final_retry_context.get("transport_retry_attempt", 1) or 1)
            ),
            transport_retry_budget=int(
                str(loop_result.final_retry_context.get("transport_retry_budget", 1) or 1)
            ),
            transport_error_type=str(
                loop_result.final_retry_context.get("transport_error_type", "")
            ),
        )

    failure = cast(ContractLoopFailure, loop_result)
    log_primary_parse_failure(
        logger=logger,
        role=role,
        last_error=failure.last_error,
        last_content=failure.last_content,
        log_context=normalized_log_context,
    )
    if spec.failure_policy == "default":
        if spec.default_value is None:
            raise ValueError(
                f"{role} simple failure_policy=`default` 는 default_value가 필요합니다."
            )
        default_value = cast(SimpleT, adapter.validate_python(spec.default_value))
        emit_contract_attempt_events(
            router=router,
            role=role,
            contract_kind="simple",
            output_type_name=spec.type_name,
            attempts=failure.attempts,
            provider_structured_mode=provider_structured_mode,
            forced_default=True,
            fixer_used=failure.fixer_used,
        )
        router._log_simple_response(
            role=role,
            parsed=default_value,
            content=failure.last_content,
            output_type_name=spec.type_name,
            duration_seconds=time.perf_counter() - started_at,
            ttft_seconds=failure.aggregate_metrics.ttft_seconds,
            input_tokens=failure.aggregate_metrics.input_tokens,
            output_tokens=failure.aggregate_metrics.output_tokens,
            total_tokens=failure.aggregate_metrics.total_tokens,
            log_context=failure.final_retry_context,
            parse_error=failure.last_error,
        )
        router.usage_tracker.record_structured_outcome(
            parse_failures=failure.parse_failure_count,
            forced_default=True,
        )
        return default_value, LLMCallMeta(
            contract_kind="simple",
            output_type_name=spec.type_name,
            parse_failure_count=failure.parse_failure_count,
            forced_default=True,
            duration_seconds=time.perf_counter() - started_at,
            last_content=failure.last_content,
            ttft_seconds=failure.aggregate_metrics.ttft_seconds,
            input_tokens=failure.aggregate_metrics.input_tokens,
            output_tokens=failure.aggregate_metrics.output_tokens,
            total_tokens=failure.aggregate_metrics.total_tokens,
            provider_structured_mode=provider_structured_mode,
            prompt_variant=final_prompt_variant(failure.attempts),
            retry_stage=str(failure.final_retry_context.get("retry_stage", "")),
            retry_route=str(failure.final_retry_context.get("retry_route", "")),
            retry_attempt=int(str(failure.final_retry_context.get("retry_attempt", 0) or 0)),
            retry_budget=retry_budget,
            retry_reason=str(failure.final_retry_context.get("retry_reason", "")),
            missing_field_paths=list(
                failure.final_retry_context.get("missing_field_paths", [])
            ),
            transport_retry_attempt=int(
                str(failure.final_retry_context.get("transport_retry_attempt", 1) or 1)
            ),
            transport_retry_budget=int(
                str(failure.final_retry_context.get("transport_retry_budget", 1) or 1)
            ),
            transport_error_type=str(
                failure.final_retry_context.get("transport_error_type", "")
            ),
        )

    emit_contract_attempt_events(
        router=router,
        role=role,
        contract_kind="simple",
        output_type_name=spec.type_name,
        attempts=failure.attempts,
        provider_structured_mode=provider_structured_mode,
        forced_default=False,
        fixer_used=failure.fixer_used,
    )
    raise ValueError(
        f"{role} simple contract 파싱에 실패했습니다. error={failure.last_error}"
    ) from failure.last_error


def _run_simple_semantic_validator(
    parsed: SimpleT,
    *,
    semantic_validator: SimpleSemanticValidator[SimpleT] | None,
) -> list[str]:
    if semantic_validator is None:
        return []
    issues = semantic_validator(parsed)
    return [issue.strip() for issue in issues if issue.strip()]
