"""목적:
- LangGraph workflow runtime context 계약을 정의한다.

설명:
- workflow 노드가 공통 의존성을 상태 외부에서 읽을 수 있도록 run-scoped context를 제공한다.

사용한 설계 패턴:
- runtime context 패턴

연관된 다른 모듈/구조:
- simula.application.workflow.graphs.simulation.graph
- simula.entrypoints.bootstrap
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from simula.application.ports.llm import StructuredLLM
from simula.application.ports.storage import AppStore
from simula.infrastructure.config.models import AppSettings


@dataclass(slots=True)
class WorkflowRuntimeContext:
    """LangGraph workflow run-scoped context다."""

    settings: AppSettings
    store: AppStore
    llms: StructuredLLM
    logger: logging.Logger
