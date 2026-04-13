# Generation Workflow

## Purpose

Generation turns the planning cast roster into concrete actor cards.

## Active Path

```mermaid
flowchart LR
    Start([START]) --> Prepare["prepare_actor_slots"]
    Prepare --> FanOut["dispatch_actor_slots"]
    FanOut --> Worker["generate_actor_slot"]
    Worker --> Finalize["finalize_generated_actors"]
    Finalize --> End([END])
```

`dispatch_actor_slots` is the conditional fan-out edge used by the generation subgraph.

## Node Responsibilities

### `prepare_actor_slots`

Builds one slot per cast roster item and resets generation-local buffers.

### `generate_actor_slot`

Uses the `generator` role to produce one required `ActorCard` from:

- compact interpretation view
- compact situation view
- compact action catalog view
- compact coordination frame view
- one cast item

### `finalize_generated_actors`

Orders results by slot index, materializes the final actor list, initializes feeds, persists the
cast, and records generation latency.

## Stage Output

After generation, workflow state has:

- `actors`
- `activity_feeds`
- `generation_latency_seconds`

The slot-level scratch fields are no longer needed by downstream stages.
