"""목적:
- 서드파티 라이브러리의 알려진 upstream 경고를 필터링한다.

설명:
- 현재 프로젝트 동작과 직접 무관한 경고만 정확히 걸러낸다.
- 필터 범위를 최소화해 실제 애플리케이션 경고는 그대로 노출한다.

사용한 설계 패턴:
- 중앙집중 경고 필터 패턴

연관된 다른 모듈/구조:
- simula.__init__
"""

from __future__ import annotations

import warnings


def configure_warning_filters() -> None:
    """알려진 upstream 경고만 제한적으로 숨긴다."""

    warnings.filterwarnings(
        "ignore",
        message=r"'_UnionGenericAlias' is deprecated and slated for removal in Python 3\.17",
        category=DeprecationWarning,
        module=r"google\.genai\.types",
    )
