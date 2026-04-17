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
import json
import logging

import pytest

from simula.application.llm_logging import build_llm_log_context
from simula.application.workflow.graphs.runtime.proposal_contract import (
    build_actor_proposal_repair_context,
    validate_actor_action_proposal_semantics,
)
from simula.domain.contracts import ActorActionProposal, ScenarioTimeScope
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
    assert router.usage_tracker.snapshot()["calls_by_task"] == {"planner.execution_plan": 1}


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
    assert any(record.levelno >= logging.WARNING for record in caplog.records)
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
    assert meta.parse_failure_count == 2
    assert fixer_model.astream_called is True


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
    assert meta.parse_failure_count == 2
    assert fixer_model.astream_called is True


@pytest.mark.anyio
async def test_service_passes_actor_target_guidance_to_fixer_prompt() -> None:
    raw_actor_response = json.dumps(
        {
            "action_type": "initial_reaction",
            "intent": "제품의 마케팅 문구보다 성분표 수치를 먼저 확인한다.",
            "intent_target_cast_ids": ["seo_yeon"],
            "action_summary": "성분표를 살피며 혼잣말한다.",
            "action_detail": "당류와 대체 감미료 정보를 확인한다.",
            "utterance": "수치부터 확인해봐야겠어.",
            "visibility": "private",
            "target_cast_ids": ["seo_yeon"],
            "thread_id": "",
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )
    fixed_actor_response = json.dumps(
        {
            "action_type": "initial_reaction",
            "intent": "제품의 마케팅 문구보다 성분표 수치를 먼저 확인한다.",
            "intent_target_cast_ids": [],
            "action_summary": "성분표를 살피며 혼잣말한다.",
            "action_detail": "당류와 대체 감미료 정보를 확인한다.",
            "utterance": "",
            "visibility": "private",
            "target_cast_ids": [],
            "thread_id": "",
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )
    model = FakeModel(raw_actor_response)
    fixer_model = FakeModel(fixed_actor_response)
    service = _build_service(model, fixer_model=fixer_model)

    result, meta = await service.ainvoke_structured_with_meta(
        "actor",
        "prompt",
        ActorActionProposal,
        log_context=build_llm_log_context(
            scope="actor-turn",
            phase="runtime",
            task_key="actor_action_proposal",
            task_label="행동 제안",
            artifact_key="pending_actor_proposals",
            artifact_label="pending_actor_proposals",
            schema=ActorActionProposal,
            cast_id="seo_yeon",
            actor_display_name="서연",
        ),
        semantic_validator=lambda parsed: validate_actor_action_proposal_semantics(
            proposal=parsed,
            cast_id="seo_yeon",
            available_actions=[
                {
                    "action_type": "initial_reaction",
                    "supported_visibility": ["public", "private"],
                    "requires_target": False,
                    "supports_utterance": True,
                }
            ],
            valid_target_cast_ids=[],
            visible_actors=[],
            current_intent_snapshot={},
            max_target_count=1,
        ),
        repair_context=build_actor_proposal_repair_context(
            cast_id="seo_yeon",
            actor_display_name="서연",
            available_actions=[
                {
                    "action_type": "initial_reaction",
                    "supported_visibility": ["public", "private"],
                    "requires_target": False,
                    "supports_utterance": True,
                }
            ],
            valid_target_cast_ids=[],
            visible_actors=[],
            current_intent_target_cast_ids=[],
            recent_visible_actions=[],
            max_target_count=1,
        ),
    )

    assert result.visibility == "private"
    assert result.target_cast_ids == []
    assert result.intent_target_cast_ids == []
    assert meta.forced_default is False
    assert meta.parse_failure_count == 2
    assert fixer_model.astream_called is True
    assert service.router.usage_tracker.snapshot()["calls_by_task"] == {
        "actor.actor_action_proposal": 2,
        "fixer.json_repair.actor.actor_action_proposal": 1,
    }
