# Documentation

This documentation set describes the current compiled workflow only. Each document owns one
layer of detail so the same concept is not explained in five places.

## Reading Order

| Goal | Start here | Then read |
| --- | --- | --- |
| Understand the project quickly | [`../README.md`](../README.md) | [`architecture.md`](./architecture.md) |
| Understand graph boundaries | [`architecture.md`](./architecture.md) | [`contracts.md`](./contracts.md) |
| Understand stage handoffs | [`workflows/README.md`](./workflows/README.md) | the stage document you need |
| Change prompts or model routing | [`llm.md`](./llm.md) | the matching workflow doc |
| Run locally and validate changes | [`operations.md`](./operations.md) | [`contracts.md`](./contracts.md) |

## Document Roles

| Document | Owns |
| --- | --- |
| [`../README.md`](../README.md) | project pitch, quick start, high-level flow |
| [`architecture.md`](./architecture.md) | layers, execution path, state/runtime boundaries |
| [`contracts.md`](./contracts.md) | public I/O, internal state groups, structured contracts, artifacts |
| [`llm.md`](./llm.md) | model roles, prompt projections, structured-output policy |
| [`operations.md`](./operations.md) | commands, validation, outputs, maintenance |
| [`workflows/README.md`](./workflows/README.md) | workflow hub and stage handoffs |
| [`workflows/simulation.md`](./workflows/simulation.md) | root graph assembly and hydration |
| [`workflows/planning.md`](./workflows/planning.md) | compact planning path |
| [`workflows/generation.md`](./workflows/generation.md) | actor generation fan-out/fan-in |
| [`workflows/runtime.md`](./workflows/runtime.md) | runtime loop and step resolution |
| [`workflows/finalization.md`](./workflows/finalization.md) | report finalization path |

## Rules

- These docs follow the compiled graph, not historical module layout.
- Workflow docs use active node names.
- `README.md` stays product-oriented; `docs/` holds the implementation detail.
