"""Purpose:
- Expand the public simulation input into the full internal workflow state.
"""

from __future__ import annotations

from langgraph.runtime import Runtime

from simula.application.workflow.context import WorkflowRuntimeContext
from simula.application.workflow.graphs.simulation.states.initial_state import (
    expand_input_state_to_workflow_state,
)
from simula.application.workflow.graphs.simulation.states.state import (
    SimulationInputState,
    SimulationWorkflowState,
)


def hydrate_initial_state(
    state: SimulationInputState,
    runtime: Runtime[WorkflowRuntimeContext],
) -> SimulationWorkflowState:
    """Hydrate the compact public input into the full workflow state."""

    return expand_input_state_to_workflow_state(
        input_state=state,
        settings=runtime.context.settings,
    )
