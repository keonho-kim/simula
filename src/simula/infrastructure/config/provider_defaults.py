"""목적:
- provider별 기본 설정 해석 규칙을 제공한다.

설명:
- 공통 env 값과 역할별 override를 묶어 provider별 기본 API key/base_url/추론 옵션을 계산한다.

사용한 설계 패턴:
- provider defaults utility 패턴
"""

from __future__ import annotations

from simula.infrastructure.config.models import (
    AnthropicEffort,
    GoogleThinkingLevel,
    Provider,
    ReasoningEffort,
    Verbosity,
)
from simula.infrastructure.config.scalar_parsers import (
    env_anthropic_effort,
    env_google_thinking_level,
    env_optional_int,
    env_reasoning_effort,
    env_verbosity,
)

DEFAULT_MAX_TOKENS = {
    "PLANNER": 2400,
    "GENERATOR": 1800,
    "COORDINATOR": 1800,
    "ACTOR": 1400,
    "OBSERVER": 1600,
    "FIXER": 1200,
}
COMMON_PROVIDER_API_KEYS = {
    "openai": "OPENAI_API_KEY",
    "openai-compatible": "OPENAI_COMPATIBLE_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "google": "GOOGLE_API_KEY",
}
COMMON_PROVIDER_BASE_URLS = {
    "openai-compatible": (
        "OPENAI_COMPATIBLE_BASE_URL",
        "http://127.0.0.1:8000/v1",
    ),
    "openai": ("OPENAI_BASE_URL", None),
    "anthropic": ("ANTHROPIC_BASE_URL", None),
    "google": ("GOOGLE_BASE_URL", None),
}


def default_max_tokens(role: str) -> int:
    """역할별 기본 토큰 수를 반환한다."""

    return DEFAULT_MAX_TOKENS.get(role, 1600)


def is_openai_gpt5_model(model: str) -> bool:
    """OpenAI GPT-5 계열 모델인지 판별한다."""

    return model.strip().lower().startswith("gpt-5")


def default_reasoning_effort(
    provider: Provider,
    model: str,
) -> ReasoningEffort | None:
    """provider/model 조합의 기본 reasoning effort를 계산한다."""

    if provider == "openai" and is_openai_gpt5_model(model):
        return "none"
    return None


def default_verbosity(
    provider: Provider,
    model: str,
) -> Verbosity | None:
    """provider/model 조합의 기본 verbosity를 계산한다."""

    if provider == "openai" and is_openai_gpt5_model(model):
        return "medium"
    return None


def provider_default_api_key(
    values: dict[str, str],
    provider: Provider,
    *,
    role: str,
) -> str | None:
    """provider별 기본 API key를 결정한다."""

    role_override = values.get(f"SIM_{role}_API_KEY")
    if role_override:
        return role_override

    common_key = COMMON_PROVIDER_API_KEYS.get(provider)
    if common_key is not None:
        return values.get(common_key)
    return None


def provider_default_base_url(
    values: dict[str, str],
    provider: Provider,
    *,
    role: str,
) -> str | None:
    """provider별 기본 base URL을 결정한다."""

    role_override = values.get(f"SIM_{role}_BASE_URL")
    if role_override:
        return role_override

    base_url_spec = COMMON_PROVIDER_BASE_URLS.get(provider)
    if base_url_spec is None:
        return None
    env_key, default = base_url_spec
    if default is None:
        return values.get(env_key)
    return values.get(env_key, default)


def provider_default_stream_usage(
    values: dict[str, str],
    provider: Provider,
    *,
    role: str,
) -> bool | None:
    """provider별 기본 stream_usage를 결정한다."""

    role_override = values.get(f"SIM_{role}_STREAM_USAGE")
    if role_override is not None:
        normalized = role_override.strip().lower()
        if normalized in {"1", "true", "yes", "on"}:
            return True
        if normalized in {"0", "false", "no", "off"}:
            return False
        raise ValueError(
            f"불리언 설정을 해석할 수 없습니다: SIM_{role}_STREAM_USAGE={role_override}"
        )

    if provider == "openai":
        raw = values.get("OPENAI_STREAM_USAGE")
    elif provider == "openai-compatible":
        raw = values.get("OPENAI_COMPATIBLE_STREAM_USAGE")
    else:
        raw = None

    if raw is None:
        return None
    normalized = raw.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    env_key = (
        "OPENAI_STREAM_USAGE"
        if provider == "openai"
        else "OPENAI_COMPATIBLE_STREAM_USAGE"
    )
    raise ValueError(f"불리언 설정을 해석할 수 없습니다: {env_key}={raw}")


def provider_default_openai_reasoning_effort(
    values: dict[str, str],
    *,
    provider: Provider,
    model: str,
) -> ReasoningEffort | None:
    """OpenAI 공통 reasoning_effort 기본값을 결정한다."""

    if provider != "openai":
        return None
    return env_reasoning_effort(
        values,
        "OPENAI_REASONING_EFFORT",
        default=default_reasoning_effort(provider, model),
    )


def provider_default_openai_verbosity(
    values: dict[str, str],
    *,
    provider: Provider,
    model: str,
) -> Verbosity | None:
    """OpenAI 공통 verbosity 기본값을 결정한다."""

    if provider != "openai":
        return None
    return env_verbosity(
        values,
        "OPENAI_VERBOSITY",
        default=default_verbosity(provider, model),
    )


def provider_default_anthropic_effort(
    values: dict[str, str],
    *,
    provider: Provider,
) -> AnthropicEffort | None:
    """Anthropic 공통 effort 기본값을 결정한다."""

    if provider != "anthropic":
        return None
    return env_anthropic_effort(values, "ANTHROPIC_EFFORT")


def provider_default_google_thinking_budget(
    values: dict[str, str],
    *,
    provider: Provider,
) -> int | None:
    """Google 공통 thinking_budget 기본값을 결정한다."""

    if provider != "google":
        return None
    return env_optional_int(values, "GOOGLE_THINKING_BUDGET")


def provider_default_google_thinking_level(
    values: dict[str, str],
    *,
    provider: Provider,
) -> GoogleThinkingLevel | None:
    """Google 공통 thinking_level 기본값을 결정한다."""

    if provider != "google":
        return None
    return env_google_thinking_level(values, "GOOGLE_THINKING_LEVEL")


def provider_default_google_project_id(
    values: dict[str, str],
    *,
    role: str,
    provider: Provider,
) -> str | None:
    """Google 공통 project_id 기본값을 결정한다."""

    if provider != "google":
        return None
    return values.get(f"SIM_{role}_GOOGLE_PROJECT_ID") or values.get(
        "GOOGLE_PROJECT_ID"
    )


def provider_default_google_location(
    values: dict[str, str],
    *,
    role: str,
    provider: Provider,
) -> str | None:
    """Google 공통 location 기본값을 결정한다."""

    if provider != "google":
        return None
    return values.get(f"SIM_{role}_GOOGLE_LOCATION") or values.get("GOOGLE_LOCATION")


def provider_default_google_credentials_path(
    values: dict[str, str],
    *,
    role: str,
    provider: Provider,
) -> str | None:
    """Google 공통 credentials_path 기본값을 결정한다."""

    if provider != "google":
        return None
    return values.get(f"SIM_{role}_GOOGLE_CREDENTIALS_PATH") or values.get(
        "GOOGLE_CREDENTIALS_PATH"
    )


def provider_default_bedrock_region_name(
    values: dict[str, str],
    *,
    role: str,
    provider: Provider,
) -> str | None:
    """Bedrock 공통 region_name 기본값을 결정한다."""

    if provider != "bedrock":
        return None
    return values.get(f"SIM_{role}_BEDROCK_REGION_NAME") or values.get(
        "BEDROCK_REGION_NAME"
    )


def provider_default_bedrock_credentials_profile_name(
    values: dict[str, str],
    *,
    role: str,
    provider: Provider,
) -> str | None:
    """Bedrock 공통 credentials_profile_name 기본값을 결정한다."""

    if provider != "bedrock":
        return None
    return values.get(f"SIM_{role}_BEDROCK_CREDENTIALS_PROFILE_NAME") or values.get(
        "BEDROCK_CREDENTIALS_PROFILE_NAME"
    )


def provider_default_bedrock_endpoint_url(
    values: dict[str, str],
    *,
    role: str,
    provider: Provider,
) -> str | None:
    """Bedrock 공통 endpoint_url 기본값을 결정한다."""

    if provider != "bedrock":
        return None
    return values.get(f"SIM_{role}_BEDROCK_ENDPOINT_URL") or values.get(
        "BEDROCK_ENDPOINT_URL"
    )
