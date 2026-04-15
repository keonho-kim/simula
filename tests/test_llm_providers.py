"""목적:
- provider builder 가 provider별 호환 옵션을 올바르게 조합하는지 검증한다.

설명:
- 실제 네트워크 호출 없이 LangChain 모델 객체의 설정만 확인한다.

사용한 설계 패턴:
- provider builder 단위 테스트 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.llm.providers
"""

from __future__ import annotations

import sys
from types import ModuleType

from langchain_core.messages import HumanMessage

from simula.infrastructure.config.models import (
    BedrockProviderConfig,
    GoogleProviderConfig,
    ModelConfig,
    OpenAIProviderConfig,
    VllmProviderConfig,
)
from simula.infrastructure.llm.providers import build_provider_chat_model


def test_openai_gpt5_builder_uses_responses_api_and_reasoning_dict() -> None:
    config = ModelConfig(
        provider="openai",
        model="gpt-5.4-mini",
        max_tokens=2400,
        openai=OpenAIProviderConfig(
            api_key="x",
            reasoning_effort="none",
            verbosity="medium",
        ),
    )

    model = build_provider_chat_model(config)
    payload = model._get_request_payload(
        [HumanMessage(content="hi")],
        stream=True,
    )

    assert getattr(model, "use_responses_api") is True
    assert getattr(model, "reasoning") == {"effort": "none"}
    assert getattr(model, "verbosity") == "medium"
    assert "stream_options" not in getattr(model, "model_kwargs")
    assert "stream_options" not in payload


def test_openai_non_gpt5_builder_keeps_standard_path() -> None:
    config = ModelConfig(
        provider="openai",
        model="gpt-4.1-mini",
        max_tokens=1200,
        temperature=0.4,
        openai=OpenAIProviderConfig(api_key="x"),
    )

    model = build_provider_chat_model(config)

    assert getattr(model, "use_responses_api") in {None, False}
    assert "stream_options" not in getattr(model, "model_kwargs")


def test_vllm_builder_uses_langchain_stream_usage_without_raw_stream_options() -> None:
    config = ModelConfig(
        provider="vllm",
        model="meta-llama/Llama-3.1-8B-Instruct",
        max_tokens=1200,
        temperature=0.2,
        vllm=VllmProviderConfig(
            api_key="x",
            base_url="http://127.0.0.1:8000/v1",
        ),
    )

    model = build_provider_chat_model(config)

    assert getattr(model, "stream_usage") is True
    assert getattr(model, "extra_body") == {"stream_include_usage": True}
    assert "stream_options" not in getattr(model, "model_kwargs")


def test_google_vertex_builder_passes_project_location_and_credentials(
    monkeypatch, tmp_path
) -> None:
    captured: dict[str, object] = {}

    class FakeChatGoogleGenerativeAI:
        def __init__(self, **kwargs):  # noqa: ANN003
            captured.update(kwargs)

    fake_module = ModuleType("langchain_google_genai")
    fake_module.ChatGoogleGenerativeAI = FakeChatGoogleGenerativeAI
    monkeypatch.setitem(sys.modules, "langchain_google_genai", fake_module)

    import google.auth

    credentials_path = tmp_path / "google.json"
    credentials_path.write_text("{}", encoding="utf-8")
    monkeypatch.setattr(
        google.auth,
        "load_credentials_from_file",
        lambda path: ("fake-creds", "vertex-project"),
    )

    config = ModelConfig(
        provider="google",
        model="gemini-2.5-pro",
        max_tokens=2400,
        google=GoogleProviderConfig(
            project_id="vertex-project",
            location="us-central1",
            credentials_path=str(credentials_path),
            thinking_budget=256,
            thinking_level="low",
        ),
    )

    build_provider_chat_model(config)

    assert captured["model"] == "gemini-2.5-pro"
    assert captured["project"] == "vertex-project"
    assert captured["location"] == "us-central1"
    assert captured["credentials"] == "fake-creds"
    assert captured["thinking_budget"] == 256
    assert captured["thinking_level"] == "low"


def test_bedrock_builder_uses_chat_bedrock_converse(monkeypatch) -> None:
    captured: dict[str, object] = {}

    class FakeChatBedrockConverse:
        def __init__(self, **kwargs):  # noqa: ANN003
            captured.update(kwargs)

    fake_module = ModuleType("langchain_aws")
    fake_module.ChatBedrockConverse = FakeChatBedrockConverse
    monkeypatch.setitem(sys.modules, "langchain_aws", fake_module)

    config = ModelConfig(
        provider="bedrock",
        model="anthropic.claude-3-5-sonnet-20240620-v1:0",
        max_tokens=2400,
        bedrock=BedrockProviderConfig(
            region_name="ap-northeast-2",
            credentials_profile_name="default",
            endpoint_url="https://bedrock-runtime.ap-northeast-2.amazonaws.com",
        ),
    )

    build_provider_chat_model(config)

    assert captured["model"] == "anthropic.claude-3-5-sonnet-20240620-v1:0"
    assert captured["region_name"] == "ap-northeast-2"
    assert captured["credentials_profile_name"] == "default"
    assert (
        captured["endpoint_url"]
        == "https://bedrock-runtime.ap-northeast-2.amazonaws.com"
    )
