"""목적:
- provider별 LLM 생성 객체를 분리하고 factory가 조합할 수 있게 한다.

설명:
- 공통 ModelConfig를 provider 전용 spec 객체로 변환한 뒤,
  각 provider builder가 실제 LangChain chat model을 생성한다.

사용한 설계 패턴:
- provider registry + builder 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.config.models
- simula.infrastructure.llm.router
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol, cast

from langchain_core.language_models import BaseChatModel

from simula.infrastructure.config.models import ModelConfig, Provider


@dataclass(slots=True)
class CommonModelSpec:
    """provider 공통 모델 spec이다."""

    model: str
    temperature: float
    max_tokens: int
    timeout_seconds: float


@dataclass(slots=True)
class OpenAIProviderSpec(CommonModelSpec):
    """OpenAI provider 전용 spec이다."""

    api_key: str | None
    base_url: str | None
    reasoning_effort: str | None
    verbosity: str | None


@dataclass(slots=True)
class AnthropicProviderSpec(CommonModelSpec):
    """Anthropic provider 전용 spec이다."""

    api_key: str | None
    base_url: str | None
    effort: str | None


@dataclass(slots=True)
class GoogleProviderSpec(CommonModelSpec):
    """Google provider 전용 spec이다."""

    api_key: str | None
    base_url: str | None
    project_id: str | None
    location: str | None
    credentials_path: str | None
    thinking_budget: int | None
    thinking_level: str | None


@dataclass(slots=True)
class BedrockProviderSpec(CommonModelSpec):
    """Bedrock provider 전용 spec이다."""

    region_name: str | None
    credentials_profile_name: str | None
    endpoint_url: str | None


@dataclass(slots=True)
class OllamaProviderSpec(CommonModelSpec):
    """Ollama provider 전용 spec이다."""

    base_url: str | None
    reasoning: bool | str | None


@dataclass(slots=True)
class VllmProviderSpec(CommonModelSpec):
    """vLLM provider 전용 spec이다."""

    api_key: str | None
    base_url: str | None


ProviderSpec = (
    OpenAIProviderSpec
    | AnthropicProviderSpec
    | GoogleProviderSpec
    | BedrockProviderSpec
    | OllamaProviderSpec
    | VllmProviderSpec
)


class ProviderChatModelBuilder(Protocol):
    """provider builder 공통 프로토콜이다."""

    provider: Provider

    def build(self, spec: ProviderSpec) -> BaseChatModel:
        """provider spec으로 chat model을 생성한다."""


def build_provider_spec(config: ModelConfig) -> ProviderSpec:
    """공통 설정을 provider 전용 spec 객체로 변환한다."""

    common = CommonModelSpec(
        model=config.model,
        temperature=config.temperature,
        max_tokens=config.max_tokens,
        timeout_seconds=config.timeout_seconds,
    )
    if config.provider == "openai":
        return OpenAIProviderSpec(
            model=common.model,
            temperature=common.temperature,
            max_tokens=common.max_tokens,
            timeout_seconds=common.timeout_seconds,
            api_key=config.openai.api_key,
            base_url=config.openai.base_url,
            reasoning_effort=config.openai.reasoning_effort,
            verbosity=config.openai.verbosity,
        )
    if config.provider == "anthropic":
        return AnthropicProviderSpec(
            model=common.model,
            temperature=common.temperature,
            max_tokens=common.max_tokens,
            timeout_seconds=common.timeout_seconds,
            api_key=config.anthropic.api_key,
            base_url=config.anthropic.base_url,
            effort=config.anthropic.effort,
        )
    if config.provider == "google":
        return GoogleProviderSpec(
            model=common.model,
            temperature=common.temperature,
            max_tokens=common.max_tokens,
            timeout_seconds=common.timeout_seconds,
            api_key=config.google.api_key,
            base_url=config.google.base_url,
            project_id=config.google.project_id,
            location=config.google.location,
            credentials_path=config.google.credentials_path,
            thinking_budget=config.google.thinking_budget,
            thinking_level=config.google.thinking_level,
        )
    if config.provider == "bedrock":
        return BedrockProviderSpec(
            model=common.model,
            temperature=common.temperature,
            max_tokens=common.max_tokens,
            timeout_seconds=common.timeout_seconds,
            region_name=config.bedrock.region_name,
            credentials_profile_name=config.bedrock.credentials_profile_name,
            endpoint_url=config.bedrock.endpoint_url,
        )
    if config.provider == "ollama":
        return OllamaProviderSpec(
            model=common.model,
            temperature=common.temperature,
            max_tokens=common.max_tokens,
            timeout_seconds=common.timeout_seconds,
            base_url=config.ollama.base_url,
            reasoning=config.ollama.reasoning,
        )
    return VllmProviderSpec(
        model=common.model,
        temperature=common.temperature,
        max_tokens=common.max_tokens,
        timeout_seconds=common.timeout_seconds,
        api_key=config.vllm.api_key,
        base_url=config.vllm.base_url,
    )


def build_provider_chat_model(config: ModelConfig) -> BaseChatModel:
    """provider registry를 통해 실제 chat model을 생성한다."""

    spec = build_provider_spec(config)
    builder = PROVIDER_BUILDERS[config.provider]
    return builder.build(spec)


@dataclass(slots=True)
class OpenAIChatModelBuilder:
    """OpenAI chat model builder다."""

    provider: Provider = "openai"

    def build(self, spec: ProviderSpec) -> BaseChatModel:
        from langchain_openai import ChatOpenAI

        openai_spec = cast(OpenAIProviderSpec, spec)
        model_kwargs: dict[str, Any] = {
            "model": openai_spec.model,
            "max_completion_tokens": openai_spec.max_tokens,
            "timeout": openai_spec.timeout_seconds,
            "api_key": openai_spec.api_key,
            "base_url": openai_spec.base_url,
            "model_kwargs": {"stream_options": {"include_usage": True}},
        }
        if _is_openai_gpt5_model(openai_spec.model):
            model_kwargs["use_responses_api"] = True
            if openai_spec.reasoning_effort is not None:
                model_kwargs["reasoning"] = {"effort": openai_spec.reasoning_effort}
            if openai_spec.verbosity is not None:
                model_kwargs["verbosity"] = openai_spec.verbosity
            if _should_send_openai_temperature(openai_spec):
                model_kwargs["temperature"] = openai_spec.temperature
        else:
            if _should_send_openai_temperature(openai_spec):
                model_kwargs["temperature"] = openai_spec.temperature
            if openai_spec.reasoning_effort is not None:
                model_kwargs["reasoning_effort"] = openai_spec.reasoning_effort
            if openai_spec.verbosity is not None:
                model_kwargs["verbosity"] = openai_spec.verbosity
        return cast(Any, ChatOpenAI)(**model_kwargs)


@dataclass(slots=True)
class AnthropicChatModelBuilder:
    """Anthropic chat model builder다."""

    provider: Provider = "anthropic"

    def build(self, spec: ProviderSpec) -> BaseChatModel:
        from langchain_anthropic import ChatAnthropic

        anthropic_spec = cast(AnthropicProviderSpec, spec)
        model_kwargs: dict[str, Any] = {
            "model_name": anthropic_spec.model,
            "temperature": anthropic_spec.temperature,
            "max_tokens_to_sample": anthropic_spec.max_tokens,
            "timeout": anthropic_spec.timeout_seconds,
            "api_key": anthropic_spec.api_key,
            "base_url": anthropic_spec.base_url,
        }
        if anthropic_spec.effort is not None:
            model_kwargs["effort"] = anthropic_spec.effort
        return cast(Any, ChatAnthropic)(**model_kwargs)


@dataclass(slots=True)
class GoogleChatModelBuilder:
    """Google chat model builder다."""

    provider: Provider = "google"

    def build(self, spec: ProviderSpec) -> BaseChatModel:
        from langchain_google_genai import ChatGoogleGenerativeAI

        google_spec = cast(GoogleProviderSpec, spec)
        model_kwargs: dict[str, Any] = {
            "model": google_spec.model,
            "temperature": google_spec.temperature,
            "max_output_tokens": google_spec.max_tokens,
            "timeout": google_spec.timeout_seconds,
        }
        if google_spec.api_key is not None:
            model_kwargs["google_api_key"] = google_spec.api_key
        if google_spec.base_url is not None:
            model_kwargs["base_url"] = google_spec.base_url
        if google_spec.project_id is not None:
            model_kwargs["project"] = google_spec.project_id
        if google_spec.location is not None:
            model_kwargs["location"] = google_spec.location
        if google_spec.credentials_path is not None:
            from google.auth import load_credentials_from_file

            credentials, _ = load_credentials_from_file(
                str(Path(google_spec.credentials_path).expanduser())
            )
            model_kwargs["credentials"] = credentials
        if google_spec.thinking_budget is not None:
            model_kwargs["thinking_budget"] = google_spec.thinking_budget
        if google_spec.thinking_level is not None:
            model_kwargs["thinking_level"] = google_spec.thinking_level
        return cast(Any, ChatGoogleGenerativeAI)(**model_kwargs)


@dataclass(slots=True)
class BedrockChatModelBuilder:
    """Bedrock Converse chat model builder다."""

    provider: Provider = "bedrock"

    def build(self, spec: ProviderSpec) -> BaseChatModel:
        from langchain_aws import ChatBedrockConverse

        bedrock_spec = cast(BedrockProviderSpec, spec)
        model_kwargs: dict[str, Any] = {
            "model": bedrock_spec.model,
            "temperature": bedrock_spec.temperature,
            "max_tokens": bedrock_spec.max_tokens,
            "region_name": bedrock_spec.region_name,
        }
        if bedrock_spec.credentials_profile_name is not None:
            model_kwargs["credentials_profile_name"] = (
                bedrock_spec.credentials_profile_name
            )
        if bedrock_spec.endpoint_url is not None:
            model_kwargs["endpoint_url"] = bedrock_spec.endpoint_url
        return cast(Any, ChatBedrockConverse)(**model_kwargs)


@dataclass(slots=True)
class OllamaChatModelBuilder:
    """Ollama chat model builder다."""

    provider: Provider = "ollama"

    def build(self, spec: ProviderSpec) -> BaseChatModel:
        from langchain_ollama import ChatOllama

        ollama_spec = cast(OllamaProviderSpec, spec)
        model_kwargs: dict[str, Any] = {
            "model": ollama_spec.model,
            "temperature": ollama_spec.temperature,
            "num_predict": ollama_spec.max_tokens,
            "base_url": ollama_spec.base_url,
        }
        if ollama_spec.reasoning is not None:
            model_kwargs["reasoning"] = ollama_spec.reasoning
        return cast(Any, ChatOllama)(**model_kwargs)


@dataclass(slots=True)
class VllmChatModelBuilder:
    """vLLM chat model builder다."""

    provider: Provider = "vllm"

    def build(self, spec: ProviderSpec) -> BaseChatModel:
        from langchain_openai import ChatOpenAI

        vllm_spec = cast(VllmProviderSpec, spec)
        return cast(Any, ChatOpenAI)(
            model=vllm_spec.model,
            temperature=vllm_spec.temperature,
            max_completion_tokens=vllm_spec.max_tokens,
            timeout=vllm_spec.timeout_seconds,
            api_key=vllm_spec.api_key,
            base_url=vllm_spec.base_url,
            model_kwargs={"stream_options": {"include_usage": True}},
            extra_body={"stream_include_usage": True},
        )


PROVIDER_BUILDERS: dict[Provider, ProviderChatModelBuilder] = {
    "openai": OpenAIChatModelBuilder(),
    "anthropic": AnthropicChatModelBuilder(),
    "google": GoogleChatModelBuilder(),
    "bedrock": BedrockChatModelBuilder(),
    "ollama": OllamaChatModelBuilder(),
    "vllm": VllmChatModelBuilder(),
}


def _is_openai_gpt5_model(model: str) -> bool:
    return model.strip().lower().startswith("gpt-5")


def _should_send_openai_temperature(spec: OpenAIProviderSpec) -> bool:
    if not _is_openai_gpt5_model(spec.model):
        return True
    if spec.reasoning_effort in {None, "none"}:
        return True
    return False
