"""목적:
- 설정 스칼라 파싱 유틸을 제공한다.

설명:
- env 스타일 문자열 값을 공통 규칙으로 해석해 config builder가 재사용할 수 있게 한다.

사용한 설계 패턴:
- scalar parser utility 패턴
"""

from __future__ import annotations

from typing import cast

from simula.infrastructure.config.models import (
    AnthropicEffort,
    GoogleThinkingLevel,
    OllamaReasoning,
    ReasoningEffort,
    Verbosity,
)

BOOLEAN_TRUE_VALUES = {"1", "true", "yes", "on"}
BOOLEAN_FALSE_VALUES = {"0", "false", "no", "off"}


def env_str(values: dict[str, str], key: str, default: str | None = None) -> str:
    """문자열 값을 읽는다."""

    value = values.get(key, default)
    if value is None:
        raise ValueError(f"필수 설정이 비어 있습니다: {key}")
    return value


def env_int(values: dict[str, str], key: str, default: int) -> int:
    """정수 값을 읽는다."""

    return int(values.get(key, str(default)))


def env_float(values: dict[str, str], key: str, default: float) -> float:
    """실수 값을 읽는다."""

    return float(values.get(key, str(default)))


def env_optional_int(
    values: dict[str, str],
    key: str,
    *,
    default: int | None = None,
) -> int | None:
    """선택 정수 값을 읽는다."""

    raw = values.get(key)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


def env_bool(values: dict[str, str], key: str, default: bool) -> bool:
    """불리언 값을 읽는다."""

    raw = values.get(key)
    if raw is None:
        return default

    normalized = raw.strip().lower()
    if normalized in BOOLEAN_TRUE_VALUES:
        return True
    if normalized in BOOLEAN_FALSE_VALUES:
        return False
    raise ValueError(f"불리언 설정을 해석할 수 없습니다: {key}={raw}")


def env_enum(
    *,
    key: str,
    raw: str,
    allowed: set[str],
    label: str,
) -> str:
    """소문자 enum 문자열을 공통 규칙으로 파싱한다."""

    normalized = raw.strip().lower()
    if normalized not in allowed:
        raise ValueError(f"{label} 설정을 해석할 수 없습니다: {key}={raw}")
    return normalized


def env_reasoning_effort(
    values: dict[str, str],
    key: str,
    default: ReasoningEffort | None = None,
) -> ReasoningEffort | None:
    """OpenAI reasoning effort를 읽는다."""

    raw = values.get(key)
    if raw is None:
        return default
    return cast(
        ReasoningEffort,
        env_enum(
            key=key,
            raw=raw,
            allowed={"none", "low", "medium", "high", "xhigh"},
            label="reasoning_effort",
        ),
    )


def env_verbosity(
    values: dict[str, str],
    key: str,
    default: Verbosity | None = None,
) -> Verbosity | None:
    """OpenAI verbosity를 읽는다."""

    raw = values.get(key)
    if raw is None:
        return default
    return cast(
        Verbosity,
        env_enum(
            key=key,
            raw=raw,
            allowed={"low", "medium", "high"},
            label="verbosity",
        ),
    )


def env_ollama_reasoning(
    values: dict[str, str],
    key: str,
    *,
    default: OllamaReasoning | None = None,
) -> OllamaReasoning | None:
    """Ollama reasoning 옵션을 읽는다."""

    raw = values.get(key)
    if raw is None:
        return default

    normalized = raw.strip().lower()
    if normalized in BOOLEAN_TRUE_VALUES:
        return True
    if normalized in BOOLEAN_FALSE_VALUES:
        return False
    if normalized in {"low", "medium", "high"}:
        return cast(OllamaReasoning, normalized)
    raise ValueError(f"ollama reasoning 설정을 해석할 수 없습니다: {key}={raw}")


def env_anthropic_effort(
    values: dict[str, str],
    key: str,
    *,
    default: AnthropicEffort | None = None,
) -> AnthropicEffort | None:
    """Anthropic effort를 읽는다."""

    raw = values.get(key)
    if raw is None:
        return default
    return cast(
        AnthropicEffort,
        env_enum(
            key=key,
            raw=raw,
            allowed={"low", "medium", "high", "max"},
            label="anthropic effort",
        ),
    )


def env_google_thinking_level(
    values: dict[str, str],
    key: str,
    *,
    default: GoogleThinkingLevel | None = None,
) -> GoogleThinkingLevel | None:
    """Google thinking level을 읽는다."""

    raw = values.get(key)
    if raw is None:
        return default
    return cast(
        GoogleThinkingLevel,
        env_enum(
            key=key,
            raw=raw,
            allowed={"minimal", "low", "medium", "high"},
            label="google thinking level",
        ),
    )
