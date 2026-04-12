"""목적:
- 설정 로더의 병합 규칙과 provider 공통 상속을 검증한다.

설명:
- `env.toml`, 환경 변수, 역할별 provider override가 새 계약대로 동작하는지 확인한다.

사용한 설계 패턴:
- 구성 요소 단위 테스트 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.config.loader
"""

from __future__ import annotations

import textwrap

import pytest

from simula.infrastructure.config.loader import load_settings, load_settings_bundle
from simula.infrastructure.config.sources import resolve_env_file


def _clear_known_env(monkeypatch: pytest.MonkeyPatch) -> None:
    prefixes = (
        "SIM_",
        "OPENAI_",
        "ANTHROPIC_",
        "GOOGLE_",
        "BEDROCK_",
        "OLLAMA_",
        "VLLM_",
    )
    for key in list(__import__("os").environ):
        if key.startswith(prefixes):
            monkeypatch.delenv(key, raising=False)


def test_load_settings_reads_provider_defaults(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text(
        textwrap.dedent(
            """
            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./runtime.sqlite"

            [llm.openai]
            API_KEY = "openai-key"
            reasoning_effort = "none"
            verbosity = "medium"

            [llm.ollama]
            base_url = "http://127.0.0.1:11434"
            reasoning = true

            [llm.planner]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.generator]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.actor]
            provider = "ollama"
            model = "qwen3:8b"

            [llm.observer]
            provider = "openai"
            model = "gpt-5.4-mini"
            """
        ).strip(),
        encoding="utf-8",
    )

    settings = load_settings(env_file)

    assert settings.models.planner.openai.api_key == "openai-key"
    assert settings.models.planner.reasoning_effort == "none"
    assert settings.models.generator.verbosity == "medium"
    assert settings.models.actor.base_url == "http://127.0.0.1:11434"
    assert settings.models.actor.reasoning is True


def test_role_table_provider_options_win_over_common_defaults(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text(
        textwrap.dedent(
            """
            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./runtime.sqlite"

            [llm.openai]
            API_KEY = "openai-key"
            reasoning_effort = "none"
            verbosity = "medium"

            [llm.planner]
            provider = "openai"
            model = "gpt-5.4-mini"
            API_KEY = "planner-key"
            reasoning_effort = "high"
            verbosity = "low"

            [llm.generator]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.actor]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.observer]
            provider = "openai"
            model = "gpt-5.4-mini"
            """
        ).strip(),
        encoding="utf-8",
    )

    settings = load_settings(env_file)

    assert settings.models.planner.openai.api_key == "planner-key"
    assert settings.models.planner.reasoning_effort == "high"
    assert settings.models.planner.verbosity == "low"
    assert settings.models.generator.openai.api_key == "openai-key"
    assert settings.models.generator.verbosity == "medium"


def test_role_table_reads_openai_reasoning_effort_and_verbosity(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text(
        textwrap.dedent(
            """
            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./runtime.sqlite"

            [llm.openai]
            API_KEY = "openai-key"

            [llm.planner]
            provider = "openai"
            model = "gpt-5.4-mini"
            reasoning_effort = "high"
            verbosity = "low"

            [llm.generator]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.actor]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.observer]
            provider = "openai"
            model = "gpt-5.4-mini"
            """
        ).strip(),
        encoding="utf-8",
    )

    settings = load_settings(env_file)

    assert settings.models.planner.reasoning_effort == "high"
    assert settings.models.planner.verbosity == "low"


def test_nested_role_provider_table_is_rejected_for_openai(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text(
        textwrap.dedent(
            """
            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./runtime.sqlite"

            [llm.openai]
            API_KEY = "openai-key"

            [llm.planner]
            provider = "openai"
            model = "gpt-5.4-mini"
            reasoning_effort = "low"
            verbosity = "medium"

            [llm.planner.openai]
            reasoning_effort = "high"
            verbosity = "low"

            [llm.generator]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.actor]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.observer]
            provider = "openai"
            model = "gpt-5.4-mini"
            """
        ).strip(),
        encoding="utf-8",
    )

    with pytest.raises(
        ValueError,
        match=r"\[llm\.planner\.openai\] 문법은 더 이상 지원하지 않습니다",
    ):
        load_settings(env_file)


def test_load_settings_reads_google_and_vllm_provider_defaults(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text(
        textwrap.dedent(
            """
            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./runtime.sqlite"

            [llm.google]
            API_KEY = "google-key"
            base_url = "https://generativelanguage.googleapis.com"
            thinking_level = "low"
            thinking_budget = 256

            [llm.vllm]
            API_KEY = "vllm-key"
            base_url = "http://127.0.0.1:8000/v1"

            [llm.planner]
            provider = "google"
            model = "gemini-2.5-flash"

            [llm.generator]
            provider = "vllm"
            model = "meta-llama"

            [llm.actor]
            provider = "google"
            model = "gemini-2.5-flash"

            [llm.observer]
            provider = "vllm"
            model = "meta-llama"
            """
        ).strip(),
        encoding="utf-8",
    )

    settings = load_settings(env_file)

    assert settings.models.planner.google.api_key == "google-key"
    assert settings.models.planner.google.thinking_level == "low"
    assert settings.models.planner.google.thinking_budget == 256
    assert settings.models.generator.vllm.api_key == "vllm-key"
    assert settings.models.generator.vllm.base_url == "http://127.0.0.1:8000/v1"


def test_load_settings_reads_google_vertex_defaults(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text(
        textwrap.dedent(
            """
            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./runtime.sqlite"

            [llm.google]
            project_id = "vertex-project"
            location = "us-central1"
            credentials_path = "/tmp/google-credentials.json"

            [llm.planner]
            provider = "google"
            model = "gemini-2.5-pro"

            [llm.generator]
            provider = "google"
            model = "gemini-2.5-flash"

            [llm.actor]
            provider = "google"
            model = "gemini-2.5-flash"

            [llm.observer]
            provider = "google"
            model = "gemini-2.5-flash"
            """
        ).strip(),
        encoding="utf-8",
    )

    settings = load_settings(env_file)

    assert settings.models.planner.google.project_id == "vertex-project"
    assert settings.models.planner.google.location == "us-central1"
    assert (
        settings.models.planner.google.credentials_path
        == "/tmp/google-credentials.json"
    )


def test_role_table_reads_google_provider_specific_fields(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text(
        textwrap.dedent(
            """
            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./runtime.sqlite"

            [llm.planner]
            provider = "google"
            model = "gemini-2.5-pro"
            project_id = "planner-project"
            location = "us-central1"
            credentials_path = "/tmp/google-credentials.json"
            thinking_level = "medium"

            [llm.generator]
            provider = "google"
            model = "gemini-2.5-flash"
            project_id = "generator-project"
            location = "us-east1"

            [llm.actor]
            provider = "google"
            model = "gemini-2.5-flash"
            project_id = "actor-project"
            location = "asia-northeast3"

            [llm.observer]
            provider = "google"
            model = "gemini-2.5-flash"
            project_id = "observer-project"
            location = "europe-west4"
            """
        ).strip(),
        encoding="utf-8",
    )

    settings = load_settings(env_file)

    assert settings.models.planner.google.project_id == "planner-project"
    assert settings.models.planner.google.location == "us-central1"
    assert (
        settings.models.planner.google.credentials_path
        == "/tmp/google-credentials.json"
    )
    assert settings.models.planner.google.thinking_level == "medium"


def test_load_settings_reads_bedrock_defaults(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text(
        textwrap.dedent(
            """
            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./runtime.sqlite"

            [llm.bedrock]
            region_name = "ap-northeast-2"
            credentials_profile_name = "default"
            endpoint_url = "https://bedrock-runtime.ap-northeast-2.amazonaws.com"

            [llm.planner]
            provider = "bedrock"
            model = "anthropic.claude-3-5-sonnet-20240620-v1:0"

            [llm.generator]
            provider = "bedrock"
            model = "anthropic.claude-3-5-sonnet-20240620-v1:0"

            [llm.actor]
            provider = "bedrock"
            model = "anthropic.claude-3-5-sonnet-20240620-v1:0"

            [llm.observer]
            provider = "bedrock"
            model = "anthropic.claude-3-5-sonnet-20240620-v1:0"
            """
        ).strip(),
        encoding="utf-8",
    )

    settings = load_settings(env_file)

    assert settings.models.planner.bedrock.region_name == "ap-northeast-2"
    assert settings.models.planner.bedrock.credentials_profile_name == "default"
    assert (
        settings.models.planner.bedrock.endpoint_url
        == "https://bedrock-runtime.ap-northeast-2.amazonaws.com"
    )


def test_role_table_google_provider_fields_win_over_common_defaults(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text(
        textwrap.dedent(
            """
            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./runtime.sqlite"

            [llm.google]
            project_id = "shared-project"
            location = "us-central1"

            [llm.planner]
            provider = "google"
            model = "gemini-2.5-pro"
            project_id = "planner-project"
            location = "asia-northeast3"

            [llm.generator]
            provider = "google"
            model = "gemini-2.5-flash"

            [llm.actor]
            provider = "google"
            model = "gemini-2.5-flash"

            [llm.observer]
            provider = "google"
            model = "gemini-2.5-flash"
            """
        ).strip(),
        encoding="utf-8",
    )

    settings = load_settings(env_file)

    assert settings.models.planner.google.project_id == "planner-project"
    assert settings.models.planner.google.location == "asia-northeast3"
    assert settings.models.generator.google.project_id == "shared-project"


def test_role_table_reads_ollama_provider_specific_fields(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text(
        textwrap.dedent(
            """
            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./runtime.sqlite"

            [llm.planner]
            provider = "ollama"
            model = "qwen3:8b"
            base_url = "http://127.0.0.1:11435"
            reasoning = true

            [llm.generator]
            provider = "ollama"
            model = "qwen3:8b"
            base_url = "http://127.0.0.1:11435"
            reasoning = false

            [llm.actor]
            provider = "ollama"
            model = "qwen3:8b"
            base_url = "http://127.0.0.1:11435"
            reasoning = "medium"

            [llm.observer]
            provider = "ollama"
            model = "qwen3:8b"
            base_url = "http://127.0.0.1:11435"
            reasoning = "low"
            """
        ).strip(),
        encoding="utf-8",
    )

    settings = load_settings(env_file)

    assert settings.models.planner.base_url == "http://127.0.0.1:11435"
    assert settings.models.planner.reasoning is True
    assert settings.models.actor.reasoning == "medium"


def test_google_vertex_requires_project_and_location(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text(
        textwrap.dedent(
            """
            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./runtime.sqlite"

            [llm.google]
            project_id = "vertex-project"

            [llm.planner]
            provider = "google"
            model = "gemini-2.5-pro"

            [llm.generator]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.openai]
            API_KEY = "x"

            [llm.actor]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.observer]
            provider = "openai"
            model = "gpt-5.4-mini"
            """
        ).strip(),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="project_id와 location"):
        load_settings(env_file)


def test_google_vertex_partial_inputs_fail_even_when_api_key_exists(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text(
        textwrap.dedent(
            """
            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./runtime.sqlite"

            [llm.google]
            API_KEY = "google-key"
            project_id = "vertex-project"

            [llm.planner]
            provider = "google"
            model = "gemini-2.5-pro"

            [llm.generator]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.openai]
            API_KEY = "x"

            [llm.actor]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.observer]
            provider = "openai"
            model = "gpt-5.4-mini"
            """
        ).strip(),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="Vertex AI 경로는 project_id와 location"):
        load_settings(env_file)


def test_bedrock_requires_region_name(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text(
        textwrap.dedent(
            """
            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./runtime.sqlite"

            [llm.planner]
            provider = "bedrock"
            model = "anthropic.claude-3-5-sonnet-20240620-v1:0"

            [llm.generator]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.openai]
            API_KEY = "x"

            [llm.actor]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.observer]
            provider = "openai"
            model = "gpt-5.4-mini"
            """
        ).strip(),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="region_name"):
        load_settings(env_file)


def test_environment_values_override_provider_defaults(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text(
        textwrap.dedent(
            """
            [env]
            enable_checkpointing = true

            [time]
            max_steps = 4

            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./runtime.sqlite"

            [llm.openai]
            API_KEY = "file-key"

            [llm.planner]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.generator]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.actor]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.observer]
            provider = "openai"
            model = "gpt-5.4-mini"
            """
        ).strip(),
        encoding="utf-8",
    )
    monkeypatch.setenv("OPENAI_API_KEY", "env-key")
    monkeypatch.setenv("SIM_MAX_STEPS", "9")

    settings = load_settings(env_file)

    assert settings.models.planner.openai.api_key == "env-key"
    assert settings.runtime.max_steps == 9
    assert settings.runtime.enable_checkpointing is True


def test_load_settings_bundle_returns_settings_without_autofill_metadata(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text(
        textwrap.dedent(
            """
            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./runtime.sqlite"

            [llm.openai]
            API_KEY = "openai-key"

            [llm.planner]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.generator]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.actor]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.observer]
            provider = "openai"
            model = "gpt-5.4-mini"
            """
        ).strip(),
        encoding="utf-8",
    )

    bundle = load_settings_bundle(env_file)

    assert bundle.settings.runtime.max_steps == 16


def test_load_settings_reads_runtime_max_steps_from_time_table(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text(
        textwrap.dedent(
            """
            [time]
            max_steps = 6

            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./runtime.sqlite"

            [llm.openai]
            API_KEY = "openai-key"

            [llm.planner]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.generator]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.actor]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.observer]
            provider = "openai"
            model = "gpt-5.4-mini"
            """
        ).strip(),
        encoding="utf-8",
    )

    bundle = load_settings_bundle(env_file)

    assert bundle.settings.runtime.max_steps == 6


def test_load_settings_rejects_removed_fixed_time_inputs_in_time_table(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text(
        textwrap.dedent(
            """
            [time]
            time_unit = "hour"
            max_steps = 6

            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./runtime.sqlite"

            [llm.openai]
            API_KEY = "openai-key"

            [llm.planner]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.generator]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.actor]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.observer]
            provider = "openai"
            model = "gpt-5.4-mini"
            """
        ).strip(),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="더 이상 지원하지 않습니다"):
        load_settings(env_file)


def test_load_settings_rejects_removed_fixed_time_inputs_from_environment(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text(
        textwrap.dedent(
            """
            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./runtime.sqlite"

            [llm.openai]
            API_KEY = "openai-key"

            [llm.planner]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.generator]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.actor]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.observer]
            provider = "openai"
            model = "gpt-5.4-mini"
            """
        ).strip(),
        encoding="utf-8",
    )
    monkeypatch.setenv("SIM_TIME_STEP_SIZE", "2")

    with pytest.raises(ValueError, match="더 이상 지원하지 않습니다"):
        load_settings(env_file)


def test_load_settings_reads_runtime_rng_seed(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text(
        textwrap.dedent(
            """
            [env]
            rng_seed = 1234

            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./runtime.sqlite"

            [llm.openai]
            API_KEY = "openai-key"

            [llm.planner]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.generator]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.actor]
            provider = "openai"
            model = "gpt-5.4-mini"

            [llm.observer]
            provider = "openai"
            model = "gpt-5.4-mini"
            """
        ).strip(),
        encoding="utf-8",
    )

    settings = load_settings(env_file)

    assert settings.runtime.rng_seed == 1234


def test_resolve_env_file_uses_env_toml_default(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text('[db]\nprovider = "sqlite"\n', encoding="utf-8")
    monkeypatch.chdir(tmp_path)

    resolved = resolve_env_file(None)

    assert resolved is not None
    assert resolved.resolve() == env_file.resolve()


def test_flat_llm_keys_are_rejected(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text(
        textwrap.dedent(
            """
            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./runtime.sqlite"

            [llm]
            api_key = "x"
            """
        ).strip(),
        encoding="utf-8",
    )

    with pytest.raises(ValueError):
        load_settings(env_file)


def test_inactive_common_provider_options_do_not_break_other_roles(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text(
        textwrap.dedent(
            """
            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./runtime.sqlite"

            [llm.openai]
            API_KEY = "openai-key"
            reasoning_effort = "none"
            verbosity = "medium"

            [llm.ollama]
            base_url = "http://127.0.0.1:11434"

            [llm.planner]
            provider = "ollama"
            model = "qwen3:8b"

            [llm.generator]
            provider = "ollama"
            model = "qwen3:8b"

            [llm.actor]
            provider = "ollama"
            model = "qwen3:8b"

            [llm.observer]
            provider = "ollama"
            model = "qwen3:8b"
            """
        ).strip(),
        encoding="utf-8",
    )

    settings = load_settings(env_file)

    assert settings.models.planner.provider == "ollama"
    assert settings.models.planner.openai.reasoning_effort is None


def test_nested_role_provider_table_is_rejected_for_provider_specific_override(
    tmp_path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = tmp_path / "env.toml"
    env_file.write_text(
        textwrap.dedent(
            """
            [db]
            provider = "sqlite"

            [db.sqlite]
            path = "./runtime.sqlite"

            [llm.ollama]
            base_url = "http://127.0.0.1:11434"

            [llm.planner]
            provider = "ollama"
            model = "qwen3:8b"

            [llm.planner.openai]
            reasoning_effort = "medium"

            [llm.generator]
            provider = "ollama"
            model = "qwen3:8b"

            [llm.actor]
            provider = "ollama"
            model = "qwen3:8b"

            [llm.observer]
            provider = "ollama"
            model = "qwen3:8b"
            """
        ).strip(),
        encoding="utf-8",
    )

    with pytest.raises(
        ValueError,
        match=r"\[llm\.planner\.openai\] 문법은 더 이상 지원하지 않습니다",
    ):
        load_settings(env_file)
