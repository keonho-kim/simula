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
import dataclasses
import logging
import time
from dataclasses import dataclass
from typing import Any, cast

from simula.application.ports.storage import StorageSchemaError
from simula.application.services.logging_setup import build_run_logger_name
from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.simulation.graph import (
    SIMULATION_WORKFLOW,
    SIMULATION_WORKFLOW_GRAPH,
)
from simula.application.workflow.graphs.simulation.states.initial_state import (
    build_simulation_input_state,
)
from simula.infrastructure.config.models import AppSettings
from simula.infrastructure.llm.router import build_model_router
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
        env_file_hint: str | None = None,
        trial_index: int | None = None,
        total_trials: int | None = None,
        parallel: bool = False,
    ) -> None:
        self.settings = settings
        self.store = create_app_store(settings, env_file_hint=env_file_hint)
        self.logger = logging.getLogger("simula.application.executor")
        self.llms = build_model_router(settings)
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
            if dataclasses.is_dataclass(self.llms):
                self.llms = dataclasses.replace(self.llms, logger=llm_logger)
            else:
                setattr(self.llms, "logger", llm_logger)

        run_logger.info("run 시작")

        context = WorkflowRuntimeContext(
            settings=self.settings,
            store=self.store,
            llms=self.llms,
            logger=run_logger,
        )
        input_state = build_simulation_input_state(
            run_id=run_id,
            scenario_text=scenario_text,
            settings=self.settings,
        )
        started_at = time.perf_counter()

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
                raw_result = await app.ainvoke(
                    input_state,
                    config={"configurable": {"thread_id": run_id}},
                    context=context,
                    version="v2",
                )
            final_state = _unwrap_graph_output(raw_result)
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
