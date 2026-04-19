# Documentation

This directory documents the code in `src/`, the CLI surface, and the run artifacts written by
the application.

## Suggested Reading Paths

| Goal | Start here | Then read |
| --- | --- | --- |
| Configure models, storage, and checkpoints | [`configuration.md`](./configuration.md) | [`operations.md`](./operations.md) |
| Run the simulator locally | [`operations.md`](./operations.md) | [`workflows/README.md`](./workflows/README.md) |
| Inspect committed sample run artifacts | [`operations.md`](./operations.md) | [`analysis.md`](./analysis.md) |
| Understand system boundaries | [`architecture.md`](./architecture.md) | [`contracts.md`](./contracts.md) |
| Understand one workflow stage | [`workflows/README.md`](./workflows/README.md) | the stage document you need |
| Understand model roles, retries, and logging | [`llm.md`](./llm.md) | the matching workflow doc |
| Inspect saved runs and integrated analysis output | [`analysis.md`](./analysis.md) | [`operations.md`](./operations.md) |

## Document Map

| Document | Owns |
| --- | --- |
| [`../README.md`](../README.md) | project pitch, quick start, and high-level flow |
| [`configuration.md`](./configuration.md) | settings resolution, `env.toml` shape, provider rules, storage, checkpoints |
| [`operations.md`](./operations.md) | CLI usage, scenario input rules, bootstrap commands, validation, output directories |
| [`architecture.md`](./architecture.md) | execution path, layer boundaries, LangGraph integration, persistence split |
| [`contracts.md`](./contracts.md) | public state surfaces, runtime context, structured outputs, durable artifacts |
| [`llm.md`](./llm.md) | role routing, provider support, validation, retries, and call logging |
| [`analysis.md`](./analysis.md) | integrated analysis pipeline, artifact layout, localized outputs, failure behavior |
| [`workflows/README.md`](./workflows/README.md) | workflow hub and cross-stage handoffs |
| [`workflows/simulation.md`](./workflows/simulation.md) | root graph boundary, hydration, and execution stream surface |
| [`workflows/planning.md`](./workflows/planning.md) | scenario analysis, plan construction, and planning validation |
| [`workflows/generation.md`](./workflows/generation.md) | actor generation flow and serial/parallel variants |
| [`workflows/runtime.md`](./workflows/runtime.md) | round loop, branching, event gating, and runtime trace building |
| [`workflows/finalization.md`](./workflows/finalization.md) | final report projection, section writing, and markdown assembly |

## Conventions

- These docs describe the current codebase, not historical experiments.
- Workflow docs use the current stage and node names from the graph definitions.
- Unless noted otherwise, workflow docs describe the default serial graph variants.
- `docs/` stays implementation-oriented. Product framing stays in the root `README.md`.
- Configuration, storage, and artifact descriptions follow current code behavior.
- `output/` means the live runtime output root. `output.samples/` means committed sample runs kept
  in the repository for inspection.
