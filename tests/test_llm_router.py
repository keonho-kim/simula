"""목적:
- 구조화 LLM router가 Runnable/stream/astream 경로를 올바르게 사용하는지 검증한다.

설명:
- 실제 provider 없이 fake model로 응답 병합, 메타 수집, 로그 출력을 확인한다.

사용한 설계 패턴:
- router 단위 테스트 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.llm.router
"""

from __future__ import annotations

import logging

from simula.domain.contracts import ScenarioTimeScope
from simula.infrastructure.llm.router import StructuredLLMRouter


class FakeChunk:
    def __init__(self, content: str) -> None:
        self.content = content
        self.usage_metadata = {
            "input_tokens": 10,
            "output_tokens": 20,
            "total_tokens": 30,
        }

    def __add__(self, other: object) -> "FakeChunk":
        if not isinstance(other, FakeChunk):
            raise TypeError("unexpected chunk type")
        merged = FakeChunk(self.content + other.content)
        merged.usage_metadata = other.usage_metadata
        return merged


class FakeModel:
    def __init__(self, content: str) -> None:
        self.content = content
        self.invoke_called = False
        self.ainvoke_called = False
        self.stream_called = False
        self.astream_called = False

    def invoke(self, prompt: str):  # noqa: ANN001
        del prompt
        self.invoke_called = True
        return FakeChunk(self.content)

    async def ainvoke(self, prompt: str):  # noqa: ANN001
        del prompt
        self.ainvoke_called = True
        return FakeChunk(self.content)

    def stream(self, prompt: str):  # noqa: ANN001
        del prompt
        self.stream_called = True
        yield FakeChunk(self.content)

    async def astream(self, prompt: str):  # noqa: ANN001
        del prompt
        self.astream_called = True
        yield FakeChunk(self.content)


def _build_router(model: FakeModel) -> StructuredLLMRouter:
    logger = logging.getLogger("simula.test.llm_router")
    logger.setLevel(logging.DEBUG)
    return StructuredLLMRouter(
        logger=logger,
        planner=model,  # type: ignore[arg-type]
        generator=model,  # type: ignore[arg-type]
        coordinator=model,  # type: ignore[arg-type]
        actor=model,  # type: ignore[arg-type]
        observer=model,  # type: ignore[arg-type]
    )


def _time_scope_json() -> str:
    return '{"start":"초기 대면 직후","end":"핵심 선택 직전"}'


def test_router_uses_stream_for_structured_calls(caplog) -> None:
    model = FakeModel(_time_scope_json())
    router = _build_router(model)

    with caplog.at_level(logging.INFO, logger="simula.test.llm_router"):
        result, meta = router.invoke_structured_with_meta(
            "planner",
            "prompt",
            ScenarioTimeScope,
        )

    assert result.start == "초기 대면 직후"
    assert meta.ttft_seconds is not None
    assert model.stream_called is True
    assert model.invoke_called is False
    assert "planner 호출 시작" in caplog.text
    assert "planner 완료" in caplog.text
    assert "초기 대면 직후" not in caplog.text


def test_router_direct_invoke_uses_runnable_sequence() -> None:
    model = FakeModel(_time_scope_json())
    router = _build_router(model)

    result = router.invoke_structured(
        "planner",
        "prompt",
        ScenarioTimeScope,
    )

    assert result.end == "핵심 선택 직전"
    assert model.invoke_called is True
    assert model.stream_called is False


def test_router_logs_structured_call_start_once(caplog) -> None:
    model = FakeModel(_time_scope_json())
    router = _build_router(model)

    with caplog.at_level(logging.INFO, logger="simula.test.llm_router"):
        router.invoke_structured_with_meta(
            "planner",
            "prompt",
            ScenarioTimeScope,
            log_context={
                "scope": "planning-analysis",
                "step_index": 2,
                "slot_index": 1,
            },
        )

    assert caplog.text.count("planner · 계획 분석 정리 시작") == 1
    assert "planner · 계획 분석 정리 시작 | step_index=2 slot_index=1" in caplog.text
    assert "planner · 계획 분석 정리 완료" in caplog.text


def test_router_raw_text_call_uses_stream_and_logs(caplog) -> None:
    model = FakeModel(
        '{"cast_id":"a","display_name":"A","role_hint":"r","group_name":"g","core_tension":"t"}'
    )
    router = _build_router(model)

    with caplog.at_level(logging.INFO, logger="simula.test.llm_router"):
        result, meta = router.invoke_text_with_meta(
            "planner",
            "prompt",
            log_context={"scope": "execution-plan"},
        )

    assert result.startswith('{"cast_id":"a"')
    assert meta.ttft_seconds is not None
    assert model.stream_called is True
    assert "planner · 실행 계획 번들 정리 시작" in caplog.text
    assert "planner · 실행 계획 번들 정리 완료" in caplog.text


def test_router_logs_pretty_payload_only_at_debug(caplog) -> None:
    model = FakeModel(_time_scope_json())
    router = _build_router(model)

    with caplog.at_level(logging.DEBUG, logger="simula.test.llm_router"):
        router.invoke_structured_with_meta(
            "planner",
            "prompt",
            ScenarioTimeScope,
        )

    assert "초기 대면 직후" in caplog.text
    assert "핵심 선택 직전" in caplog.text


def test_router_warns_when_default_payload_is_used(caplog) -> None:
    model = FakeModel("not json")
    router = _build_router(model)

    with caplog.at_level(logging.WARNING, logger="simula.test.llm_router"):
        parsed, meta = router.invoke_structured_with_meta(
            "planner",
            "prompt",
            ScenarioTimeScope,
            allow_default_on_failure=True,
            default_payload={"start": "기본 시작", "end": "기본 종료"},
        )

    assert parsed.start == "기본 시작"
    assert meta.forced_default is True
    assert "기본값으로 강등합니다" in caplog.text
