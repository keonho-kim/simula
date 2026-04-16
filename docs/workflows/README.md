# Workflow Docs

This section documents the active compiled workflow only.

## Stage Order

```mermaid
flowchart LR
    Input["SimulationInputState"] --> Hydrate["hydrate_initial_state"]
    Hydrate --> Planning["planning"]
    Planning --> Generation["generation"]
    Generation --> Runtime["runtime"]
    Runtime --> Finalization["finalization"]
    Finalization --> Output["SimulationOutputState"]
```

## Reading Order

| If you need to understand... | Read |
| --- | --- |
| the root graph boundary | [`simulation.md`](./simulation.md) |
| how scenario text becomes a plan | [`planning.md`](./planning.md) |
| how cast slots become actors | [`generation.md`](./generation.md) |
| how rounds loop and stop | [`runtime.md`](./runtime.md) |
| how the report is assembled | [`finalization.md`](./finalization.md) |

## Cross-Stage Handoffs

| Stage | Consumes | Produces |
| --- | --- | --- |
| simulation root | public input plus runtime context | hydrated workflow state |
| planning | scenario text and scenario controls | compact execution plan plus planned round target |
| generation | plan cast roster | finalized actor cards |
| runtime | plan, actors, and accumulated trace | completed runtime trace plus event history |
| finalization | completed runtime trace | structured final report, report projection, markdown sections |

## Notes

- the runtime stage is the only looping stage
- generation and runtime both use explicit fan-out/fan-in patterns
- finalization writes section strings in parallel and renders markdown after all sections finish

Related docs:

- root graph boundary: [`simulation.md`](./simulation.md)
- system architecture: [`../architecture.md`](../architecture.md)
- artifact contracts: [`../contracts.md`](../contracts.md)
