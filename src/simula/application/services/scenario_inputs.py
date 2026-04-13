"""목적:
- CLI 인자에서 시나리오 본문과 frontmatter 제어값을 읽는다.

설명:
- 시나리오 파일 입력과 인라인 텍스트 입력 규칙을 공통 함수로 분리한다.
- optional YAML frontmatter를 파싱하고 workflow에는 정리된 본문만 넘긴다.

사용한 설계 패턴:
- input adapter helper 패턴

연관된 다른 모듈/구조:
- simula.entrypoints.bootstrap
"""

from __future__ import annotations

import argparse
import re
from dataclasses import dataclass
from pathlib import Path

from simula.domain.scenario_controls import (
    ScenarioControls,
    default_scenario_controls,
)

_FRONTMATTER_PATTERN = re.compile(
    r"\A---[ \t]*\r?\n(?P<frontmatter>.*?)(?:\r?\n)---[ \t]*(?:\r?\n|$)",
    re.DOTALL,
)


@dataclass(frozen=True, slots=True)
class ScenarioInput:
    """Parsed scenario input passed into the application layer."""

    scenario_text: str
    scenario_controls: ScenarioControls


def read_scenario_input(args: argparse.Namespace) -> ScenarioInput:
    """CLI 인자에서 시나리오 본문과 제어값을 읽는다."""

    raw_text = _read_raw_scenario_text(args)
    return parse_scenario_document(raw_text)


def read_scenario_text(args: argparse.Namespace) -> str:
    """CLI 인자에서 정리된 시나리오 본문만 읽는다."""

    return read_scenario_input(args).scenario_text


def parse_scenario_document(text: str) -> ScenarioInput:
    """원시 시나리오 문서를 frontmatter와 본문으로 분리한다."""

    raw_text = text.strip()
    if not raw_text:
        raise ValueError("시나리오 입력이 비어 있습니다.")

    controls = default_scenario_controls()
    body = raw_text
    frontmatter_match = _FRONTMATTER_PATTERN.match(raw_text)
    if frontmatter_match is not None:
        controls = _parse_frontmatter(frontmatter_match.group("frontmatter"))
        body = raw_text[frontmatter_match.end() :].strip()

    if not body:
        raise ValueError("frontmatter를 제거한 뒤 시나리오 본문이 비어 있습니다.")

    return ScenarioInput(
        scenario_text=body,
        scenario_controls=controls,
    )


def _read_raw_scenario_text(args: argparse.Namespace) -> str:
    """CLI 인자에서 원시 시나리오 텍스트를 읽는다."""

    if args.scenario_text:
        return args.scenario_text.strip()

    if args.scenario_file:
        scenario_path = Path(args.scenario_file)
        return scenario_path.read_text(encoding="utf-8").strip()

    raise ValueError("시나리오 입력이 비어 있습니다.")


def _parse_frontmatter(frontmatter: str) -> ScenarioControls:
    controls = default_scenario_controls()
    seen_keys: set[str] = set()

    for raw_line in frontmatter.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            raise ValueError(
                "scenario frontmatter는 `key: value` 형식의 단일 레벨 YAML만 지원합니다."
            )
        key, raw_value = (part.strip() for part in line.split(":", 1))
        if key in seen_keys:
            raise ValueError(f"scenario frontmatter에 중복 키를 허용하지 않습니다: {key}")
        seen_keys.add(key)
        if key != "create_all_participants":
            raise ValueError(f"지원하지 않는 scenario frontmatter 키입니다: {key}")
        lowered = raw_value.lower()
        if lowered not in {"true", "false"}:
            raise ValueError(
                "create_all_participants는 true 또는 false 여야 합니다."
            )
        controls["create_all_participants"] = lowered == "true"

    return controls
