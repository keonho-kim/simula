# Analysis

`simula` writes analysis artifacts beside the run that produced them. Analysis is derived from the
same durable trace used for inspection and reporting.

## Source Of Truth

`simulation.log.jsonl` is the source artifact for analysis.

It contains the ordered runtime event stream, including model calls, planning results, actor
registry, round activity, event-memory updates, observer reports, and final report metadata.

Because analysis is derived from this event stream, saved runs can be inspected and compared after
the simulation has completed.

## Output Layout

Each completed run may contain:

```text
output/
  <run_id>/
    simulation.log.jsonl
    manifest.json
    report.final.md
    summary.overview.md
    data/
      llm_calls.csv
      performance.summary.csv
      token_usage.summary.csv
      actions.summary.csv
      network.nodes.csv
      network.edges.csv
      network.growth.csv
      network.summary.json
    summaries/
      token_usage.summary.md
      network.summary.md
    assets/
      performance.summary.png
      network.graph.png
      network.graph.graphml
      network.growth_metrics.png
      network.concentration.png
      network.growth.mp4
```

Committed example runs use the same shape under `output.samples/`.

## Metrics

The analysis layer focuses on run comparability.

It can summarize:

- model-call timing and usage
- actor participation
- action type diversity
- interaction volume
- source and target concentration
- relationship graph structure
- path depth and reachability
- community structure
- cumulative network growth

These metrics make it easier to compare scenarios, model configurations, and repeated trials.

## Manifest

`manifest.json` is the run-level index.

It records:

- run identity and status
- start and end timestamps
- scenario metadata
- redacted configuration summary
- produced artifact paths
- event count
- model-call count
- roles observed in the run
- error text for failed runs

Failed runs may still keep `simulation.log.jsonl` and `manifest.json` even when derived analysis
artifacts are incomplete.

## Reading A Run

For human inspection, start with:

1. `summary.overview.md`
2. `report.final.md`
3. `summaries/network.summary.md`
4. `simulation.log.jsonl`

For comparison across runs, start with the tables in `data/` and the visuals in `assets/`.

## Related Docs

- runtime log contract: [`contracts.md`](./contracts.md)
- operational artifact notes: [`operations.md`](./operations.md)
