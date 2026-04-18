"""목적:
- LLM 응답 content를 공통 규칙으로 문자열화한다.
"""

from __future__ import annotations

from typing import Any


def content_to_text(content: Any) -> str:
    """LangChain content payload를 문자열로 정규화한다."""

    if isinstance(content, str):
        return content

    if isinstance(content, list):
        chunks: list[str] = []
        for item in content:
            if isinstance(item, str):
                chunks.append(item)
            elif isinstance(item, dict):
                text = item.get("text")
                if isinstance(text, str):
                    chunks.append(text)
        return "\n".join(chunks)

    return str(content)
