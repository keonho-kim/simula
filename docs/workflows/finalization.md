# Finalization Workflow

Finalization turns completed simulation state into a Markdown report.

## Responsibilities

Finalization:

- renders the current report projection
- emits a final `report.delta`
- completes the `finalization` node
- returns `SimulationState` with `reportMarkdown`

The server writes the completed state to `state.json` and the Markdown report to `report.md`.

## Report Shape

The rendered report currently includes sections such as:

- scenario digest
- actor cards
- round digests
- round reports
- role traces

The report is a projection of completed workflow state. It should not introduce outcomes that were
not represented in state.

## Artifacts

Finalization contributes to:

```text
runs/<run_id>/
  state.json
  report.md
  events.jsonl
```

The server updates `manifest.json` after the workflow completes.

## Related Docs

- runtime: [`runtime.md`](./runtime.md)
- contracts: [`../contracts.md`](../contracts.md)
