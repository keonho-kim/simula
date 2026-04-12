"""목적:
- LangGraph workflow fan-out/reduce 구조가 의도대로 동작하는지 검증한다.

설명:
- 실제 LLM 없이 fake router로 invoke/stream(version="v2") 경로를 확인한다.

사용한 설계 패턴:
- workflow 통합 테스트 패턴

연관된 다른 모듈/구조:
- simula.application.workflow.graphs.simulation.graph
- simula.application.services.executor
"""

from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from types import SimpleNamespace

from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from simula.application.services import executor as executor_module
from simula.application.services.presentation import SavedRunOutputs
from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.simulation.graph import (
    SIMULATION_WORKFLOW_GRAPH,
)
from simula.application.workflow.graphs.simulation.states.initial_state import (
    build_initial_workflow_state,
)
from simula.domain.contracts import (
    ActionCatalog,
    ActorActionProposal,
    ActorCard,
    BackgroundUpdateBatch,
    CastRoster,
    CoordinationFrame,
    ObserverReport,
    RuntimeProgressionPlan,
    ScenarioBrief,
    ScenarioTimeScope,
    StepAdjudication,
    StepFocusPlan,
    StepTimeAdvanceProposal,
    SituationBundle,
    TimelineAnchorDecision,
)
from simula.entrypoints import bootstrap as bootstrap_module
from simula.infrastructure.config.models import (
    AppSettings,
    ModelConfig,
    ModelRouterConfig,
    OpenAIProviderConfig,
    RuntimeConfig,
    StorageConfig,
)
from simula.infrastructure.storage.app_store import SqlAlchemyAppStore
from simula.infrastructure.storage.factory import create_async_checkpointer_context


@dataclass(slots=True)
class FakeMeta:
    parse_failure_count: int = 0
    forced_default: bool = False
    duration_seconds: float = 0.01
    last_content: str = ""
    ttft_seconds: float | None = 0.005
    input_tokens: int | None = 10
    output_tokens: int | None = 20
    total_tokens: int | None = 30


class FakeRouter:
    """그래프 테스트용 fake structured router다."""

    def invoke_structured_with_meta(self, role, prompt, schema, **kwargs):  # noqa: ANN001
        del role, kwargs
        if schema is ScenarioBrief:
            return (
                ScenarioBrief(
                    summary="공개와 비공개 계산이 동시에 움직이는 위기다. 핵심 주체의 초기 선택이 전체 흐름을 좌우하고, 짧은 반응과 긴 조율이 번갈아 나온다. 말과 실제 계산이 달라 후반 종결 지점까지 추적해야 한다.",
                    key_entities=["Alpha", "Beta", "Gamma"],
                    explicit_time_signals=["초기 대면 직후", "종결 직전"],
                    public_facts=["공개 신호가 판세를 흔든다."],
                    private_dynamics=["비공개 계산이 실제 선택을 움직인다."],
                    terminal_conditions=["핵심 갈등이 실제로 정리되는 시점까지 본다."],
                ),
                FakeMeta(),
            )
        if schema is ScenarioTimeScope:
            return (
                ScenarioTimeScope(
                    start="초기 대면 직후",
                    end="핵심 선택 직전",
                ),
                FakeMeta(),
            )

        if schema is RuntimeProgressionPlan:
            return (
                RuntimeProgressionPlan(
                    max_steps=4,
                    allowed_units=["minute", "hour", "day"],
                    default_unit="hour",
                    pacing_guidance=[
                        "짧은 반응은 30분 또는 1시간으로 본다.",
                        "준비와 재배치는 더 긴 점프를 허용한다.",
                    ],
                    selection_reason="짧은 반응과 긴 준비가 섞여 있어 복수 단위가 적절하다.",
                ),
                FakeMeta(),
            )

        if getattr(schema, "__name__", "") == "VisibilityContextBundle":
            return (
                schema(
                    public_context=["겉으로는 신중하다."],
                    private_context=["속으로는 계산이 많다."],
                ),
                FakeMeta(),
            )

        if getattr(schema, "__name__", "") == "PressurePointBundle":
            return (
                schema(
                    key_pressures=["시간 압박", "정보 비대칭"],
                    observation_points=["공개 신호", "비공개 정렬"],
                ),
                FakeMeta(),
            )

        if schema is SituationBundle:
            return (
                SituationBundle(
                    simulation_objective="위기 추적",
                    world_summary="걸프 긴장이 빠르게 높아진다.",
                    initial_tensions=["보복 압박", "중재 요구"],
                    channel_guidance={
                        "public": "공개 브리핑",
                        "private": "비밀 경고",
                        "group": "다자 협의",
                    },
                    current_constraints=["시간이 짧다", "정보가 비대칭적이다"],
                ),
                FakeMeta(),
            )

        if schema is ActionCatalog:
            return (
                ActionCatalog(
                    actions=[
                        {
                            "action_type": "speech",
                            "label": "직접 발화",
                            "description": "직접 말로 방향을 조정한다.",
                            "role_hints": ["선도자", "조정자"],
                            "group_hints": ["A", "B"],
                            "supported_visibility": ["public", "private", "group"],
                            "requires_target": False,
                            "supports_utterance": True,
                            "examples_or_usage_notes": ["짧은 공개 경고"],
                        },
                        {
                            "action_type": "position",
                            "label": "입장 정렬",
                            "description": "공개 입장이나 대응 방향을 재정렬한다.",
                            "role_hints": ["조정자", "관찰자"],
                            "group_hints": ["B", "C"],
                            "supported_visibility": ["public", "private", "group"],
                            "requires_target": False,
                            "supports_utterance": False,
                            "examples_or_usage_notes": ["대응 방향 재정렬"],
                        },
                    ],
                    selection_guidance=[
                        "발화는 액션 중 하나다.",
                        "상황을 실제로 움직이는 action을 우선 본다.",
                    ],
                ),
                FakeMeta(),
            )

        if schema is CoordinationFrame:
            return (
                CoordinationFrame(
                    focus_selection_rules=["직접 압박과 즉시 반응 축을 우선 본다."],
                    background_motion_rules=[
                        "직접 호출하지 않은 actor는 배경 압력만 요약한다."
                    ],
                    focus_archetypes=["직접 충돌", "공개 반응"],
                    attention_shift_rules=[
                        "조용했던 actor도 압력이 높아지면 끌어올린다."
                    ],
                    budget_guidance=["한 step에서는 소수 actor만 직접 추적한다."],
                ),
                FakeMeta(),
            )

        if schema is CastRoster:
            return (
                CastRoster(
                    items=[
                        {
                            "cast_id": "cast-alpha",
                            "display_name": "Alpha",
                            "role_hint": "선도자",
                            "group_name": "A",
                            "core_tension": "속도를 높이고 싶다.",
                        },
                        {
                            "cast_id": "cast-beta",
                            "display_name": "Beta",
                            "role_hint": "조정자",
                            "group_name": "B",
                            "core_tension": "리스크를 줄이고 싶다.",
                        },
                        {
                            "cast_id": "cast-gamma",
                            "display_name": "Gamma",
                            "role_hint": "관찰자",
                            "group_name": "C",
                            "core_tension": "판단을 미루고 싶다.",
                        },
                    ]
                ),
                FakeMeta(),
            )

        if schema is ActorCard:
            cast_match = re.search(r'"cast_id":"([^"]+)"', prompt)
            cast_id = cast_match.group(1) if cast_match else "cast-1"
            display_match = re.search(r'"display_name":"([^"]+)"', prompt)
            display_name = display_match.group(1) if display_match else "Actor 1"
            return (
                ActorCard(
                    cast_id=cast_id,
                    actor_id=cast_id.replace("cast-", "actor-"),
                    display_name=display_name,
                    role=f"{display_name} 역할",
                    group_name="test-group",
                    public_profile=f"{display_name} 공개 성향",
                    private_goal=f"{display_name} 비공개 목표",
                    speaking_style="short",
                    avatar_seed=f"{cast_id}-seed",
                    baseline_attention_tier=(
                        "lead"
                        if "alpha" in cast_id
                        else "driver"
                        if "beta" in cast_id
                        else "support"
                    ),
                    story_function=f"{display_name}는 현재 국면을 드러내는 테스트용 축이다.",
                    preferred_action_types=["speech", "position"],
                    action_bias_notes=[f"{display_name}는 먼저 action 방향을 본다."],
                ),
                FakeMeta(),
            )

        if schema is ActorActionProposal:
            actor_match = re.search(r'"actor_id":"([^"]+)"', prompt)
            actor_id = actor_match.group(1) if actor_match else "actor-1"
            if actor_id == "actor-alpha":
                return (
                    ActorActionProposal(
                        action_type="speech",
                        intent="beta가 즉시 대응하도록 압박한다.",
                        intent_target_actor_ids=["actor-beta"],
                        action_summary="actor-alpha가 경고 action을 보낸다.",
                        action_detail="즉시 대응이 필요하다는 점을 강하게 전달한다.",
                        utterance="즉시 대응하라.",
                        visibility="private",
                        target_actor_ids=["actor-beta"],
                        thread_id="warning",
                    ),
                    FakeMeta(),
                )
            return (
                ActorActionProposal(
                    action_type="position",
                    intent="조금 더 지켜보며 다음 반응 시점을 잡는다.",
                    intent_target_actor_ids=[],
                    action_summary=f"{actor_id}가 일단 상황을 관찰하는 action을 한다.",
                    action_detail="조금 더 지켜보며 움직이기 전에 방향을 정리한다.",
                    utterance=None,
                    visibility="public",
                    target_actor_ids=[],
                    thread_id=None,
                ),
                FakeMeta(),
            )

        if schema is StepFocusPlan:
            return (
                StepFocusPlan(
                    step_index=1,
                    focus_summary="직접 압박과 즉시 반응 축을 먼저 추적한다.",
                    selection_reason="alpha와 beta가 가장 직접적인 충돌 축을 만든다.",
                    selected_actor_ids=["actor-alpha", "actor-beta"],
                    deferred_actor_ids=["actor-gamma"],
                    focus_slices=[
                        {
                            "slice_id": "focus-1",
                            "title": "직접 압박 축",
                            "focus_actor_ids": ["actor-alpha", "actor-beta"],
                            "visibility": "private",
                            "stakes": "즉시 대응 여부가 갈린다.",
                            "selection_reason": "직접 신호가 바로 오간다.",
                        },
                    ],
                ),
                FakeMeta(),
            )

        if schema is BackgroundUpdateBatch:
            return (
                BackgroundUpdateBatch(
                    background_updates=[
                        {
                            "step_index": 1,
                            "actor_id": "actor-gamma",
                            "summary": "gamma는 직접 개입하지 않고 상황을 더 지켜본다.",
                            "pressure_level": "low",
                            "future_hook": "다음 단계에서 반응 축에 늦게 합류할 수 있다.",
                        }
                    ]
                ),
                FakeMeta(),
            )

        if schema is StepAdjudication:
            return (
                StepAdjudication(
                    adopted_actor_ids=["actor-alpha", "actor-beta"],
                    rejected_action_notes=["직접 반영 가치가 낮은 제안은 배제한다."],
                    updated_intent_states=[
                        {
                            "actor_id": "actor-alpha",
                            "current_intent": "beta가 즉시 대응하도록 압박한다.",
                            "target_actor_ids": ["actor-beta"],
                            "supporting_action_type": "speech",
                            "confidence": 0.82,
                            "changed_from_previous": True,
                        },
                        {
                            "actor_id": "actor-beta",
                            "current_intent": "alpha의 경고에 맞춰 대응 방향을 정한다.",
                            "target_actor_ids": ["actor-alpha"],
                            "supporting_action_type": "position",
                            "confidence": 0.73,
                            "changed_from_previous": True,
                        },
                        {
                            "actor_id": "actor-gamma",
                            "current_intent": "상황을 더 지켜본다.",
                            "target_actor_ids": [],
                            "supporting_action_type": "position",
                            "confidence": 0.61,
                            "changed_from_previous": False,
                        },
                    ],
                    step_time_advance=StepTimeAdvanceProposal(
                        elapsed_unit="minute",
                        elapsed_amount=30,
                        selection_reason="첫 단계는 직접 반응과 짧은 재조율이 중심이다.",
                        signals=["직접 반응", "짧은 정리"],
                    ),
                    background_updates=[
                        {
                            "step_index": 1,
                            "actor_id": "actor-gamma",
                            "summary": "gamma는 직접 개입하지 않고 상황을 더 지켜본다.",
                            "pressure_level": "low",
                            "future_hook": "다음 단계에서 반응 축에 늦게 합류할 수 있다.",
                        }
                    ],
                    event_action=None,
                    world_state_summary_hint="직접 충돌 축과 배경 관망이 함께 형성됐다.",
                ),
                FakeMeta(),
            )

        if schema is ObserverReport:
            return (
                ObserverReport(
                    step_index=1,
                    summary="첫 단계에서 발화와 입장 정렬 action이 함께 충돌을 만들었다.",
                    notable_events=["비공개 경고 action", "배경 관망 유지"],
                    atmosphere="긴장",
                    momentum="medium",
                    world_state_summary="직접 충돌보다는 경계와 탐색이 먼저 시작됐다.",
                ),
                FakeMeta(),
            )

        if schema is TimelineAnchorDecision:
            return (
                TimelineAnchorDecision(
                    anchor_iso="2027-06-18T03:20:00",
                    selection_reason="테스트용으로 고정 anchor를 사용한다.",
                ),
                FakeMeta(),
            )

        raise AssertionError(f"unexpected schema: {schema}")

    async def ainvoke_structured_with_meta(
        self,
        role,
        prompt,
        schema,
        **kwargs,  # noqa: ANN001
    ):
        return self.invoke_structured_with_meta(role, prompt, schema, **kwargs)

    def invoke_text_with_meta(self, role, prompt, **kwargs):  # noqa: ANN001
        del kwargs
        if role == "observer":
            section_match = re.search(r"- section title:\n\s*(.+)", prompt)
            section_title = section_match.group(1).strip() if section_match else "섹션"
            if section_title == "시뮬레이션 타임라인":
                return (
                    "- 2027-06-18 03:20 | 시작 단계 | 첫 공개 발언과 비공개 경고가 동시에 시작됐다 | 공개 관망과 비공개 조율이 함께 열렸다.",
                    FakeMeta(),
                )
            if section_title == "행위자 역학 관계":
                return (
                    "### 현재 구도\n"
                    "Alpha가 먼저 경고를 보내며 Beta의 움직임에 가장 직접적인 영향을 주고 있다. Gamma는 관망을 이어가 현재 구도에서는 중심에 서지 못했다.\n\n"
                    "### 관계 변화\n"
                    "처음에는 각자 따로 움직였지만, Alpha의 비공개 경고 뒤에 Beta가 바로 반응하면서 두 사람의 연결이 가장 강해졌다. 반면 Gamma는 거리를 두면서 결과에 미치는 힘이 약해졌다.",
                    FakeMeta(),
                )
            if section_title == "주요 사건과 그 결과":
                return (
                    "- Alpha의 비공개 경고가 나왔고, 그 결과 Beta가 즉시 대응하는 쪽으로 움직였다.\n"
                    "- 공개 관망 메시지가 유지됐고, 그 결과 외형상 충돌 수위는 낮게 보였다.\n"
                    "- observer 사건은 발생하지 않았고, 그 결과 첫 단계 핵심 흐름이 그대로 이어졌다.\n"
                    "- 1단계 종료 시 observer 요약이 남았고, 그 결과 다음 판단 기준이 명확해졌다.",
                    FakeMeta(),
                )
            if section_title == "행위자 별 최종 결과":
                return (
                    "| Alpha | 주도권을 잡았다 | Beta | 우세 | 먼저 경고를 보내 흐름을 열었다. |\n"
                    "| Beta | Alpha의 신호에 맞춰 움직였다 | Alpha | 중립 우세 | 경고를 받은 뒤 대응 방향을 바로 정했다. |\n"
                    "| Gamma | 관망 유지 | 전체 | 열세 | 직접 개입이 적어 판세를 움직이지 못했다. |",
                    FakeMeta(),
                )
            if section_title == "시뮬레이션 결론":
                return (
                    "### 최종 상태\n"
                    "- 최종 결과는 Alpha가 흐름을 먼저 만들고 Beta가 그 신호를 받아 움직이는 구도로 마무리됐다.\n"
                    "- Gamma는 끝까지 관망에 머물러 마지막 결과를 바꾸지 못했다.\n"
                    "### 핵심 이유\n"
                    "- Alpha의 비공개 경고가 가장 먼저 나와 이후 판단 기준이 됐다.\n"
                    "- Beta는 그 경고에 맞춰 바로 반응해 Alpha와의 연결이 가장 뚜렷해졌다.",
                    FakeMeta(),
                )
            return (f"{section_title} 본문을 테스트용으로 작성했다.", FakeMeta())
        if "core premise" in prompt:
            return ("공개와 비공개 계산이 동시에 움직이는 상황이다.", FakeMeta())
        return (
            "\n".join(
                [
                    '{"cast_id":"cast-alpha","display_name":"Alpha","role_hint":"선도자","group_name":"A","core_tension":"속도를 높이고 싶다."}',
                    '{"cast_id":"cast-beta","display_name":"Beta","role_hint":"조정자","group_name":"B","core_tension":"리스크를 줄이고 싶다."}',
                    '{"cast_id":"cast-gamma","display_name":"Gamma","role_hint":"관찰자","group_name":"C","core_tension":"판단을 미루고 싶다."}',
                ]
            ),
            FakeMeta(),
        )

    async def ainvoke_text_with_meta(self, role, prompt, **kwargs):  # noqa: ANN001
        return self.invoke_text_with_meta(role, prompt, **kwargs)


def _build_settings(sqlite_path: str) -> AppSettings:
    return AppSettings(
        runtime=RuntimeConfig(
            max_steps=1,
            enable_checkpointing=False,
        ),
        storage=StorageConfig(sqlite_path=sqlite_path),
        models=ModelRouterConfig(
            planner=ModelConfig(
                provider="openai",
                model="fake",
                openai=OpenAIProviderConfig(api_key="x"),
            ),
            generator=ModelConfig(
                provider="openai",
                model="fake",
                openai=OpenAIProviderConfig(api_key="x"),
            ),
            coordinator=ModelConfig(
                provider="openai",
                model="fake",
                openai=OpenAIProviderConfig(api_key="x"),
            ),
            actor=ModelConfig(
                provider="openai",
                model="fake",
                openai=OpenAIProviderConfig(api_key="x"),
            ),
            observer=ModelConfig(
                provider="openai",
                model="fake",
                openai=OpenAIProviderConfig(api_key="x"),
            ),
        ),
    )


def test_graph_invoke_v2_runs_with_activity_flow(tmp_path) -> None:
    sqlite_path = str(tmp_path / "graph.sqlite")
    checkpoint_path = str(tmp_path / "graph.checkpoints.sqlite")
    settings = _build_settings(sqlite_path)
    store = SqlAlchemyAppStore(
        StorageConfig(provider="sqlite", sqlite_path=sqlite_path)
    )
    router = FakeRouter()
    context = WorkflowRuntimeContext(
        settings=settings,
        store=store,
        llms=router,  # type: ignore[arg-type]
        logger=logging.getLogger("simula.test"),
    )
    app = SIMULATION_WORKFLOW_GRAPH

    try:
        store.save_run_started(
            run_id="run-test",
            scenario_text="테스트 시나리오",
            settings_json={"log_level": "INFO"},
        )

        async def _run_invoke():  # noqa: ANN202
            async with AsyncSqliteSaver.from_conn_string(checkpoint_path) as saver:
                compiled = app.compile(checkpointer=saver)
                return await compiled.ainvoke(
                    build_initial_workflow_state(
                        run_id="run-test",
                        scenario_text="테스트 시나리오",
                        settings=settings,
                    ),
                    context=context,
                    config={"configurable": {"thread_id": "run-test"}},
                    version="v2",
                )

        final_state = asyncio.run(_run_invoke())
    finally:
        store.close()

    state_value = final_state.value if hasattr(final_state, "value") else final_state
    assert len(state_value["plan"]["cast_roster"]) == 3
    assert len(state_value["plan"]["action_catalog"]["actions"]) == 2
    assert len(state_value["actors"]) == 3
    assert len(state_value["activities"]) == 2
    assert len(state_value["background_updates"]) == 1
    assert len(state_value["actor_intent_states"]) == 3
    assert state_value["final_report"]["total_activities"] == 2
    assert state_value["simulation_clock"]["total_elapsed_minutes"] == 30
    assert state_value["final_report_markdown"].startswith("# 시뮬레이션 결과")


def test_graph_stream_v2_emits_final_state(tmp_path) -> None:
    sqlite_path = str(tmp_path / "graph-stream.sqlite")
    checkpoint_path = str(tmp_path / "graph-stream.checkpoints.sqlite")
    settings = _build_settings(sqlite_path)
    store = SqlAlchemyAppStore(
        StorageConfig(provider="sqlite", sqlite_path=sqlite_path)
    )
    router = FakeRouter()
    context = WorkflowRuntimeContext(
        settings=settings,
        store=store,
        llms=router,  # type: ignore[arg-type]
        logger=logging.getLogger("simula.test"),
    )
    app = SIMULATION_WORKFLOW_GRAPH

    try:
        store.save_run_started(
            run_id="run-stream",
            scenario_text="테스트 시나리오",
            settings_json={"log_level": "INFO"},
        )

        async def _run_stream():  # noqa: ANN202
            async with AsyncSqliteSaver.from_conn_string(checkpoint_path) as saver:
                compiled = app.compile(checkpointer=saver)
                return await _collect_astream_chunks(
                    compiled,
                    build_initial_workflow_state(
                        run_id="run-stream",
                        scenario_text="테스트 시나리오",
                        settings=settings,
                    ),
                    context,
                )

        chunks = asyncio.run(_run_stream())
    finally:
        store.close()

    assert chunks
    final_state = None
    for chunk in chunks:
        candidate = _unwrap_chunk_value(chunk)
        if (
            isinstance(candidate, dict)
            and "final_report" in candidate
            and candidate["final_report"] is not None
        ):
            final_state = candidate
            break
        if isinstance(candidate, list):
            for item in candidate:
                unwrapped = _unwrap_chunk_value(item)
                if (
                    isinstance(unwrapped, dict)
                    and "final_report" in unwrapped
                    and unwrapped["final_report"] is not None
                ):
                    final_state = unwrapped
                    break
        if final_state is not None:
            break

    assert final_state is not None
    assert final_state["final_report"]["steps_completed"] == 1


def test_checkpoint_context_is_disabled_by_default(tmp_path) -> None:
    settings = _build_settings(str(tmp_path / "runtime.sqlite"))
    checkpoint_path = Path(str(tmp_path / "runtime.checkpoints.sqlite"))

    async def _run() -> None:
        async with create_async_checkpointer_context(settings) as checkpointer:
            assert checkpointer is None

    asyncio.run(_run())
    assert checkpoint_path.exists() is False


def test_checkpoint_context_creates_sqlite_saver_when_enabled(tmp_path) -> None:
    settings = _build_settings(str(tmp_path / "runtime.sqlite"))
    settings.runtime.enable_checkpointing = True

    async def _run() -> None:
        async with create_async_checkpointer_context(settings) as checkpointer:
            assert checkpointer is not None

    asyncio.run(_run())
    assert Path(str(tmp_path / "runtime.checkpoints.sqlite")).exists()


def test_checkpointed_run_compiles_from_singleton_graph(monkeypatch, tmp_path) -> None:
    settings = _build_settings(str(tmp_path / "runtime.sqlite"))
    compile_calls: list[dict[str, object]] = []

    class FakeStore:
        def next_run_id(self) -> str:
            return "run-checkpoint"

        def save_run_started(self, **kwargs):  # noqa: ANN003
            return None

        def mark_run_status(self, *args, **kwargs):  # noqa: ANN002, ANN003
            return None

        def close(self) -> None:
            return None

    class FakeCompiledWorkflow:
        async def ainvoke(self, *args, **kwargs):  # noqa: ANN002, ANN003
            return {"final_report": {"run_id": "run-checkpoint"}}

    class FakeWorkflowGraph:
        def compile(self, **kwargs):  # noqa: ANN003
            compile_calls.append(dict(kwargs))
            return FakeCompiledWorkflow()

    class FakeAsyncContext:
        async def __aenter__(self):
            return "cp-1"

        async def __aexit__(self, exc_type, exc, tb):  # noqa: ANN001
            return None

    monkeypatch.setattr(
        executor_module, "create_app_store", lambda *args, **kwargs: FakeStore()
    )
    monkeypatch.setattr(
        executor_module,
        "build_model_router",
        lambda settings: SimpleNamespace(),
    )
    monkeypatch.setattr(
        executor_module,
        "build_initial_workflow_state",
        lambda **kwargs: {"run_id": "run-checkpoint"},
    )
    monkeypatch.setattr(
        executor_module,
        "SIMULATION_WORKFLOW_GRAPH",
        FakeWorkflowGraph(),
    )
    monkeypatch.setattr(
        executor_module,
        "SIMULATION_WORKFLOW",
        FakeCompiledWorkflow(),
    )
    monkeypatch.setattr(
        executor_module,
        "create_async_checkpointer_context",
        lambda settings: FakeAsyncContext(),
    )

    executor = executor_module.SimulationExecutor(settings)
    result = asyncio.run(executor.run_async("시나리오"))

    assert result.success is True
    assert compile_calls == [{"checkpointer": "cp-1", "name": "simula"}]


def test_executor_logs_run_start(monkeypatch, caplog, tmp_path) -> None:
    settings = _build_settings(str(tmp_path / "runtime.sqlite"))

    class FakeStore:
        def next_run_id(self) -> str:
            return "run-log"

        def save_run_started(self, **kwargs):  # noqa: ANN003
            return None

        def mark_run_status(self, *args, **kwargs):  # noqa: ANN002, ANN003
            return None

        def close(self) -> None:
            return None

    monkeypatch.setattr(
        executor_module, "create_app_store", lambda *args, **kwargs: FakeStore()
    )
    monkeypatch.setattr(
        executor_module,
        "build_model_router",
        lambda settings: SimpleNamespace(),
    )
    monkeypatch.setattr(
        executor_module,
        "build_initial_workflow_state",
        lambda **kwargs: {"run_id": "run-log"},
    )

    class FakeCompiledWorkflow:
        async def ainvoke(self, *args, **kwargs):  # noqa: ANN002, ANN003
            return {"final_report": {"run_id": "run-log"}}

    monkeypatch.setattr(
        executor_module,
        "SIMULATION_WORKFLOW",
        FakeCompiledWorkflow(),
    )

    class FakeAsyncContext:
        async def __aenter__(self):
            return None

        async def __aexit__(self, exc_type, exc, tb):  # noqa: ANN001
            return None

    monkeypatch.setattr(
        executor_module,
        "create_async_checkpointer_context",
        lambda settings: FakeAsyncContext(),
    )

    executor = executor_module.SimulationExecutor(settings)

    with caplog.at_level(logging.INFO, logger="simula.application.executor"):
        asyncio.run(executor.run_async("시나리오"))

    assert "run 시작: run-log" in caplog.text


def test_bootstrap_logs_execution_start_before_execute(monkeypatch, caplog) -> None:
    observed: list[str] = []
    captured_kwargs: dict[str, object] = {}

    monkeypatch.setattr(bootstrap_module, "configure_logging", lambda level: None)
    monkeypatch.setattr(
        bootstrap_module,
        "resolve_single_run_log_level",
        lambda **kwargs: "INFO",
    )
    monkeypatch.setattr(
        bootstrap_module,
        "read_scenario_text",
        lambda args: "테스트 시나리오",
    )

    def fake_execute_single_run(**kwargs):  # noqa: ANN003
        observed.append("execute_single_run")
        captured_kwargs.update(kwargs)
        return SimpleNamespace(
            output_dir="./output",
            run_id="run-1",
            final_state={
                "run_id": "run-1",
                "scenario": "테스트",
                "max_steps": 1,
                "simulation_clock": {
                    "total_elapsed_minutes": 30,
                    "total_elapsed_label": "30분",
                    "last_elapsed_minutes": 30,
                    "last_elapsed_label": "30분",
                    "last_advanced_step_index": 1,
                },
                "step_time_history": [
                    {
                        "step_index": 1,
                        "elapsed_unit": "minute",
                        "elapsed_amount": 30,
                        "elapsed_minutes": 30,
                        "elapsed_label": "30분",
                        "total_elapsed_minutes": 30,
                        "total_elapsed_label": "30분",
                        "selection_reason": "테스트용 기본 경과다.",
                        "signals": [],
                    }
                ],
                "plan": {},
                "actors": [],
                "activities": [],
                "observer_reports": [],
                "final_report": {
                    "run_id": "run-1",
                    "scenario": "테스트",
                    "objective": "추적",
                    "world_summary": "요약",
                    "world_state_summary": "상태",
                    "elapsed_simulation_minutes": 30,
                    "elapsed_simulation_label": "30분",
                    "steps_completed": 1,
                    "actor_count": 2,
                    "total_activities": 0,
                    "visibility_activity_counts": {"public": 0},
                    "last_observer_summary": "요약",
                    "notable_events": [],
                    "errors": [],
                },
                "final_report_markdown": "# 시뮬레이션 결과\n\n테스트",
            },
            final_report={
                "run_id": "run-1",
                "scenario": "테스트",
                "objective": "추적",
                "world_summary": "요약",
                "world_state_summary": "상태",
                "elapsed_simulation_minutes": 30,
                "elapsed_simulation_label": "30분",
                "steps_completed": 1,
                "actor_count": 2,
                "total_activities": 0,
                "visibility_activity_counts": {"public": 0},
                "last_observer_summary": "요약",
                "notable_events": [],
                "errors": [],
            },
        )

    monkeypatch.setattr(
        bootstrap_module,
        "execute_single_run",
        fake_execute_single_run,
    )
    monkeypatch.setattr(
        bootstrap_module,
        "write_single_run_outputs",
        lambda **kwargs: SavedRunOutputs(
            run_dir=Path("./output/run-1"),
            simulation_log_path=Path("./output/run-1/simulation.log.jsonl"),
            final_report_path=Path("./output/run-1/final_report.md"),
        ),
    )
    monkeypatch.setattr(
        bootstrap_module,
        "print_final_report",
        lambda *args, **kwargs: None,
    )

    args = SimpleNamespace(
        env=None,
        scenario_file="x",
        scenario_text=None,
        max_steps=7,
        trials=1,
        parallel=False,
    )

    with caplog.at_level(logging.INFO, logger="simula.bootstrap"):
        result = bootstrap_module.run_from_cli(args)

    assert result == 0
    assert observed == ["execute_single_run"]
    assert captured_kwargs["cli_overrides"] == {
        "SIM_MAX_STEPS": "7",
    }
    assert "시뮬레이션 실행 시작" in caplog.text


def test_initial_state_starts_with_empty_simulation_clock(tmp_path) -> None:
    settings = _build_settings(str(tmp_path / "runtime.sqlite"))

    state = build_initial_workflow_state(
        run_id="run-1",
        scenario_text="테스트",
        settings=settings,
    )

    assert state["simulation_clock"]["total_elapsed_minutes"] == 0
    assert state["step_time_history"] == []


def test_run_from_cli_keeps_original_error_when_log_level_resolution_fails(
    monkeypatch, capsys, caplog
) -> None:
    monkeypatch.setattr(
        bootstrap_module,
        "resolve_single_run_log_level",
        lambda **kwargs: (_ for _ in ()).throw(ValueError("boom")),
    )

    args = SimpleNamespace(
        env=None,
        scenario_file="x",
        scenario_text=None,
        max_steps=None,
        trials=1,
        parallel=False,
    )

    with caplog.at_level(logging.ERROR, logger="simula.bootstrap"):
        result = bootstrap_module.run_from_cli(args)

    captured = capsys.readouterr()
    assert result == 1
    assert "실행 실패: boom" in captured.err
    assert "실행 실패" in caplog.text


def _unwrap_chunk_value(value):  # noqa: ANN001
    unwrapped = value.value if hasattr(value, "value") else value
    if isinstance(unwrapped, dict) and "data" in unwrapped:
        return unwrapped["data"]
    return unwrapped


async def _collect_astream_chunks(compiled, initial_state, context):  # noqa: ANN001
    chunks = []
    async for chunk in compiled.astream(
        initial_state,
        context=context,
        config={"configurable": {"thread_id": initial_state["run_id"]}},
        stream_mode="values",
        version="v2",
    ):
        chunks.append(chunk)
    return chunks
