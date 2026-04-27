"""Object structured contract runner."""

from __future__ import annotations

import time
from typing import Any, TypeVar, cast

from pydantic import BaseModel

from simula.shared.logging.llm import ensure_llm_log_context
from simula.application.ports.llm import (
    LLMCallMeta,
    ObjectOutputSpec,
    ObjectSemanticCoercer,
    ObjectSemanticValidator,
)
from simula.application.workflow.fixer import repair_structured_json
from simula.infrastructure.llm.output_parsers import build_object_output_parser
from simula.infrastructure.llm.runtime.contract_runner import (
    ContractLoopSuccess,
    ParseResult,
    run_contract_loop,
)
from simula.infrastructure.llm.runtime.logging import log_primary_parse_failure
from simula.infrastructure.llm.runtime.router import StructuredLLMRouter
from simula.infrastructure.llm.runtime.structured_retry import (
    coerce_missing_field_paths,
    emit_contract_attempt_events,
    final_prompt_variant,
)

SchemaT = TypeVar("SchemaT", bound=BaseModel)


async def run_object_contract(
    *,
    router: StructuredLLMRouter,
    logger: Any,
    role: str,
    prompt: str,
    spec: ObjectOutputSpec,
    log_context: dict[str, object] | None,
) -> tuple[SchemaT, LLMCallMeta]:
    started_at = time.perf_counter()
    retry_budget = max(1, spec.max_attempts)
    normalized_log_context = ensure_llm_log_context(
        log_context,
        role=role,
        schema=spec.schema,
    )
    normalized_log_context["contract_kind"] = "object"
    normalized_log_context["output_type_name"] = spec.schema.__name__
    router._log_contract_call_start(role=role, log_context=normalized_log_context)

    parser = build_object_output_parser(spec.schema)
    provider_structured_mode = "prompt_parse"
    def parse_content(content: str) -> ParseResult[SchemaT]:
        parsed = cast(SchemaT, parser.parse(content))
        parsed, semantic_coercion_reasons = _apply_object_semantic_coercer(
            parsed,
            semantic_coercer=cast(
                ObjectSemanticCoercer[SchemaT] | None,
                spec.semantic_coercer,
            ),
        )
        post_coercion_valid = True if semantic_coercion_reasons else None
        semantic_issues = _run_semantic_validator(
            parsed,
            semantic_validator=cast(
                ObjectSemanticValidator[SchemaT] | None,
                spec.semantic_validator,
            ),
        )
        if semantic_issues:
            raise ValueError("; ".join(semantic_issues))
        return ParseResult(
            parsed=parsed,
            semantic_coercion_reasons=semantic_coercion_reasons,
            post_coercion_valid=post_coercion_valid,
        )

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
            parser=parser,
            content=content,
            semantic_validator=cast(
                ObjectSemanticValidator[Any] | None,
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
        format_instructions=parser.get_format_instructions(),
        failure_policy=spec.failure_policy,
        retry_budget=retry_budget,
        parse_content=parse_content,
        invoke_fixer=invoke_fixer,
    )

    if isinstance(loop_result, ContractLoopSuccess):
        emit_contract_attempt_events(
            router=router,
            role=role,
            contract_kind="object",
            output_type_name=spec.schema.__name__,
            attempts=loop_result.attempts,
            provider_structured_mode=provider_structured_mode,
            forced_default=False,
            fixer_used=loop_result.fixer_used,
            semantic_coercion_reasons=loop_result.semantic_coercion_reasons,
            post_coercion_valid=loop_result.post_coercion_valid,
        )
        router._log_object_response(
            role=role,
            parsed=loop_result.parsed,
            content=loop_result.content,
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
            contract_kind="object",
            output_type_name=spec.schema.__name__,
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
            semantic_coercion_used=bool(loop_result.semantic_coercion_reasons),
            semantic_coercion_reasons=list(loop_result.semantic_coercion_reasons),
            post_coercion_valid=loop_result.post_coercion_valid,
            retry_stage=str(loop_result.final_retry_context.get("retry_stage", "")),
            retry_route=str(loop_result.final_retry_context.get("retry_route", "")),
            retry_attempt=int(str(loop_result.final_retry_context.get("retry_attempt", 0) or 0)),
            retry_budget=retry_budget,
            retry_reason=str(loop_result.final_retry_context.get("retry_reason", "")),
            missing_field_paths=coerce_missing_field_paths(
                loop_result.final_retry_context.get("missing_field_paths")
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

    failure = loop_result
    log_primary_parse_failure(
        logger=logger,
        role=role,
        last_error=failure.last_error,
        last_content=failure.last_content,
        log_context=normalized_log_context,
    )
    if spec.failure_policy == "default":
        if spec.default_payload is None:
            raise ValueError(
                f"{role} object failure_policy=`default` 는 default_payload가 필요합니다."
            )
        validated_default = cast(SchemaT, spec.schema.model_validate(spec.default_payload))
        emit_contract_attempt_events(
            router=router,
            role=role,
            contract_kind="object",
            output_type_name=spec.schema.__name__,
            attempts=failure.attempts,
            provider_structured_mode=provider_structured_mode,
            forced_default=True,
            fixer_used=failure.fixer_used,
            semantic_coercion_reasons=failure.semantic_coercion_reasons,
            post_coercion_valid=failure.post_coercion_valid,
        )
        router._log_object_response(
            role=role,
            parsed=None,
            content=failure.last_content,
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
        return validated_default, LLMCallMeta(
            contract_kind="object",
            output_type_name=spec.schema.__name__,
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
            semantic_coercion_used=bool(failure.semantic_coercion_reasons),
            semantic_coercion_reasons=list(failure.semantic_coercion_reasons),
            post_coercion_valid=failure.post_coercion_valid,
            retry_stage=str(failure.final_retry_context.get("retry_stage", "")),
            retry_route=str(failure.final_retry_context.get("retry_route", "")),
            retry_attempt=int(str(failure.final_retry_context.get("retry_attempt", 0) or 0)),
            retry_budget=retry_budget,
            retry_reason=str(failure.final_retry_context.get("retry_reason", "")),
            missing_field_paths=coerce_missing_field_paths(
                failure.final_retry_context.get("missing_field_paths")
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
        contract_kind="object",
        output_type_name=spec.schema.__name__,
        attempts=failure.attempts,
        provider_structured_mode=provider_structured_mode,
        forced_default=False,
        fixer_used=failure.fixer_used,
    )
    raise ValueError(
        f"{role} object contract 파싱에 실패했습니다. error={failure.last_error}"
    ) from failure.last_error


def _run_semantic_validator(
    parsed: SchemaT,
    *,
    semantic_validator: ObjectSemanticValidator[SchemaT] | None,
) -> list[str]:
    if semantic_validator is None:
        return []
    issues = semantic_validator(parsed)
    return [issue.strip() for issue in issues if issue.strip()]


def _apply_object_semantic_coercer(
    parsed: SchemaT,
    *,
    semantic_coercer: ObjectSemanticCoercer[SchemaT] | None,
) -> tuple[SchemaT, list[str]]:
    if semantic_coercer is None:
        return parsed, []
    coerced, reasons = semantic_coercer(parsed)
    return coerced, [reason.strip() for reason in reasons if reason.strip()]
