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
from datetime import datetime
from typing import Any, cast

from simula.application.ports.storage import StorageSchemaError
from simula.application.workflow.context import WorkflowRuntimeContext
from simula.shared.io.run_jsonl import RunJsonlAppender
from simula.shared.logging.setup import build_run_logger_name
from simula.shared.text import slugify_path_token
from simula.application.services.output_writer import write_run_outputs
from simula.application.workflow.graphs.simulation import (
    SIMULATION_WORKFLOW,
    SIMULATION_WORKFLOW_GRAPH_PARALLEL,
    SIMULATION_WORKFLOW_PARALLEL,
    SIMULATION_WORKFLOW_GRAPH,
)
from simula.application.workflow.graphs.simulation.states.initial_state import (
    build_simulation_input_state,
)
from simula.domain.reporting.events import (
    build_llm_usage_summary_event,
    build_simulation_started_event,
)
from simula.domain.scenario.controls import ScenarioControls
from simula.infrastructure.config.models import AppSettings
from simula.infrastructure.llm.runtime import build_model_router
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
        scenario_file_path: str,
        scenario_file_stem: str,
        env_file_hint: str | None = None,
        trial_index: int | None = None,
        total_trials: int | None = None,
        parallel: bool = False,
    ) -> None:
        self.settings = settings
        self.scenario_controls = scenario_controls
        self.scenario_file_path = scenario_file_path
        self.scenario_file_stem = scenario_file_stem
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
        run_model_id = slugify_path_token(self.settings.models.planner.model)
        if not run_model_id:
            raise ValueError("run model id를 slug로 정규화할 수 없습니다.")
        for _ in range(10):
            candidate_run_id = self.store.next_run_id(
                run_model_id=run_model_id,
                scenario_file_stem=self.scenario_file_stem,
            )
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

        run_logger.info("RUN 시작 | run_id=%s", run_id)

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
            parallel_graph_calls=self.parallel,
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
            parallel_graph_calls=self.parallel,
        )
        started_at = time.perf_counter()
        started_at_utc = datetime.now().astimezone()
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
                    (
                        SIMULATION_WORKFLOW_GRAPH_PARALLEL
                        if self.parallel
                        else SIMULATION_WORKFLOW_GRAPH
                    ).compile(
                        checkpointer=checkpointer,
                        name="simula",
                    )
                    if checkpointer is not None
                    else (
                        SIMULATION_WORKFLOW_PARALLEL
                        if self.parallel
                        else SIMULATION_WORKFLOW
                    )
                )
                final_state: dict[str, Any] | None = None
                debug_graph_nodes = run_logger.isEnabledFor(logging.DEBUG)
                stream_modes = (
                    ["custom", "values", "debug"]
                    if debug_graph_nodes
                    else ["custom", "values"]
                )
                stream_kwargs: dict[str, object] = {
                    "config": {"configurable": {"thread_id": run_id}},
                    "context": context,
                    "stream_mode": stream_modes,
                    "version": "v2",
                }
                if debug_graph_nodes:
                    stream_kwargs["subgraphs"] = True

                async for chunk in app.astream(input_state, **stream_kwargs):
                    final_state = _consume_stream_chunk(
                        chunk=chunk,
                        final_state=final_state,
                        appender=context.run_jsonl_appender,
                        logger=run_logger,
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
                final_state["simulation_log_jsonl"] = (
                    context.run_jsonl_appender.path.read_text(encoding="utf-8").rstrip()
                )
            wall_clock = time.perf_counter() - started_at
            ended_at = datetime.now().astimezone()
            self.store.mark_run_status(run_id, "completed")
            write_run_outputs(
                settings=self.settings,
                run_id=run_id,
                scenario_file_path=self.scenario_file_path,
                scenario_file_stem=self.scenario_file_stem,
                run_model_id=run_model_id,
                started_at=started_at_utc,
                ended_at=ended_at,
                wall_clock_seconds=wall_clock,
                status="completed",
                error=None,
                final_state=final_state,
            )
            run_logger.info(
                "RUN 완료 | run_id=%s | wall_clock=%.2fs",
                run_id,
                wall_clock,
            )
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
            ended_at = datetime.now().astimezone()
            run_logger.exception(
                "RUN 실패 | run_id=%s | wall_clock=%.2fs",
                run_id,
                wall_clock,
            )
            self.store.mark_run_status(run_id, "failed", str(exc))
            if run_id:
                try:
                    write_run_outputs(
                        settings=self.settings,
                        run_id=run_id,
                        scenario_file_path=self.scenario_file_path,
                        scenario_file_stem=self.scenario_file_stem,
                        run_model_id=run_model_id,
                        started_at=started_at_utc,
                        ended_at=ended_at,
                        wall_clock_seconds=wall_clock,
                        status="failed",
                        error=str(exc),
                        final_state=None,
                    )
                except Exception:  # noqa: BLE001
                    run_logger.exception(
                        "RUN 실패 산출물 저장 실패 | run_id=%s",
                        run_id,
                    )
            return SimulationExecutionResult(
                run_id=run_id,
                success=False,
                final_state=None,
                final_report=None,
                wall_clock_seconds=wall_clock,
                error=str(exc),
            )


def _consume_stream_chunk(
    *,
    chunk: object,
    final_state: dict[str, Any] | None,
    appender: RunJsonlAppender | None,
    logger: logging.Logger,
) -> dict[str, Any] | None:
    if isinstance(chunk, dict):
        chunk_dict = cast(dict[str, object], chunk)
        chunk_type = str(chunk_dict.get("type", "")).strip()
        if chunk_type == "values":
            payload = chunk_dict.get("data")
            if isinstance(payload, dict):
                return cast(dict[str, Any], payload)
            return final_state
        if chunk_type == "custom":
            _append_stream_entry(chunk_dict.get("data"), appender)
            return final_state
        if chunk_type == "debug":
            _log_graph_debug_event(
                logger=logger,
                graph_path=chunk_dict.get("ns", ()),
                payload=chunk_dict.get("data"),
            )
            return final_state
        return cast(dict[str, Any], chunk_dict)

    if not isinstance(chunk, tuple) or len(chunk) not in (2, 3):
        return final_state

    if len(chunk) == 3:
        graph_path, mode, payload = chunk
    else:
        graph_path = ()
        mode, payload = chunk

    if mode == "values" and isinstance(payload, dict):
        return cast(dict[str, Any], payload)

    if mode == "custom":
        _append_stream_entry(payload, appender)
        return final_state

    if mode == "debug":
        _log_graph_debug_event(
            logger=logger,
            graph_path=graph_path,
            payload=payload,
        )
        return final_state

    return final_state


def _append_stream_entry(
    payload: object,
    appender: RunJsonlAppender | None,
) -> None:
    if appender is None or not isinstance(payload, dict):
        return

    payload_dict = cast(dict[str, object], payload)
    entry = payload_dict.get("entry")
    if isinstance(entry, dict):
        appender.append(cast(dict[str, object], entry))


def _log_graph_debug_event(
    *,
    logger: logging.Logger,
    graph_path: object,
    payload: object,
) -> None:
    if not logger.isEnabledFor(logging.DEBUG) or not isinstance(payload, dict):
        return

    payload_dict = cast(dict[str, object], payload)
    event_type = str(payload_dict.get("type", "")).strip()
    if event_type not in {"task", "task_result"}:
        return

    task_payload = payload_dict.get("payload")
    if not isinstance(task_payload, dict):
        return

    task_dict = cast(dict[str, object], task_payload)
    node_name = str(task_dict.get("name", "")).strip()
    if not node_name:
        return

    step = payload_dict.get("step")
    graph_name = _graph_name_from_path(graph_path)
    if event_type == "task":
        logger.debug(
            "GRAPH NODE 시작 | graph=%s | node=%s | step=%s",
            graph_name,
            node_name,
            step,
        )
        return

    status = "error" if task_dict.get("error") else "ok"
    logger.debug(
        "GRAPH NODE 완료 | graph=%s | node=%s | step=%s | status=%s",
        graph_name,
        node_name,
        step,
        status,
    )


def _graph_name_from_path(graph_path: object) -> str:
    if not isinstance(graph_path, (tuple, list)) or not graph_path:
        return "simulation"

    last_segment = str(graph_path[-1]).strip()
    if not last_segment:
        return "simulation"

    return last_segment.split(":", maxsplit=1)[0] or "simulation"
