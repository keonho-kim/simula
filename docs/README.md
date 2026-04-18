# Documentation

This directory documents the current implementation in `src/`. It follows the compiled
LangGraph workflow, the shipped CLI surface, and the artifacts produced by the application today.

## Suggested Reading Paths

| Goal | Start here | Then read |
| --- | --- | --- |
| Configure models, storage, and checkpoints | [`configuration.md`](./configuration.md) | [`operations.md`](./operations.md) |
| Run the simulator locally | [`operations.md`](./operations.md) | [`workflows/README.md`](./workflows/README.md) |
| Understand system boundaries | [`architecture.md`](./architecture.md) | [`contracts.md`](./contracts.md) |
| Understand one workflow stage | [`workflows/README.md`](./workflows/README.md) | the stage document you need |
| Change prompts, routing, or retry behavior | [`llm.md`](./llm.md) | the matching workflow doc |
| Inspect saved runs and integrated analysis output | [`analysis.md`](./analysis.md) | [`operations.md`](./operations.md) |

## Document Map

| Document | Owns |
| --- | --- |
| [`../README.md`](../README.md) | project pitch, quick start, and high-level flow |
| [`configuration.md`](./configuration.md) | settings resolution, `env.toml` shape, provider rules, storage, checkpoints |
| [`operations.md`](./operations.md) | CLI usage, scenario input rules, bootstrap commands, validation, output directories |
| [`architecture.md`](./architecture.md) | execution path, layer boundaries, LangGraph integration, persistence split |
| [`contracts.md`](./contracts.md) | public state surfaces, runtime context, structured contracts, durable artifacts |
| [`llm.md`](./llm.md) | role routing, provider support, prompt projections, parsing, retries, and raw call logging |
| [`analysis.md`](./analysis.md) | integrated analysis pipeline, artifact layout, localized outputs, failure behavior |
| [`workflows/README.md`](./workflows/README.md) | workflow hub and cross-stage handoffs |
| [`workflows/simulation.md`](./workflows/simulation.md) | root graph boundary, hydration, and execution stream surface |
| [`workflows/planning.md`](./workflows/planning.md) | scenario analysis, plan construction, and planning validation |
| [`workflows/generation.md`](./workflows/generation.md) | actor generation flow and serial/parallel variants |
| [`workflows/runtime.md`](./workflows/runtime.md) | round loop, branching, event gating, and runtime trace building |
| [`workflows/finalization.md`](./workflows/finalization.md) | final report projection, section writing, and markdown assembly |

## Conventions

- These docs describe the active compiled graph, not historical experiments.
- Workflow docs use the active node names from the graph definitions.
- Unless noted otherwise, workflow docs describe the default serial graph variants.
- `docs/` stays implementation-oriented. Product framing stays in the root `README.md`.
- Configuration, storage, and artifact descriptions follow current code behavior even when that
  behavior is stricter than the sample scenario files or older notes.
