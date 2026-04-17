"""Purpose:
- Verify executor success and failure behavior without prompt-coupled checks.
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from types import SimpleNamespace

from simula.application.services import executor as executor_module
from simula.infrastructure.config.models import (
    AppSettings,
    ModelConfig,
    ModelRouterConfig,
    OpenAIProviderConfig,
    RuntimeConfig,
    StorageConfig,
)


def _settings(*, output_dir: Path) -> AppSettings:
    provider = OpenAIProviderConfig(api_key="test-key")
    model = ModelConfig(provider="openai", model="gpt-test", openai=provider)
    return AppSettings(
        models=ModelRouterConfig(
            planner=model,
            generator=model,
            coordinator=model,
            actor=model,
            observer=model,
            fixer=model,
        ),
        runtime=RuntimeConfig(max_rounds=1, enable_checkpointing=False),
        storage=StorageConfig(output_dir=str(output_dir)),
    )


def _success_values_payload(run_id: str) -> dict[str, object]:
    return {
        "run_id": run_id,
        "final_report": {"run_id": run_id},
        "final_report_markdown": "# 시뮬레이션 결과\n\n요약",
        "simulation_log_jsonl": "\n".join(
            [
                json.dumps(
                    {
                        "index": 1,
                        "event": "simulation_started",
                        "event_key": "simulation_started",
                        "run_id": run_id,
                        "scenario": "scenario",
                        "max_rounds": 1,
                        "rng_seed": 1234,
                    },
                    ensure_ascii=False,
                ),
                json.dumps(
                    {
                        "index": 2,
                        "event": "plan_finalized",
                        "event_key": "plan_finalized",
                        "run_id": run_id,
                        "plan": {"hello": "world"},
                    },
                    ensure_ascii=False,
                ),
                json.dumps(
                    {
                        "index": 3,
                        "event": "llm_usage_summary",
                        "event_key": "llm_usage_summary",
                        "run_id": run_id,
                        "llm_usage_summary": {
                            "total_calls": 0,
                            "calls_by_role": {},
                            "structured_calls": 0,
                            "text_calls": 0,
                            "parse_failures": 0,
                            "forced_defaults": 0,
                            "input_tokens": None,
                            "output_tokens": None,
                            "total_tokens": None,
                        },
                    },
                    ensure_ascii=False,
                ),
            ]
        ),
        "stop_reason": "",
        "errors": [],
    }


def test_executor_returns_successful_run_result(
    monkeypatch,
    tmp_path: Path,
) -> None:
    for stream_mode, run_id in [("tuple", "20260413.1"), ("dict", "20260413.2")]:
        captured: dict[str, object] = {}
        llm_stream_sink = None

        class FakeLLMService:
            def __init__(self) -> None:
                self.logger = logging.getLogger("simula.test.llm")

            def configure_run_logging(self, *, run_id, stream_event_sink):  # noqa: ANN001
                nonlocal llm_stream_sink
                captured["configured_run_id"] = run_id
                llm_stream_sink = stream_event_sink

        class FakeApp:
            async def astream(self, state, **kwargs):  # noqa: ANN001
                captured["state"] = state
                if llm_stream_sink is not None:
                    llm_stream_sink(
                        {
                            "event": "llm_call",
                            "event_key": "llm_call:1",
                            "run_id": state["run_id"],
                            "sequence": 1,
                            "role": "planner",
                            "call_kind": "structured",
                            "log_context": {"scope": "planning-analysis"},
                            "prompt": "prompt",
                            "raw_response": '{"brief_summary":"요약"}',
                            "duration_seconds": 0.12,
                            "ttft_seconds": 0.03,
                            "input_tokens": 10,
                            "output_tokens": 20,
                            "total_tokens": 30,
                        }
                    )
                if stream_mode == "tuple":
                    yield (
                        "custom",
                        {
                            "stream": "simulation_log",
                            "entry": {
                                "event": "plan_finalized",
                                "event_key": "plan_finalized",
                                "run_id": state["run_id"],
                                "plan": {"hello": "world"},
                            },
                        },
                    )
                    yield ("values", _success_values_payload(state["run_id"]))
                    return
                yield {
                    "type": "custom",
                    "ns": ("finalization",),
                    "data": {
                        "stream": "simulation_log",
                        "entry": {
                            "event": "plan_finalized",
                            "event_key": "plan_finalized",
                            "run_id": state["run_id"],
                            "plan": {"hello": "world"},
                        },
                    },
                    "interrupts": (),
                }
                yield {
                    "type": "values",
                    "ns": (),
                    "data": _success_values_payload(state["run_id"]),
                    "interrupts": (),
                }

        class FakeStore:
            def __init__(self) -> None:
                self._run_id = run_id
                self.statuses: list[tuple[str, str, str | None]] = []

            def next_run_id(self) -> str:
                return self._run_id

            def save_run_started(self, **kwargs):  # noqa: ANN003
                return None

            def mark_run_status(self, run_id, status, error_text=None):  # noqa: ANN001
                self.statuses.append((run_id, status, error_text))

            def close(self) -> None:
                return None

        monkeypatch.setattr(
            executor_module,
            "create_app_store",
            lambda *args, **kwargs: FakeStore(),
        )
        monkeypatch.setattr(
            executor_module,
            "build_model_router",
            lambda settings, usage_tracker: FakeLLMService(),  # noqa: ARG005
        )
        monkeypatch.setattr(executor_module, "SIMULATION_WORKFLOW", FakeApp())

        class _NoCheckpointer:
            async def __aenter__(self):
                return None

            async def __aexit__(self, exc_type, exc, tb):  # noqa: ANN001
                return None

        monkeypatch.setattr(
            executor_module,
            "create_async_checkpointer_context",
            lambda settings: _NoCheckpointer(),
        )

        settings = _settings(output_dir=tmp_path / f"output-{run_id}")
        executor = executor_module.SimulationExecutor(
            settings,
            scenario_controls={"num_cast": 2, "allow_additional_cast": True},
        )
        try:
            result = asyncio.run(executor.run_async("scenario"))
        finally:
            executor.close()

        assert result.success is True
        assert result.run_id == run_id
        assert result.final_report == {"run_id": run_id}
        assert captured["configured_run_id"] == run_id
        log_path = Path(settings.storage.output_dir) / result.run_id / "simulation.log.jsonl"
        assert log_path.exists()
        lines = [line for line in log_path.read_text(encoding="utf-8").splitlines() if line]
        assert [json.loads(line)["event"] for line in lines] == [
            "simulation_started",
            "llm_call",
            "plan_finalized",
            "llm_usage_summary",
        ]


def test_executor_logs_original_failure_traceback(
    monkeypatch,
    caplog,
    tmp_path: Path,
) -> None:
    class FakeApp:
        async def astream(self, state, **kwargs):  # noqa: ANN001
            del kwargs
            yield (
                "custom",
                {
                    "stream": "simulation_log",
                    "entry": {
                        "event": "plan_finalized",
                        "event_key": "plan_finalized",
                        "run_id": state["run_id"],
                        "plan": {"hello": "world"},
                    },
                },
            )
            raise RuntimeError("boom")

    class FakeStore:
        def __init__(self) -> None:
            self._run_id = "20260413.3"
            self.statuses: list[tuple[str, str, str | None]] = []

        def next_run_id(self) -> str:
            return self._run_id

        def save_run_started(self, **kwargs):  # noqa: ANN003
            return None

        def mark_run_status(self, run_id, status, error_text=None):  # noqa: ANN001
            self.statuses.append((run_id, status, error_text))

        def close(self) -> None:
            return None

    fake_store = FakeStore()
    monkeypatch.setattr(executor_module, "create_app_store", lambda *args, **kwargs: fake_store)
    monkeypatch.setattr(
        executor_module,
        "build_model_router",
        lambda settings, usage_tracker: SimpleNamespace(  # noqa: ARG005
            logger=logging.getLogger("simula.test.llm")
        ),
    )
    monkeypatch.setattr(executor_module, "SIMULATION_WORKFLOW", FakeApp())

    class _NoCheckpointer:
        async def __aenter__(self):
            return None

        async def __aexit__(self, exc_type, exc, tb):  # noqa: ANN001
            return None

    monkeypatch.setattr(
        executor_module,
        "create_async_checkpointer_context",
        lambda settings: _NoCheckpointer(),
    )

    settings = _settings(output_dir=tmp_path / "output")
    executor = executor_module.SimulationExecutor(
        settings,
        scenario_controls={"num_cast": 2, "allow_additional_cast": True},
    )
    try:
        with caplog.at_level(logging.ERROR, logger="simula"):
            result = asyncio.run(executor.run_async("scenario"))
    finally:
        executor.close()

    assert result.success is False
    assert result.error == "boom"
    assert any(
        record.levelno >= logging.ERROR
        and record.exc_info is not None
        and isinstance(record.exc_info[1], RuntimeError)
        and str(record.exc_info[1]) == "boom"
        for record in caplog.records
    )
    log_path = Path(settings.storage.output_dir) / result.run_id / "simulation.log.jsonl"
    assert log_path.exists()
    lines = [line for line in log_path.read_text(encoding="utf-8").splitlines() if line]
    assert [json.loads(line)["event"] for line in lines] == [
        "simulation_started",
        "plan_finalized",
    ]
    assert fake_store.statuses[-1] == ("20260413.3", "failed", "boom")
