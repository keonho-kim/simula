"""목적:
- simulation workflow compile/reuse 와 실제 실행을 담당한다.

설명:
- LangGraph app 를 재사용해 단일 시뮬레이션 실행을 담당한다.

사용한 설계 패턴:
- executor/service 패턴

연관된 다른 모듈/구조:
- simula.entrypoints.bootstrap
- simula.application.workflow.graphs.simulation.graph
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Any, cast

from simula.application.ports.storage import StorageSchemaError
from simula.application.services.logging_setup import build_run_logger_name
from simula.application.services.run_jsonl import RunJsonlAppender
from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.simulation.graph import (
    SIMULATION_WORKFLOW,
    SIMULATION_WORKFLOW_GRAPH,
)
from simula.application.workflow.graphs.simulation.states.initial_state import (
    build_simulation_input_state,
)
from simula.domain.log_events import (
    build_llm_usage_summary_event,
    build_simulation_started_event,
)
from simula.domain.scenario_controls import ScenarioControls
from simula.infrastructure.config.models import AppSettings
from simula.infrastructure.llm.service import build_model_router
from simula.infrastructure.llm.usage import LLMUsageTracker
from simula.infrastructure.storage.app_store import RunIdConflictError
from simula.infrastructure.storage.factory import (
    create_app_store,
    create_async_checkpointer_context,
)


@dataclass(slots=True)
class SimulationExecutionResult:
    """실행 결과와 메트릭을 담는다."""

    run_id: str
    success: bool
    final_state: dict[str, Any] | None
    final_report: dict[str, Any] | None
    wall_clock_seconds: float
    error: str | None


class SimulationExecutor:
    """compiled LangGraph app 를 재사용하는 실행기다."""

    def __init__(
        self,
        settings: AppSettings,
        *,
        scenario_controls: ScenarioControls,
        env_file_hint: str | None = None,
        trial_index: int | None = None,
        total_trials: int | None = None,
        parallel: bool = False,
    ) -> None:
        self.settings = settings
        self.scenario_controls = scenario_controls
        self.store = create_app_store(settings, env_file_hint=env_file_hint)
        self.logger = logging.getLogger("simula.application.executor")
        self.llm_usage_tracker = LLMUsageTracker()
        self.llms = build_model_router(settings, usage_tracker=self.llm_usage_tracker)
        self.trial_index = trial_index
        self.total_trials = total_trials
        self.parallel = parallel

    def close(self) -> None:
        """열린 리소스를 닫는다."""

        self.store.close()

    def run(self, scenario_text: str) -> SimulationExecutionResult:
        """단일 시뮬레이션 run 을 동기 래퍼로 실행한다."""

        return asyncio.run(self.run_async(scenario_text))

    async def run_async(self, scenario_text: str) -> SimulationExecutionResult:
        """단일 시뮬레이션 run 을 비동기로 실행한다."""

        run_id = ""
        settings_snapshot = self.settings.redacted_dump()
        for _ in range(10):
            candidate_run_id = self.store.next_run_id()
            try:
                self.store.save_run_started(
                    run_id=candidate_run_id,
                    scenario_text=scenario_text,
                    settings_json=settings_snapshot,
                )
                run_id = candidate_run_id
                break
            except RunIdConflictError:
                continue

        if not run_id:
            raise StorageSchemaError("run_id 생성에 반복적으로 실패했습니다.")

        run_logger = logging.getLogger(
            build_run_logger_name(
                base_name="simula.workflow",
                run_id=run_id,
                trial_index=self.trial_index,
                total_trials=self.total_trials,
                parallel=self.parallel,
            )
        )
        llm_logger = logging.getLogger(
            build_run_logger_name(
                base_name="simula.llm",
                run_id=run_id,
                trial_index=self.trial_index,
                total_trials=self.total_trials,
                parallel=self.parallel,
            )
        )
        if hasattr(self.llms, "logger"):
            setattr(self.llms, "logger", llm_logger)

        run_logger.info("run 시작")

        context = WorkflowRuntimeContext(
            settings=self.settings,
            store=self.store,
            llms=self.llms,
            logger=run_logger,
            llm_usage_tracker=self.llm_usage_tracker,
            run_jsonl_appender=RunJsonlAppender(
                output_dir=self.settings.storage.output_dir,
                run_id=run_id,
            ),
        )
        if hasattr(self.llms, "configure_run_logging"):
            getattr(self.llms, "configure_run_logging")(
                run_id=run_id,
                stream_event_sink=(
                    context.run_jsonl_appender.append
                    if context.run_jsonl_appender is not None
                    else None
                ),
            )
        input_state = build_simulation_input_state(
            run_id=run_id,
            scenario_text=scenario_text,
            scenario_controls=self.scenario_controls,
            settings=self.settings,
        )
        started_at = time.perf_counter()
        if context.run_jsonl_appender is not None:
            context.run_jsonl_appender.append(
                build_simulation_started_event(
                    run_id=run_id,
                    scenario=scenario_text,
                    max_rounds=input_state["max_rounds"],
                    rng_seed=input_state["rng_seed"],
                )
            )

        try:
            async with create_async_checkpointer_context(self.settings) as checkpointer:
                app = (
                    SIMULATION_WORKFLOW_GRAPH.compile(
                        checkpointer=checkpointer,
                        name="simula",
                    )
                    if checkpointer is not None
                    else SIMULATION_WORKFLOW
                )
                final_state: dict[str, Any] | None = None
                async for chunk in app.astream(
                    input_state,
                    config={"configurable": {"thread_id": run_id}},
                    context=context,
                    stream_mode=["custom", "values"],
                    version="v2",
                ):
                    final_state = _consume_stream_chunk(
                        chunk=chunk,
                        final_state=final_state,
                        appender=context.run_jsonl_appender,
                    )
            if final_state is None:
                raise RuntimeError("workflow did not produce a final state.")
            llm_usage_summary = self.llm_usage_tracker.snapshot()
            if context.run_jsonl_appender is not None:
                context.run_jsonl_appender.append(
                    build_llm_usage_summary_event(
                        run_id=run_id,
                        llm_usage_summary=llm_usage_summary,
                    )
                )
                final_state["simulation_log_jsonl"] = context.run_jsonl_appender.path.read_text(
                    encoding="utf-8"
                ).rstrip()
            wall_clock = time.perf_counter() - started_at
            self.store.mark_run_status(run_id, "completed")
            run_logger.info("run 완료 | wall_clock=%.2fs", wall_clock)
            return SimulationExecutionResult(
                run_id=run_id,
                success=True,
                final_state=final_state,
                final_report=final_state.get("final_report"),
                wall_clock_seconds=wall_clock,
                error=None,
            )
        except Exception as exc:  # noqa: BLE001
            wall_clock = time.perf_counter() - started_at
            run_logger.exception("run 실패 | wall_clock=%.2fs", wall_clock)
            self.store.mark_run_status(run_id, "failed", str(exc))
            return SimulationExecutionResult(
                run_id=run_id,
                success=False,
                final_state=None,
                final_report=None,
                wall_clock_seconds=wall_clock,
                error=str(exc),
            )


def _unwrap_graph_output(result: Any) -> dict[str, Any]:
    """LangGraph v2 workflow 출력 래퍼를 dict state로 벗긴다."""

    if hasattr(result, "value"):
        return cast(dict[str, Any], result.value)
    return cast(dict[str, Any], result)


def _consume_stream_chunk(
    *,
    chunk: object,
    final_state: dict[str, Any] | None,
    appender: RunJsonlAppender | None,
) -> dict[str, Any] | None:
    if not isinstance(chunk, tuple) or len(chunk) != 2:
        if isinstance(chunk, dict):
            return cast(dict[str, Any], chunk)
        return final_state

    mode, payload = chunk
    if mode == "values" and isinstance(payload, dict):
        return cast(dict[str, Any], payload)

    if mode == "custom" and isinstance(payload, dict):
        payload_dict = cast(dict[str, object], payload)
        entry = payload_dict.get("entry")
        if isinstance(entry, dict) and appender is not None:
            appender.append(cast(dict[str, object], entry))
        return final_state

    return final_state
