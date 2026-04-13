"""목적:
- raw router와 async structured service가 역할별 호출을 올바르게 수행하는지 검증한다.

설명:
- 실제 provider 없이 fake model로 응답 병합, meta 수집, fixer fallback을 확인한다.

사용한 설계 패턴:
- llm service 단위 테스트 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.llm.router
- simula.infrastructure.llm.service
"""

from __future__ import annotations

import asyncio
import logging

import pytest

from simula.domain.contracts import PlanningAnalysis, ScenarioTimeScope
from simula.infrastructure.llm.fixer import _build_fix_json_prompt
from simula.infrastructure.llm.output_parsers import build_output_parser
from simula.infrastructure.llm.router import StructuredLLMRouter
from simula.infrastructure.llm.service import AsyncStructuredLLMService
from simula.infrastructure.llm.usage import LLMUsageTracker


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


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
    def __init__(self, content: str | list[str]) -> None:
        self._contents = [content] if isinstance(content, str) else list(content)
        self._index = 0
        self.prompts: list[str] = []
        self.invoke_called = False
        self.ainvoke_called = False
        self.stream_called = False
        self.astream_called = False

    def _next_content(self) -> str:
        index = min(self._index, len(self._contents) - 1)
        self._index += 1
        return self._contents[index]

    def invoke(self, prompt: str):  # noqa: ANN001
        self.prompts.append(prompt)
        self.invoke_called = True
        return FakeChunk(self._next_content())

    async def ainvoke(self, prompt: str):  # noqa: ANN001
        self.prompts.append(prompt)
        self.ainvoke_called = True
        return FakeChunk(self._next_content())

    def stream(self, prompt: str):  # noqa: ANN001
        self.prompts.append(prompt)
        self.stream_called = True
        yield FakeChunk(self._next_content())

    async def astream(self, prompt: str):  # noqa: ANN001
        self.prompts.append(prompt)
        self.astream_called = True
        yield FakeChunk(self._next_content())


def _build_router(
    model: FakeModel,
    *,
    fixer_model: FakeModel | None = None,
) -> StructuredLLMRouter:
    logger = logging.getLogger("simula.test.llm_router")
    logger.setLevel(logging.DEBUG)
    return StructuredLLMRouter(
        logger=logger,
        planner=model,  # type: ignore[arg-type]
        generator=model,  # type: ignore[arg-type]
        coordinator=model,  # type: ignore[arg-type]
        actor=model,  # type: ignore[arg-type]
        observer=model,  # type: ignore[arg-type]
        fixer=fixer_model or model,  # type: ignore[arg-type]
        usage_tracker=LLMUsageTracker(),
    )


def _build_service(
    model: FakeModel,
    *,
    fixer_model: FakeModel | None = None,
) -> AsyncStructuredLLMService:
    return AsyncStructuredLLMService(
        _build_router(model, fixer_model=fixer_model),
    )


def _time_scope_json() -> str:
    return '{"start":"초기 대면 직후","end":"핵심 선택 직전"}'


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


@pytest.mark.anyio
async def test_service_uses_astream_for_structured_calls(caplog) -> None:
    model = FakeModel(_time_scope_json())
    service = _build_service(model)

    with caplog.at_level(logging.INFO, logger="simula.test.llm_router"):
        result, meta = await service.ainvoke_structured_with_meta(
            "planner",
            "prompt",
            ScenarioTimeScope,
        )
    assert result.start == "초기 대면 직후"
    assert meta.ttft_seconds is not None
    assert model.astream_called is True
    assert model.ainvoke_called is False
    assert "planner 호출 시작" in caplog.text
    assert "planner 완료" in caplog.text
    assert service.router.usage_tracker.snapshot()["structured_calls"] == 1


@pytest.mark.anyio
async def test_service_logs_structured_call_start_once(caplog) -> None:
    model = FakeModel(_time_scope_json())
    service = _build_service(model)

    with caplog.at_level(logging.INFO, logger="simula.test.llm_router"):
        await service.ainvoke_structured_with_meta(
            "planner",
            "prompt",
            ScenarioTimeScope,
            log_context={
                "scope": "planning-analysis",
                "round_index": 2,
                "slot_index": 1,
            },
        )

    assert caplog.text.count("planner · 계획 분석 정리 시작") == 1
    assert "planner · 계획 분석 정리 시작 | round_index=2 slot_index=1" in caplog.text
    assert "planner · 계획 분석 정리 완료" in caplog.text


@pytest.mark.anyio
async def test_service_logs_pretty_payload_only_at_debug(caplog) -> None:
    model = FakeModel(_time_scope_json())
    service = _build_service(model)

    with caplog.at_level(logging.DEBUG, logger="simula.test.llm_router"):
        await service.ainvoke_structured_with_meta(
            "planner",
            "prompt",
            ScenarioTimeScope,
        )
    assert "초기 대면 직후" in caplog.text
    assert "핵심 선택 직전" in caplog.text


@pytest.mark.anyio
async def test_service_warns_when_default_payload_is_used(caplog, monkeypatch) -> None:
    model = FakeModel("not json")
    fixer_model = FakeModel(["still bad", "still bad", "still bad", "still bad"])
    service = _build_service(model, fixer_model=fixer_model)
    sleep_calls: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        sleep_calls.append(seconds)

    monkeypatch.setattr(asyncio, "sleep", fake_sleep)

    with caplog.at_level(logging.WARNING, logger="simula.test.llm_router"):
        parsed, meta = await service.ainvoke_structured_with_meta(
            "planner",
            "prompt",
            ScenarioTimeScope,
            allow_default_on_failure=True,
            default_payload={"start": "기본 시작", "end": "기본 종료"},
        )
    assert parsed.start == "기본 시작"
    assert meta.forced_default is True
    assert "기본값으로 강등합니다" in caplog.text
    assert sleep_calls == [0.25, 0.5, 0.75]


@pytest.mark.anyio
async def test_service_uses_fixer_after_structured_parse_failure() -> None:
    model = FakeModel(["not json", "still not json"])
    fixer_model = FakeModel(_time_scope_json())
    service = _build_service(model, fixer_model=fixer_model)

    result, meta = await service.ainvoke_structured_with_meta(
        "planner",
        "prompt",
        ScenarioTimeScope,
    )
    assert result.start == "초기 대면 직후"
    assert meta.forced_default is False
    assert meta.parse_failure_count == 2
    assert fixer_model.astream_called is True


@pytest.mark.anyio
async def test_service_retries_fixer_until_it_returns_valid_json(monkeypatch) -> None:
    model = FakeModel(["not json", "still not json"])
    fixer_model = FakeModel(["broken", "broken again", _time_scope_json()])
    service = _build_service(model, fixer_model=fixer_model)
    sleep_calls: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        sleep_calls.append(seconds)

    monkeypatch.setattr(asyncio, "sleep", fake_sleep)

    result, meta = await service.ainvoke_structured_with_meta(
        "planner",
        "prompt",
        ScenarioTimeScope,
    )
    assert result.end == "핵심 선택 직전"
    assert meta.parse_failure_count == 4
    assert sleep_calls == [0.25, 0.5]


@pytest.mark.anyio
async def test_service_uses_fixer_after_semantic_validation_failure() -> None:
    model = FakeModel(
        '{"start":"같은 시점","end":"같은 시점"}'
    )
    fixer_model = FakeModel(_time_scope_json())
    service = _build_service(model, fixer_model=fixer_model)

    result, meta = await service.ainvoke_structured_with_meta(
        "planner",
        "prompt",
        ScenarioTimeScope,
        semantic_validator=lambda parsed: (
            ["start and end must differ."] if parsed.start == parsed.end else []
        ),
        repair_context={"rule": "start and end must differ"},
    )

    assert result.start == "초기 대면 직후"
    assert meta.forced_default is False
    assert meta.parse_failure_count == 2
    assert fixer_model.astream_called is True


def test_fixer_prompt_includes_compact_schema_summary() -> None:
    parser = build_output_parser(PlanningAnalysis)

    prompt = _build_fix_json_prompt(
        parser=parser,
        failed_content="not json",
    )

    assert "Target schema: PlanningAnalysis" in prompt
    assert "progression_plan.allowed_elapsed_units: array[enum[minute, hour, day, week]]" in prompt
    assert "progression_plan.selection_reason: string (required)" in prompt
    assert "allowed_elapsed_units values must be unique." in prompt


@pytest.mark.anyio
async def test_service_logs_primary_parse_failure_with_full_response(caplog) -> None:
    model = FakeModel(["bad raw response", "still invalid full response"])
    fixer_model = FakeModel(_time_scope_json())
    service = _build_service(model, fixer_model=fixer_model)

    with caplog.at_level(logging.DEBUG, logger="simula.test.llm_router"):
        await service.ainvoke_structured_with_meta(
            "planner",
            "prompt",
            ScenarioTimeScope,
        )

    assert "planner primary structured parse failed" in caplog.text
    assert "full_response:\nstill invalid full response" in caplog.text
    assert "parse_error: JSON 파싱 실패" in caplog.text
