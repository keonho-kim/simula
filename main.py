"""목적:
- 루트 CLI 진입점을 제공한다.

설명:
- 실제 실행 로직은 패키지 내부 `simula.entrypoints.cli` 로 위임한다.

사용한 설계 패턴:
- 얇은 엔트리포인트 패턴

연관된 다른 모듈/구조:
- simula.entrypoints.cli
"""

from __future__ import annotations

from simula.entrypoints.cli import main


if __name__ == "__main__":
    raise SystemExit(main())
