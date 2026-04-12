# Documentation

This documentation set follows the current compiled graph and runtime path in the
repository. It is meant to answer two questions quickly:

- what is wired today
- where a specific behavior actually lives

## Recommended Reading Paths

| Goal | Read this first | Then read |
| --- | --- | --- |
| Understand the whole project | [`../README.md`](../README.md) | [`architecture.md`](./architecture.md), [`workflows/README.md`](./workflows/README.md) |
| Understand graph composition | [`workflows/simulation.md`](./workflows/simulation.md) | [`workflows/planning.md`](./workflows/planning.md), [`workflows/runtime.md`](./workflows/runtime.md) |
| Debug one runtime step | [`workflows/runtime.md`](./workflows/runtime.md) | [`workflows/coordinator.md`](./workflows/coordinator.md), [`contracts.md`](./contracts.md) |
| Change model routing or prompt ownership | [`llm.md`](./llm.md) | relevant workflow document for the stage you are editing |
| Run locally or verify config | [`operations.md`](./operations.md) | [`contracts.md`](./contracts.md) |

## Documentation Map

### System Docs

- [`architecture.md`](./architecture.md)
  - layer boundaries, execution path, shared runtime context, and output ownership
- [`contracts.md`](./contracts.md)
  - config merge rules, state channels, structured outputs, and persistence surface
- [`llm.md`](./llm.md)
  - role responsibilities, provider wiring, fallback behavior, and prompt ownership
- [`operations.md`](./operations.md)
  - local run commands, config workflow, multi-run behavior, and maintenance commands

### Workflow Docs

- [`workflows/README.md`](./workflows/README.md)
  - workflow hub and handoff summary
- [`workflows/simulation.md`](./workflows/simulation.md)
  - root graph assembly and executor handoff
- [`workflows/planning.md`](./workflows/planning.md)
  - scenario interpretation and plan construction
- [`workflows/generation.md`](./workflows/generation.md)
  - actor-slot fan-out and actor registry finalization
- [`workflows/runtime.md`](./workflows/runtime.md)
  - step loop, observer role, persistence, and stop branching
- [`workflows/coordinator.md`](./workflows/coordinator.md)
  - focus selection, deferred actor digestion, actor proposal fan-out, adjudication
- [`workflows/finalization.md`](./workflows/finalization.md)
  - report payloads, timeline anchoring, projection building, markdown assembly

## Documentation Conventions

- “current compiled graph” means the path wired by `*_SUBGRAPH` and `SIMULATION_WORKFLOW`
  today, not every prompt or helper module present in the tree
- workflow docs describe inputs and outputs at the state-channel level instead of repeating
  every implementation detail from the code
- file outputs such as `final_report.md` are documented separately from state outputs because
  they are written after the workflow returns
