"""목적:
- CLI 인자에서 시나리오 텍스트와 라벨을 읽는다.

설명:
- 시나리오 파일 입력과 인라인 텍스트 입력 규칙을 공통 함수로 분리한다.

사용한 설계 패턴:
- input adapter helper 패턴

연관된 다른 모듈/구조:
- simula.entrypoints.bootstrap
"""

from __future__ import annotations

import argparse
from pathlib import Path


def read_scenario_text(args: argparse.Namespace) -> str:
    """CLI 인자에서 시나리오 텍스트를 읽는다."""

    if args.scenario_text:
        return args.scenario_text.strip()

    if args.scenario_file:
        scenario_path = Path(args.scenario_file)
        return scenario_path.read_text(encoding="utf-8").strip()

    raise ValueError("시나리오 입력이 비어 있습니다.")
