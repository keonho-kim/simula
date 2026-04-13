"""목적:
- 현재 지원되는 설정 계약의 핵심 로딩 경로만 검증한다.
"""

from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

from simula.infrastructure.config.loader import load_settings, load_settings_bundle


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


def _write_env_file(tmp_path: Path, body: str) -> Path:
    env_file = tmp_path / "env.toml"
    env_file.write_text(textwrap.dedent(body).strip(), encoding="utf-8")
    return env_file


def test_load_settings_reads_openai_defaults_and_role_override(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = _write_env_file(
        tmp_path,
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

        [llm.fixer]
        provider = "openai"
        model = "gpt-5.4-mini"
        """,
    )

    settings = load_settings(env_file)

    assert settings.models.planner.openai.api_key == "openai-key"
    assert settings.models.planner.verbosity == "low"
    assert settings.models.generator.verbosity == "medium"


def test_load_settings_reads_google_vertex_role_config(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = _write_env_file(
        tmp_path,
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

        [llm.fixer]
        provider = "google"
        model = "gemini-2.5-flash"
        project_id = "fixer-project"
        location = "us-central1"
        """,
    )

    settings = load_settings(env_file)

    assert settings.models.planner.google.project_id == "planner-project"
    assert settings.models.planner.google.location == "us-central1"
    assert settings.models.planner.google.credentials_path == "/tmp/google-credentials.json"


def test_load_settings_rejects_partial_google_vertex_config(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = _write_env_file(
        tmp_path,
        """
        [db]
        provider = "sqlite"

        [db.sqlite]
        path = "./runtime.sqlite"

        [llm.planner]
        provider = "google"
        model = "gemini-2.5-pro"
        project_id = "planner-project"

        [llm.generator]
        provider = "openai"
        model = "gpt-5.4-mini"

        [llm.actor]
        provider = "openai"
        model = "gpt-5.4-mini"

        [llm.observer]
        provider = "openai"
        model = "gpt-5.4-mini"

        [llm.fixer]
        provider = "openai"
        model = "gpt-5.4-mini"

        [llm.openai]
        API_KEY = "openai-key"
        """,
    )

    with pytest.raises(ValueError, match="project_id와 location"):
        load_settings(env_file)


def test_load_settings_reads_bedrock_defaults(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = _write_env_file(
        tmp_path,
        """
        [db]
        provider = "sqlite"

        [db.sqlite]
        path = "./runtime.sqlite"

        [llm.bedrock]
        region_name = "ap-northeast-2"

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

        [llm.fixer]
        provider = "bedrock"
        model = "anthropic.claude-3-5-sonnet-20240620-v1:0"
        """,
    )

    settings = load_settings(env_file)

    assert settings.models.planner.bedrock.region_name == "ap-northeast-2"


def test_load_settings_environment_overrides_file_values(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = _write_env_file(
        tmp_path,
        """
        [time]
        max_rounds = 4

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

        [llm.fixer]
        provider = "openai"
        model = "gpt-5.4-mini"
        """,
    )
    monkeypatch.setenv("OPENAI_API_KEY", "env-key")
    monkeypatch.setenv("SIM_MAX_ROUNDS", "9")

    settings = load_settings(env_file)

    assert settings.models.planner.openai.api_key == "env-key"
    assert settings.runtime.max_rounds == 9


def test_load_settings_reads_runtime_max_rounds_from_time_table(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = _write_env_file(
        tmp_path,
        """
        [time]
        max_rounds = 6

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

        [llm.fixer]
        provider = "openai"
        model = "gpt-5.4-mini"
        """,
    )

    assert load_settings_bundle(env_file).settings.runtime.max_rounds == 6


def test_load_settings_rejects_nested_role_provider_table(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = _write_env_file(
        tmp_path,
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

        [llm.planner.openai]
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

        [llm.fixer]
        provider = "openai"
        model = "gpt-5.4-mini"
        """,
    )

    with pytest.raises(ValueError, match=r"\[llm\.planner\.openai\]"):
        load_settings(env_file)


def test_load_settings_rejects_unexpected_time_keys(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    _clear_known_env(monkeypatch)
    env_file = _write_env_file(
        tmp_path,
        """
        [time]
        unexpected = "value"

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

        [llm.fixer]
        provider = "openai"
        model = "gpt-5.4-mini"
        """,
    )

    with pytest.raises(ValueError, match=r"\[time\]에는 `max_rounds`만"):
        load_settings(env_file)


def test_env_sample_can_be_loaded_after_placeholder_replacement(tmp_path: Path) -> None:
    example_path = Path("env.sample.toml")
    content = example_path.read_text(encoding="utf-8").replace(
        "<put-your-api-key-here>",
        "test-key",
    )
    env_file = tmp_path / "env.toml"
    env_file.write_text(content, encoding="utf-8")

    settings = load_settings(env_file)

    assert settings.models.planner.provider == "openai"
    assert settings.models.actor.provider == "ollama"
    assert settings.models.fixer.provider == "openai"
