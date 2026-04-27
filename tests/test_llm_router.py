"""목적:
- raw router와 async structured service가 역할별 호출을 올바르게 수행하는지 검증한다.

설명:
- 실제 provider 없이 fake model로 응답 병합, meta 수집, fixer fallback을 확인한다.

사용한 설계 패턴:
- llm service 단위 테스트 패턴

연관된 다른 모듈/구조:
- simula.infrastructure.llm.runtime.router
- simula.infrastructure.llm.runtime.service
"""

from __future__ import annotations

import asyncio
import logging

import pytest

from simula.shared.logging.llm import build_llm_log_context
from simula.domain.contracts import (
    MajorEventPlanItem,
    ScenarioTimeScope,
)
from simula.infrastructure.config.models import ModelConfig
from simula.infrastructure.llm.runtime import (
    AsyncStructuredLLMService,
    StructuredLLMRouter,
)
from simula.infrastructure.llm.runtime.logging import log_primary_parse_failure
from simula.infrastructure.llm.renderers import render_text_response
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


class FakeUsageTailChunk(FakeChunk):
    def __init__(self, content: str, usage_metadata: dict[str, int] | None) -> None:
        super().__init__(content)
        self.usage_metadata = usage_metadata

    def __add__(self, other: object) -> "FakeUsageTailChunk":
        if not isinstance(other, FakeUsageTailChunk):
            raise TypeError("unexpected chunk type")
        merged = FakeUsageTailChunk(self.content + other.content, other.usage_metadata)
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


class FakeStreamingUsageModel(FakeModel):
    async def astream(self, prompt: str):  # noqa: ANN001
        self.prompts.append(prompt)
        self.astream_called = True
        yield FakeUsageTailChunk('["alpha"', None)
        yield FakeUsageTailChunk(
            ',"beta"]',
            {
                "input_tokens": 11,
                "output_tokens": 7,
                "total_tokens": 18,
            },
        )


def _config(
    *,
    provider: str = "openai-compatible",
) -> ModelConfig:
    return ModelConfig(
        provider=provider,  # type: ignore[arg-type]
        model="dummy",
    )


def _build_router(
    model: FakeModel,
    *,
    fixer_model: FakeModel | None = None,
    planner_config: ModelConfig | None = None,
) -> StructuredLLMRouter:
    logger = logging.getLogger("simula.test.llm_router")
    logger.setLevel(logging.DEBUG)
    return StructuredLLMRouter(
        logger=logger,
        planner_config=planner_config or _config(),
        generator_config=_config(),
        coordinator_config=_config(),
        observer_config=_config(),
        fixer_config=_config(provider="openai"),
        planner=model,  # type: ignore[arg-type]
        generator=model,  # type: ignore[arg-type]
        coordinator=model,  # type: ignore[arg-type]
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
        _build_router(
            model,
            fixer_model=fixer_model,
        ),
    )


def _time_scope_json() -> str:
    return '{"start":"초기 대면 직후","end":"핵심 선택 직전"}'


def test_router_raw_text_call_uses_stream_and_emits_event() -> None:
    model = FakeModel(
        '{"cast_id":"a","display_name":"A","role_hint":"r","group_name":"g","core_tension":"t"}'
    )
    router = _build_router(model)
    events: list[dict[str, object]] = []
    router.configure_run_logging(
        run_id="20260414.1",
        stream_event_sink=events.append,
    )
    log_context = build_llm_log_context(
        scope="execution-plan",
        phase="planning",
        task_key="execution_plan",
        task_label="실행 계획 정리",
        artifact_key="plan",
        artifact_label="plan",
    )

    result, meta = router.invoke_text_with_meta(
        "planner",
        "prompt",
        log_context=log_context,
    )

    assert result.startswith('{"cast_id":"a"')
    assert meta.ttft_seconds is not None
    assert model.stream_called is True
    assert len(events) == 1
    assert events[0]["event"] == "llm_call"
    assert events[0]["event_key"] == "llm_call:1"
    assert events[0]["run_id"] == "20260414.1"
    assert events[0]["sequence"] == 1
    assert events[0]["role"] == "planner"
    assert events[0]["call_kind"] == "text"
    assert events[0]["log_context"] == log_context
    assert events[0]["prompt"] == "prompt"
    assert events[0]["raw_response"] == (
        '{"cast_id":"a","display_name":"A","role_hint":"r","group_name":"g","core_tension":"t"}'
    )
    assert events[0]["duration_seconds"] == pytest.approx(
        float(events[0]["duration_seconds"])
    )
    assert events[0]["ttft_seconds"] == pytest.approx(float(events[0]["ttft_seconds"]))
    assert events[0]["input_tokens"] == 10
    assert events[0]["output_tokens"] == 20
    assert events[0]["total_tokens"] == 30
    assert router.usage_tracker.snapshot()["calls_by_task"] == {
        "planner.execution_plan": 1
    }


def test_router_success_logs_stay_hidden_at_info_level(caplog) -> None:
    model = FakeModel('{"hello":"world"}')
    router = _build_router(model)

    with caplog.at_level(logging.INFO, logger="simula.test.llm_router"):
        result, meta = router.invoke_text_with_meta(
            "planner",
            "prompt",
            log_context=build_llm_log_context(
                scope="execution-plan",
                phase="planning",
                task_key="execution_plan",
                task_label="실행 계획 정리",
                artifact_key="plan",
                artifact_label="plan",
            ),
        )

    assert result == '{"hello":"world"}'
    assert meta.duration_seconds >= 0
    assert caplog.records == []


def test_parse_failure_debug_keeps_full_response(caplog) -> None:
    logger = logging.getLogger("simula.test.llm_router")
    with caplog.at_level(logging.DEBUG, logger="simula.test.llm_router"):
        log_primary_parse_failure(
            logger=logger,
            role="actor",
            last_error=ValueError("bad payload"),
            last_content='{"action_type":"investor_negotiation","target_cast_ids":[]}',
            log_context={"scope": "actor-turn", "round_index": 2, "cast_id": "ceo-founder"},
        )

    assert any("full_response:" in record.message for record in caplog.records)
    assert any('"target_cast_ids":[]' in record.message for record in caplog.records)


def test_render_text_response_keeps_full_debug_body() -> None:
    long_text = "\n".join(f"line-{index}" for index in range(1, 40))

    rendered = render_text_response(
        role="planner",
        content=long_text,
        log_context={"scope": "interpretation-core"},
    )

    assert "line-1" in rendered
    assert "line-39" in rendered


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
        parsed, meta = await service.ainvoke_object_with_meta(
            "planner",
            "prompt",
            ScenarioTimeScope,
            failure_policy="default",
            default_payload={"start": "기본 시작", "end": "기본 종료"},
        )
    assert parsed.start == "기본 시작"
    assert meta.forced_default is True
    assert sleep_calls == []


@pytest.mark.anyio
async def test_service_uses_fixer_after_structured_parse_failure() -> None:
    model = FakeModel("not json")
    fixer_model = FakeModel(_time_scope_json())
    service = _build_service(model, fixer_model=fixer_model)

    result, meta = await service.ainvoke_object_with_meta(
        "planner",
        "prompt",
        ScenarioTimeScope,
        log_context=build_llm_log_context(
            scope="planning-analysis",
            phase="planning",
            task_key="planning_analysis",
            task_label="계획 분석",
            artifact_key="planning_analysis",
            artifact_label="planning_analysis",
            schema=ScenarioTimeScope,
        ),
    )
    assert result.start == "초기 대면 직후"
    assert meta.forced_default is False
    assert meta.parse_failure_count == 1
    assert fixer_model.astream_called is True
    assert model.prompts[0] == "prompt"
    assert meta.retry_route == "fixer_repair"
    assert meta.retry_stage == "fixer_repair"


@pytest.mark.anyio
async def test_service_uses_fixer_after_semantic_validation_failure() -> None:
    model = FakeModel('{"start":"같은 시점","end":"같은 시점"}')
    fixer_model = FakeModel(_time_scope_json())
    service = _build_service(model, fixer_model=fixer_model)

    result, meta = await service.ainvoke_object_with_meta(
        "planner",
        "prompt",
        ScenarioTimeScope,
        log_context=build_llm_log_context(
            scope="planning-analysis",
            phase="planning",
            task_key="planning_analysis",
            task_label="계획 분석",
            artifact_key="planning_analysis",
            artifact_label="planning_analysis",
            schema=ScenarioTimeScope,
        ),
        semantic_validator=lambda parsed: (
            ["start and end must differ."] if parsed.start == parsed.end else []
        ),
        repair_context={"rule": "start and end must differ"},
    )

    assert result.start == "초기 대면 직후"
    assert meta.forced_default is False
    assert meta.parse_failure_count == 1
    assert fixer_model.astream_called is True


@pytest.mark.anyio
async def test_service_collects_stream_usage_from_final_stream_chunk() -> None:
    model = FakeStreamingUsageModel('{"ignored":true}')
    service = _build_service(model)

    result, meta = await service.ainvoke_simple_with_meta(
        "planner",
        "prompt",
        list[str],
    )

    assert result == ["alpha", "beta"]
    assert meta.ttft_seconds is not None
    assert meta.duration_seconds >= 0
    assert meta.input_tokens == 11
    assert meta.output_tokens == 7
    assert meta.total_tokens == 18


@pytest.mark.anyio
async def test_default_failure_policy_skips_fixer() -> None:
    model = FakeModel("not json")
    fixer_model = FakeModel(["still bad", "still bad", "still bad", "still bad"])
    service = _build_service(model, fixer_model=fixer_model)

    parsed, meta = await service.ainvoke_object_with_meta(
        "planner",
        "prompt",
        ScenarioTimeScope,
        default_payload={"start": "기본 시작", "end": "기본 종료"},
        failure_policy="default",
    )

    assert parsed.start == "기본 시작"
    assert meta.forced_default is True
    assert meta.fixer_used is False
    assert fixer_model.astream_called is False


@pytest.mark.anyio
async def test_simple_missing_required_field_uses_regen_retry(caplog) -> None:
    model = FakeModel(
        [
            '[{"event_id":"press_leak","title":"압박","summary":"요약","participant_cast_ids":["alpha"],"earliest_round":1,"latest_round":2,"completion_action_types":["speech"],"completion_signals":["정리됨"]}]',
            '[{"event_id":"press_leak","title":"압박","summary":"요약","participant_cast_ids":["alpha"],"earliest_round":1,"latest_round":2,"completion_action_types":["speech"],"completion_signals":["정리됨"],"must_resolve":true}]',
        ]
    )
    fixer_model = FakeModel("[]")
    service = _build_service(model, fixer_model=fixer_model)

    with caplog.at_level(logging.INFO, logger="simula.test.llm_router"):
        result, meta = await service.ainvoke_simple_with_meta(
            "planner",
            "prompt",
            list[MajorEventPlanItem],
            failure_policy="fixer",
        )

    assert len(result) == 1
    assert result[0].must_resolve is True
    assert len(model.prompts) == 2
    assert "Missing required fields: [0].must_resolve." in model.prompts[1]
    assert meta.parse_failure_count == 1
    assert meta.retry_route == "regen_retry"
    assert meta.retry_stage == "transport_regen"
    assert meta.missing_field_paths == ["[0].must_resolve"]
    assert fixer_model.astream_called is False
    assert any("structured RETRY 시작" in record.message for record in caplog.records)


@pytest.mark.anyio
async def test_simple_parse_failure_uses_fixer_route() -> None:
    model = FakeModel("not json")
    fixer_model = FakeModel('["alpha","beta"]')
    service = _build_service(model, fixer_model=fixer_model)

    result, meta = await service.ainvoke_simple_with_meta(
        "planner",
        "prompt",
        list[str],
        failure_policy="fixer",
    )

    assert result == ["alpha", "beta"]
    assert meta.parse_failure_count == 1
    assert meta.retry_route == "fixer_repair"
    assert meta.retry_stage == "fixer_repair"
    assert fixer_model.astream_called is True


@pytest.mark.anyio
async def test_simple_default_uses_retry_budget_before_fallback() -> None:
    model = FakeModel(
        '[{"event_id":"press_leak","title":"압박","summary":"요약","participant_cast_ids":["alpha"],"earliest_round":1,"latest_round":2,"completion_action_types":["speech"],"completion_signals":["정리됨"]}]'
    )
    fixer_model = FakeModel("[]")
    service = _build_service(model, fixer_model=fixer_model)

    parsed, meta = await service.ainvoke_simple_with_meta(
        "planner",
        "prompt",
        list[MajorEventPlanItem],
        failure_policy="default",
        default_value=[],
    )

    assert parsed == []
    assert meta.forced_default is True
    assert len(model.prompts) == 5
    assert fixer_model.astream_called is False
