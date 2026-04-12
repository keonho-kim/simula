# Simulation Workflow

## Purpose

The simulation workflow is the root graph that assembles the project lifecycle into one
LangGraph app. It does not contain the detailed logic of every stage; it delegates those to
subgraphs and passes one shared workflow state through them in sequence.

## Root Assembly

```mermaid
flowchart LR
    START --> planning
    planning --> generation
    generation --> runtime
    runtime --> finalization
    finalization --> END
```

## Inputs and Outputs

| Input | Meaning |
| --- | --- |
| `run_id` | unique run identifier created by the executor |
| `scenario` | raw scenario text |
| `max_steps` | runtime step cap loaded from settings |
| `rng_seed` | deterministic seed resolved before graph execution |
| `checkpoint_enabled` | whether execution may be recompiled with a checkpointer |

| Output | Meaning |
| --- | --- |
| `final_report` | structured final report JSON |
| `simulation_log_jsonl` | rendered JSONL log string |
| `report_projection_json` | finalization-only report projection |
| `final_report_markdown` | final markdown report in state |

## Subgraph Handoff

| From | To | Handoff surface |
| --- | --- | --- |
| planning | generation | `plan`, `action_catalog`, `coordination_frame`, cast roster |
| generation | runtime | `actors` |
| runtime | finalization | activities, observer reports, time history, focus history, actor state, stop reason |

## Execution Path

```mermaid
flowchart TD
    Executor["SimulationExecutor"] --> InitialState["build_initial_workflow_state(...)"]
    Executor --> Context["WorkflowRuntimeContext(settings, store, llms, logger)"]
    InitialState --> App["SIMULATION_WORKFLOW or checkpointer-compiled graph"]
    Context --> App
    App --> FinalState["workflow final state"]
```

## Important Current Behaviors

- the repository keeps a compiled singleton `SIMULATION_WORKFLOW` for the normal path
- when checkpointing is enabled, the executor recompiles from `SIMULATION_WORKFLOW_GRAPH`
  with the active checkpointer
- graph invocation uses `ainvoke(..., version="v2")`
- file outputs are not written inside this workflow; they are written later from the final
  state by the presentation layer

## Prompt Projection Boundary

The root workflow moves rich shared state between subgraphs, but generation, coordinator,
actor, and observer LLM calls do not receive that state wholesale. Downstream nodes derive
compact prompt projections before each role invocation.

- generation uses compact planning views
- coordinator uses compact focus, proposal, background, and intent views
- actor uses a compact per-actor task payload
- observer uses compact latest-step and prior-state digests

Finalization is different: it derives `report_projection_json`, which is a report-writing
artifact rather than a prompt projection helper payload.

## Related Docs

- planning internals: [`planning.md`](./planning.md)
- runtime internals: [`runtime.md`](./runtime.md)
- report assembly: [`finalization.md`](./finalization.md)
