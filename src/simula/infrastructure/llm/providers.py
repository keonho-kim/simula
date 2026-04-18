"""목적:
- provider별 LangChain chat model 생성 로직을 제공한다.

설명:
- `ModelConfig`를 받아 provider별 chat model을 직접 조립한다.
- 중간 spec 객체나 builder registry 없이 runtime construction만 담당한다.

사용한 설계 패턴:
- provider 분기 + private helper 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.config.models
- simula.infrastructure.llm.runtime.router
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from langchain_core.language_models import BaseChatModel

from simula.infrastructure.config.models import ModelConfig


def build_provider_chat_model(config: ModelConfig) -> BaseChatModel:
    """ModelConfig로 provider별 chat model을 생성한다."""

    match config.provider:
        case "openai":
            return _build_openai_chat_model(config)
        case "openai-compatible":
            return _build_openai_compatible_chat_model(config)
        case "anthropic":
            return _build_anthropic_chat_model(config)
        case "google":
            return _build_google_chat_model(config)
        case "bedrock":
            return _build_bedrock_chat_model(config)
        case _:
            raise ValueError(f"지원하지 않는 provider입니다: {config.provider}")


def _build_openai_chat_model(config: ModelConfig) -> BaseChatModel:
    """OpenAI chat model을 생성한다."""

    model_kwargs = _openai_transport_kwargs(config)
    if _is_openai_gpt5_model(config.model):
        model_kwargs["use_responses_api"] = True
        if config.openai.reasoning_effort is not None:
            model_kwargs["reasoning"] = {"effort": config.openai.reasoning_effort}
        if config.openai.verbosity is not None:
            model_kwargs["verbosity"] = config.openai.verbosity
        if _should_send_openai_temperature(config):
            model_kwargs["temperature"] = config.temperature
    else:
        if _should_send_openai_temperature(config):
            model_kwargs["temperature"] = config.temperature
        if config.openai.reasoning_effort is not None:
            model_kwargs["reasoning_effort"] = config.openai.reasoning_effort
        if config.openai.verbosity is not None:
            model_kwargs["verbosity"] = config.openai.verbosity
    if config.openai.stream_usage is not None:
        model_kwargs["stream_usage"] = config.openai.stream_usage
    return _build_chat_openai_model(model_kwargs)


def _build_openai_compatible_chat_model(config: ModelConfig) -> BaseChatModel:
    """OpenAI-compatible chat model을 생성한다."""

    model_kwargs = _openai_transport_kwargs(config)
    model_kwargs["temperature"] = config.temperature
    if config.openai_compatible.stream_usage is not None:
        model_kwargs["stream_usage"] = config.openai_compatible.stream_usage
    if config.openai_compatible.extra_body:
        model_kwargs["extra_body"] = config.openai_compatible.extra_body
    return _build_chat_openai_model(model_kwargs)


def _build_anthropic_chat_model(config: ModelConfig) -> BaseChatModel:
    """Anthropic chat model을 생성한다."""

    from langchain_anthropic import ChatAnthropic

    model_kwargs: dict[str, Any] = {
        "model_name": config.model,
        "temperature": config.temperature,
        "max_tokens_to_sample": config.max_tokens,
        "timeout": config.timeout_seconds,
        "api_key": config.anthropic.api_key,
        "base_url": config.anthropic.base_url,
    }
    if config.anthropic.effort is not None:
        model_kwargs["effort"] = config.anthropic.effort
    return ChatAnthropic(**model_kwargs)


def _build_google_chat_model(config: ModelConfig) -> BaseChatModel:
    """Google chat model을 생성한다."""

    from langchain_google_genai import ChatGoogleGenerativeAI

    model_kwargs: dict[str, Any] = {
        "model": config.model,
        "temperature": config.temperature,
        "max_output_tokens": config.max_tokens,
        "timeout": config.timeout_seconds,
    }
    if config.google.api_key is not None:
        model_kwargs["google_api_key"] = config.google.api_key
    if config.google.base_url is not None:
        model_kwargs["base_url"] = config.google.base_url
    if config.google.project_id is not None:
        model_kwargs["project"] = config.google.project_id
    if config.google.location is not None:
        model_kwargs["location"] = config.google.location
    if config.google.credentials_path is not None:
        from google.auth import load_credentials_from_file

        credentials, _ = load_credentials_from_file(
            str(Path(config.google.credentials_path).expanduser())
        )
        model_kwargs["credentials"] = credentials
    if config.google.thinking_budget is not None:
        model_kwargs["thinking_budget"] = config.google.thinking_budget
    if config.google.thinking_level is not None:
        model_kwargs["thinking_level"] = config.google.thinking_level
    return ChatGoogleGenerativeAI(**model_kwargs)


def _build_bedrock_chat_model(config: ModelConfig) -> BaseChatModel:
    """Bedrock Converse chat model을 생성한다."""

    from langchain_aws import ChatBedrockConverse

    model_kwargs: dict[str, Any] = {
        "model": config.model,
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
        "region_name": config.bedrock.region_name,
    }
    if config.bedrock.credentials_profile_name is not None:
        model_kwargs["credentials_profile_name"] = (
            config.bedrock.credentials_profile_name
        )
    if config.bedrock.endpoint_url is not None:
        model_kwargs["endpoint_url"] = config.bedrock.endpoint_url
    return ChatBedrockConverse(**model_kwargs)


def _openai_transport_kwargs(config: ModelConfig) -> dict[str, Any]:
    """OpenAI 계열 transport kwargs를 조립한다."""

    api_key = config.openai.api_key
    base_url = config.openai.base_url
    if config.provider == "openai-compatible":
        api_key = config.openai_compatible.api_key
        base_url = config.openai_compatible.base_url

    return {
        "model": config.model,
        "max_completion_tokens": config.max_tokens,
        "timeout": config.timeout_seconds,
        "api_key": api_key,
        "base_url": base_url,
    }


def _build_chat_openai_model(model_kwargs: dict[str, Any]) -> BaseChatModel:
    """공통 ChatOpenAI 생성 경로다."""

    from langchain_openai import ChatOpenAI

    return ChatOpenAI(**model_kwargs)


def _is_openai_gpt5_model(model: str) -> bool:
    return model.strip().lower().startswith("gpt-5")


def _should_send_openai_temperature(config: ModelConfig) -> bool:
    if not _is_openai_gpt5_model(config.model):
        return True
    if config.openai.reasoning_effort in {None, "none"}:
        return True
    return False
