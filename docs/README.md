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
| Understand prompt-facing inputs | [`llm.md`](./llm.md) | [`architecture.md`](./architecture.md), [`workflows/generation.md`](./workflows/generation.md), [`workflows/coordinator.md`](./workflows/coordinator.md) |
| Change model routing or prompt ownership | [`llm.md`](./llm.md) | relevant workflow document for the stage you are editing |
| Run locally or verify config | [`operations.md`](./operations.md) | [`contracts.md`](./contracts.md) |

## Documentation Map

### System Docs

- [`architecture.md`](./architecture.md)
  - layer boundaries, execution path, shared runtime context, and the prompt-projection layer
- [`contracts.md`](./contracts.md)
  - config merge rules, state channels, actor task payloads, structured outputs, and persistence surface
- [`llm.md`](./llm.md)
  - role responsibilities, provider wiring, compact prompt inputs, and prompt ownership
- [`operations.md`](./operations.md)
  - local run commands, config workflow, multi-run behavior, and maintenance commands

### Workflow Docs

- [`workflows/README.md`](./workflows/README.md)
  - workflow hub and handoff summary
- [`workflows/simulation.md`](./workflows/simulation.md)
  - root graph assembly, executor handoff, and the prompt-projection boundary
- [`workflows/planning.md`](./workflows/planning.md)
  - scenario interpretation and plan construction
- [`workflows/generation.md`](./workflows/generation.md)
  - actor-slot fan-out, compact generator inputs, and actor registry finalization
- [`workflows/runtime.md`](./workflows/runtime.md)
  - step loop, observer role, compact observer inputs, persistence, and stop branching
- [`workflows/coordinator.md`](./workflows/coordinator.md)
  - focus selection, deferred actor digestion, actor task payloads, and adjudication
- [`workflows/finalization.md`](./workflows/finalization.md)
  - report payloads, timeline anchoring, report projection building, and markdown assembly

## Projection Vocabulary

- `prompt projection`
  - an in-memory compact view derived from rich workflow state before one LLM call
- `report projection`
  - the persisted finalization artifact in `report_projection_json` used for report writing

## Documentation Conventions

- “current compiled graph” means the path wired by `*_SUBGRAPH` and `SIMULATION_WORKFLOW`
  today, not every prompt or helper module present in the tree
- workflow docs describe inputs and outputs at the state-channel level instead of repeating
  every implementation detail from the code
- runtime/generation/coordinator prompt inputs are documented as compact prompt projections,
  not as persisted workflow channels
- file outputs such as `final_report.md` are documented separately from state outputs because
  they are written after the workflow returns
