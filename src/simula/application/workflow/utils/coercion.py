"""목적:
- 워크플로 공용 형변환 helper를 제공한다.

설명:
- graph node에서 자주 쓰는 단순 list coercion을 한곳에 둔다.

사용한 설계 패턴:
- shared utility 패턴
"""

from __future__ import annotations

from typing import cast


def as_dict_list(value: object) -> list[dict[str, object]]:
    """dict list 형태로 안전하게 강제한다."""

    if not isinstance(value, list):
        return []
    return [cast(dict[str, object], item) for item in value if isinstance(item, dict)]


def as_string_list(value: object) -> list[str]:
    """string list 형태로 안전하게 강제한다."""

    if not isinstance(value, list):
        return []
    return [str(item) for item in value]
