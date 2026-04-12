"""목적:
- `env.sample.toml`이 새 설정 계약으로 파싱 가능한지 검증한다.

설명:
- placeholder API key를 실제 문자열로 바꾼 뒤 `load_settings()`가 성공하는지 확인한다.

사용한 설계 패턴:
- 예시 파일 회귀 테스트 패턴

연관된 다른 모듈/구조:
- env.sample.toml
- simula.infrastructure.config.loader
"""

from __future__ import annotations

from pathlib import Path

from simula.infrastructure.config.loader import load_settings


def test_env_example_can_be_loaded_after_placeholder_replacement(tmp_path) -> None:
    example_path = Path("env.sample.toml")
    content = example_path.read_text(encoding="utf-8").replace(
        "<put-your-api-key-here>",
        "test-key",
    )
    env_file = tmp_path / "env.toml"
    env_file.write_text(content, encoding="utf-8")

    settings = load_settings(env_file)

    assert settings.models.planner.provider == "openai"
    assert settings.models.planner.openai.api_key == "test-key"
    assert settings.models.actor.provider == "ollama"
