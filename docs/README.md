# Documentation

This directory documents the product model, workflow behavior, and durable artifacts of `simula`.
It avoids language-specific setup and implementation framework details.

## Suggested Reading Paths

| Goal | Start here | Then read |
| --- | --- | --- |
| Understand the product model | [`../README.md`](../README.md) | [`architecture.md`](./architecture.md) |
| Understand actor and event concepts | [`contracts.md`](./contracts.md) | [`workflows/runtime.md`](./workflows/runtime.md) |
| Understand the end-to-end flow | [`workflows/README.md`](./workflows/README.md) | the stage document you need |
| Understand model-backed behavior | [`llm.md`](./llm.md) | [`contracts.md`](./contracts.md) |
| Understand saved run artifacts | [`analysis.md`](./analysis.md) | [`operations.md`](./operations.md) |
| Understand configuration concepts | [`configuration.md`](./configuration.md) | [`operations.md`](./operations.md) |

## Document Map

| Document | Owns |
| --- | --- |
| [`../README.md`](../README.md) | project framing, core concepts, and high-level flow |
| [`architecture.md`](./architecture.md) | system boundaries, stage responsibilities, and artifact flow |
| [`contracts.md`](./contracts.md) | scenario, actor, state, event, report, and log contracts |
| [`llm.md`](./llm.md) | model roles, structured output expectations, validation, and logs |
| [`analysis.md`](./analysis.md) | analysis source data, metrics, summaries, and visual artifacts |
| [`configuration.md`](./configuration.md) | settings concepts and precedence without runtime-specific commands |
| [`operations.md`](./operations.md) | scenario controls, output layout, repeated trials, and maintenance notes |
| [`workflows/README.md`](./workflows/README.md) | workflow overview and cross-stage handoffs |
| [`workflows/planning.md`](./workflows/planning.md) | scenario interpretation and execution-plan construction |
| [`workflows/generation.md`](./workflows/generation.md) | actor-card generation from planned cast slots |
| [`workflows/runtime.md`](./workflows/runtime.md) | simulation rounds, event selection, actor actions, and stop behavior |
| [`workflows/finalization.md`](./workflows/finalization.md) | final report projection and markdown assembly |
| [`workflows/simulation.md`](./workflows/simulation.md) | root workflow boundary and stage ownership |

## Conventions

- These docs describe current product behavior, not historical implementation details.
- Concepts and artifact names are stable unless a product contract changes.
- Workflow docs describe behavior at the stage level rather than internal function names.
- `output/` means the live run output root. `output.samples/` means committed reference runs kept
  in the repository for inspection.
