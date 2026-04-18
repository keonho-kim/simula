"""목적:
- 역할별 ModelConfig 조립 로직을 제공한다.

설명:
- provider defaults와 scalar parser를 조합해 역할별 모델 설정을 만든다.

사용한 설계 패턴:
- model builder utility 패턴
"""

from __future__ import annotations

from typing import cast

from simula.infrastructure.config.models import (
    AnthropicProviderConfig,
    BedrockProviderConfig,
    GoogleProviderConfig,
    ModelConfig,
    OpenAICompatibleProviderConfig,
    OpenAIProviderConfig,
    Provider,
)
from simula.infrastructure.config.provider_defaults import (
    default_max_tokens,
    provider_default_anthropic_effort,
    provider_default_api_key,
    provider_default_base_url,
    provider_default_stream_usage,
    provider_default_bedrock_credentials_profile_name,
    provider_default_bedrock_endpoint_url,
    provider_default_bedrock_region_name,
    provider_default_google_credentials_path,
    provider_default_google_location,
    provider_default_google_project_id,
    provider_default_google_thinking_budget,
    provider_default_google_thinking_level,
    provider_default_openai_reasoning_effort,
    provider_default_openai_verbosity,
)
from simula.infrastructure.config.scalar_parsers import (
    env_anthropic_effort,
    env_float,
    env_google_thinking_level,
    env_int,
    env_json_object,
    env_optional_int,
    env_reasoning_effort,
    env_str,
    env_verbosity,
)


def build_model_config(
    values: dict[str, str],
    *,
    role: str,
    default_provider: Provider,
    default_model: str,
) -> ModelConfig:
    """역할별 모델 설정을 조립한다."""

    provider = cast(Provider, env_str(values, f"SIM_{role}_PROVIDER", default_provider))
    model = env_str(values, f"SIM_{role}_MODEL", default_model)

    return ModelConfig(
        provider=provider,
        model=model,
        temperature=env_float(values, f"SIM_{role}_TEMPERATURE", 0.6),
        max_tokens=env_int(values, f"SIM_{role}_MAX_TOKENS", default_max_tokens(role)),
        timeout_seconds=env_float(values, f"SIM_{role}_TIMEOUT_SECONDS", 60.0),
        openai=OpenAIProviderConfig(
            api_key=provider_default_api_key(values, "openai", role=role),
            base_url=provider_default_base_url(values, "openai", role=role),
            stream_usage=(
                provider_default_stream_usage(
                    values,
                    "openai",
                    role=role,
                )
                if provider == "openai"
                else None
            ),
            reasoning_effort=env_reasoning_effort(
                values,
                f"SIM_{role}_REASONING_EFFORT",
                provider_default_openai_reasoning_effort(
                    values,
                    provider=provider,
                    model=model,
                ),
            ),
            verbosity=env_verbosity(
                values,
                f"SIM_{role}_VERBOSITY",
                provider_default_openai_verbosity(
                    values,
                    provider=provider,
                    model=model,
                ),
            ),
        ),
        openai_compatible=OpenAICompatibleProviderConfig(
            api_key=_openai_compatible_api_key(values, role=role, provider=provider),
            base_url=provider_default_base_url(
                values,
                "openai-compatible",
                role=role,
            ),
            stream_usage=(
                provider_default_stream_usage(
                    values,
                    "openai-compatible",
                    role=role,
                )
                if provider == "openai-compatible"
                else None
            ),
            extra_body=_provider_extra_body(values, role=role, provider=provider),
        ),
        anthropic=AnthropicProviderConfig(
            api_key=provider_default_api_key(values, "anthropic", role=role),
            base_url=provider_default_base_url(values, "anthropic", role=role),
            effort=env_anthropic_effort(
                values,
                f"SIM_{role}_ANTHROPIC_EFFORT",
                default=provider_default_anthropic_effort(
                    values,
                    provider=provider,
                ),
            ),
        ),
        google=GoogleProviderConfig(
            api_key=provider_default_api_key(values, "google", role=role),
            base_url=provider_default_base_url(values, "google", role=role),
            project_id=provider_default_google_project_id(
                values,
                role=role,
                provider=provider,
            ),
            location=provider_default_google_location(
                values,
                role=role,
                provider=provider,
            ),
            credentials_path=provider_default_google_credentials_path(
                values,
                role=role,
                provider=provider,
            ),
            thinking_budget=env_optional_int(
                values,
                f"SIM_{role}_GOOGLE_THINKING_BUDGET",
                default=provider_default_google_thinking_budget(
                    values,
                    provider=provider,
                ),
            ),
            thinking_level=env_google_thinking_level(
                values,
                f"SIM_{role}_GOOGLE_THINKING_LEVEL",
                default=provider_default_google_thinking_level(
                    values,
                    provider=provider,
                ),
            ),
        ),
        bedrock=BedrockProviderConfig(
            region_name=provider_default_bedrock_region_name(
                values,
                role=role,
                provider=provider,
            ),
            credentials_profile_name=provider_default_bedrock_credentials_profile_name(
                values,
                role=role,
                provider=provider,
            ),
            endpoint_url=provider_default_bedrock_endpoint_url(
                values,
                role=role,
                provider=provider,
            ),
        ),
    )


def _provider_extra_body(
    values: dict[str, str],
    *,
    role: str,
    provider: Provider,
) -> dict[str, object]:
    """OpenAI-compatible extra_body를 병합한다."""

    if provider != "openai-compatible":
        return {}

    merged = env_json_object(values, "OPENAI_COMPATIBLE_EXTRA_BODY")
    merged.update(env_json_object(values, f"SIM_{role}_EXTRA_BODY"))
    return merged


def _openai_compatible_api_key(
    values: dict[str, str],
    *,
    role: str,
    provider: Provider,
) -> str | None:
    """OpenAI-compatible API key를 결정한다."""

    api_key = provider_default_api_key(values, "openai-compatible", role=role)
    if api_key is not None:
        return api_key
    if provider == "openai-compatible":
        return "EMPTY"
    return None
