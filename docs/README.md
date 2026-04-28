# Documentation

This directory documents the current Bun/TypeScript implementation of `simula`: the local API
server, React client, core simulation workflow, settings model, and run artifacts.

## Suggested Reading Paths

| Goal | Start here | Then read |
| --- | --- | --- |
| Run the system locally | [`../README.md`](../README.md) | [`operations.md`](./operations.md) |
| Understand the code boundaries | [`architecture.md`](./architecture.md) | [`contracts.md`](./contracts.md) |
| Configure model roles | [`configuration.md`](./configuration.md) | [`llm.md`](./llm.md) |
| Understand one workflow stage | [`workflows/README.md`](./workflows/README.md) | the stage document you need |
| Inspect saved runs | [`operations.md`](./operations.md) | [`analysis.md`](./analysis.md) |

## Document Map

| Document | Owns |
| --- | --- |
| [`../README.md`](../README.md) | project framing, quick start, API, and validation commands |
| [`architecture.md`](./architecture.md) | package boundaries, server/client split, persistence, and streaming |
| [`contracts.md`](./contracts.md) | scenario, settings, run, event, state, timeline, and export contracts |
| [`configuration.md`](./configuration.md) | settings resolution, provider defaults, and environment variables |
| [`llm.md`](./llm.md) | model roles, provider support, metrics, retry, and repair behavior |
| [`analysis.md`](./analysis.md) | current inspection artifacts and reference sample-output notes |
| [`operations.md`](./operations.md) | local execution, scenario controls, run artifacts, and maintenance |
| [`workflows/README.md`](./workflows/README.md) | workflow overview and cross-stage handoffs |
| [`workflows/planning.md`](./workflows/planning.md) | scenario interpretation and plan construction |
| [`workflows/generation.md`](./workflows/generation.md) | roster and actor-card generation |
| [`workflows/runtime.md`](./workflows/runtime.md) | round execution, events, graph timeline, and stop behavior |
| [`workflows/finalization.md`](./workflows/finalization.md) | report rendering and completed state persistence |
| [`workflows/simulation.md`](./workflows/simulation.md) | root simulation graph and server execution boundary |

## Conventions

- `runs/` is the default live run artifact root.
- `output.samples/` contains committed reference outputs and is not the live output path.
- Documentation names public routes, files, and types only when that precision prevents ambiguity.
- Workflow docs describe product-stage responsibilities rather than every internal helper.
