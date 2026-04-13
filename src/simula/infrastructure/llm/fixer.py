"""목적:
- structured parse 실패 시 fixer role을 이용해 JSON 복구를 시도한다.

설명:
- 실패한 응답 텍스트만 fixer에 전달한다.
- `json_repair + schema validation`으로 즉시 재검증한다.

사용한 설계 패턴:
- helper function + retry loop 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.llm.router
- simula.infrastructure.llm.output_parsers
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any

from simula.infrastructure.llm.router import (
    StructuredLLMRouter,
    _merge_token_count,
    _merge_ttft,
)

FIX_JSON_PROMPT = """# Role
You repair malformed JSON outputs.

# Goal
Rewrite the provided content into exactly one valid JSON object.

# Rules
- Return one JSON object only.
- Do not add markdown fences.
- Do not add explanations, notes, or commentary.
- Preserve the original meaning as much as possible.
- If parts are malformed, infer the smallest valid JSON rewrite that keeps the content intact.

# Input
Malformed content:
{failed_content}
"""


@dataclass(slots=True)
class FixerOutcome:
    """JSON fixer 실행 결과다."""

    succeeded: bool
    content: str
    parse_error: Exception | None
    parse_failure_count: int
    ttft_seconds: float | None
    input_tokens: int | None
    output_tokens: int | None
    total_tokens: int | None


async def repair_structured_json(
    *,
    router: StructuredLLMRouter,
    parser: Any,
    content: str,
) -> FixerOutcome:
    """fixer role로 malformed JSON 응답을 복구한다."""

    if not content.strip():
        return FixerOutcome(
            succeeded=False,
            content="",
            parse_error=None,
            parse_failure_count=0,
            ttft_seconds=None,
            input_tokens=None,
            output_tokens=None,
            total_tokens=None,
        )

    current_content = content
    ttft_seconds: float | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None
    parse_failure_count = 0
    last_error: Exception | None = None

    for attempt in range(4):
        fixed_content, meta = await router.ainvoke_text_with_meta(
            "fixer",
            FIX_JSON_PROMPT.format(failed_content=current_content),
            log_context={
                "scope": "json-fix",
                "attempt": attempt + 1,
            },
        )
        ttft_seconds = _merge_ttft(ttft_seconds, meta.ttft_seconds)
        input_tokens = _merge_token_count(input_tokens, meta.input_tokens)
        output_tokens = _merge_token_count(output_tokens, meta.output_tokens)
        total_tokens = _merge_token_count(total_tokens, meta.total_tokens)
        try:
            parser.parse(fixed_content)
            return FixerOutcome(
                succeeded=True,
                content=fixed_content,
                parse_error=None,
                parse_failure_count=parse_failure_count,
                ttft_seconds=ttft_seconds,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=total_tokens,
            )
        except Exception as exc:  # noqa: BLE001
            parse_failure_count += 1
            current_content = fixed_content
            last_error = ValueError(f"json fixer failed: {exc}")
            if attempt < 3:
                router.logger.warning(
                    "json fixer 재시도 대기 | attempt=%s/%s | error=%s",
                    attempt + 1,
                    4,
                    exc,
                )
                await asyncio.sleep(60)

    return FixerOutcome(
        succeeded=False,
        content=current_content,
        parse_error=last_error,
        parse_failure_count=parse_failure_count,
        ttft_seconds=ttft_seconds,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
    )
