"""목적:
- LLM transport 메트릭 계산 helper를 제공한다.
"""

from __future__ import annotations

from typing import Any


def merge_ttft(current: float | None, candidate: float | None) -> float | None:
    """첫 응답 시간은 최초 성공 값을 유지한다."""

    if current is not None:
        return current
    return candidate


def merge_token_count(current: int | None, candidate: int | None) -> int | None:
    """토큰 수를 누적 합산한다."""

    if candidate is None:
        return current
    if current is None:
        return candidate
    return current + candidate


def extract_token_usage(message: Any) -> tuple[int | None, int | None, int | None]:
    """LangChain message에서 token usage를 추출한다."""

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


def _coerce_token_count(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
