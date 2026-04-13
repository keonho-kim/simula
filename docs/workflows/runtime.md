# Runtime Workflow

## Purpose

Runtime is the only looping stage. It chooses the next focus, fans out actor proposals, resolves
the round, and decides whether to continue.

## Active Path

```mermaid
flowchart TD
    Start([START]) --> Init["initialize_runtime_state"]
    Init --> Prepare["prepare_round"]
    Prepare --> Plan["plan_round"]
    Plan --> FanOut["generate_actor_proposal*"]
    FanOut --> Reduce["reduce_actor_proposals"]
    Reduce --> Resolve["resolve_round"]
    Resolve --> Route{"stop?"}
    Route -->|continue| Prepare
    Route -->|complete| End([END])
```

`generate_actor_proposal*` fans out once per selected actor in the current round.

## Node Responsibilities

### `initialize_runtime_state`

Normalizes runtime counters and ensures the runtime loop starts from a clean state.

### `prepare_round`

Advances `round_index`, compresses focus candidates, resets current-round scratch fields, and
starts round timing.

### `plan_round`

Generates one `RoundDirective` bundle:

- focus summary
- selection reason
- selected actor ids
- deferred actor ids
- focus slices
- background updates

It also appends the directive to `round_focus_history`.

### `generate_actor_proposal`

Generates one `ActorActionProposal` for one selected actor from compact runtime inputs.

### `reduce_actor_proposals`

Restores deterministic actor order after fan-in.

### `resolve_round`

Generates one `RoundResolution` bundle, applies adopted actions, advances the simulation clock,
writes observer output, persists round artifacts, and sets stop state.

## Stop Behavior

The runtime loop ends when either:

- the resolution explicitly returns a non-empty `stop_reason`
- the runtime policy decides to stop, such as reaching `max_rounds`

## Stage Output

Runtime leaves behind the full execution trace used by finalization:

- `activities`
- `observer_reports`
- `round_focus_history`
- `round_time_history`
- `background_updates`
- `world_state_summary`
- `stop_reason`
