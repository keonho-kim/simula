# Simulation Root Graph

## Purpose

The root graph defines the public workflow boundary, hydration step, and stage order.

## Active Path

```mermaid
flowchart LR
    Start([START]) --> Hydrate["hydrate_initial_state"]
    Hydrate --> Planning["planning"]
    Planning --> Generation["generation"]
    Generation --> Runtime["runtime"]
    Runtime --> Finalization["finalization"]
    Finalization --> End([END])
```

## Graph Shape

The root builder is a `StateGraph` configured with:

- `input_schema=SimulationInputState`
- `state_schema=SimulationWorkflowState`
- `output_schema=SimulationOutputState`
- `context_schema=WorkflowRuntimeContext`

That keeps the public boundary narrow while allowing downstream nodes to communicate through a
fully hydrated required-only internal state.

## Hydration

`hydrate_initial_state` is the only root node that reads public input directly.

It expands:

- `run_id`
- `scenario`
- `scenario_controls`
- `max_rounds`
- `rng_seed`
- `parallel_graph_calls`

into a fully initialized workflow state, including:

- empty planning and runtime scratch fields
- initial simulation clock fields
- initial report buffers
- empty `errors`
- internal-only `checkpoint_enabled`

Downstream nodes assume those keys already exist and do not defend against missing state shape.

## Runtime Context

The graph also receives `WorkflowRuntimeContext`, which currently provides:

- `settings`
- `store`
- `llms`
- `logger`
- `llm_usage_tracker`
- `run_jsonl_appender`

These dependencies stay outside the graph state.

## Serial And Parallel Variants

The shipped default root workflow uses the serial stage variants.

- `SIMULATION_WORKFLOW` is the default serial root workflow
- `SIMULATION_WORKFLOW_PARALLEL` is selected only when CLI `--parallel` is enabled

The public input and output schemas stay the same across both variants. Only intra-run branch
concurrency changes.

## Execution Stream Surface

The graph itself defines the workflow shape. The executor defines how it is consumed.

During execution, the executor streams:

- `custom` events for stable runtime log entries
- `values` snapshots for state output

Operationally this means:

- custom events are appended to `simulation.log.jsonl`
- the last `values` snapshot becomes the final graph output seen by the executor

## Stage Ownership

Each stage has one clear responsibility:

- `planning`: scenario interpretation and execution plan construction
- `generation`: actor card generation
- `runtime`: round loop, action adoption, and stop decisions
- `finalization`: final report projection and markdown assembly

## Related Docs

- stage hub: [`README.md`](./README.md)
- state and runtime context contracts: [`../contracts.md`](../contracts.md)
- architecture and stream boundary: [`../architecture.md`](../architecture.md)
