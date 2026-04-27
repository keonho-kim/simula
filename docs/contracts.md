# Contracts

This document describes the product-level data contracts used by `simula`. The contracts are
language-neutral: they describe the shape and meaning of simulation data rather than a specific
implementation.

## Scenario Contract

A scenario provides the starting pressure for a run.

It contains:

- scenario body: the human-written situation to simulate
- requested cast size: the intended number of actors
- cast flexibility: whether additional actors may be introduced when the scenario requires them
- optional time framing: dates, deadlines, or phase hints that influence the simulation clock

The scenario should define a concrete situation with enough conflict, uncertainty, or coordination
pressure for actors to make meaningful moves.

## Actor Contract

An actor is a stateful participant in the virtual world.

An actor contains:

- stable id
- display name
- role in the scenario
- narrative profile
- private goal
- voice or behavioral style
- preferred action types
- current intent
- memory of recent relevant events
- relationship signals with other actors

Actors are not just names in a prompt. Their state is carried through the run so later rounds can
react to earlier actions.

## Plan Contract

The execution plan is the bridge between scenario interpretation and runtime behavior.

It contains:

- scenario interpretation
- situation model
- progression plan
- action catalog
- coordination frame
- cast roster
- major events

The plan must be internally consistent. Cast ids should be stable, major events should reference
known actors, and event completion rules should use known action types.

## World State Contract

World state is the accumulated simulation state visible to runtime decisions.

It includes:

- current round index and simulation clock
- current world summary
- actor registry
- latest and historical activities
- actor-facing feeds
- observer reports
- actor intent states
- intent history
- event memory
- event-memory history
- explicit errors and defaults

World state is intentionally separate from model clients, storage connections, and logging systems.

## Event Memory Contract

Event memory tracks the major event plan during runtime.

It records:

- event ids and current event status
- earliest and latest useful rounds
- required and optional events
- next, overdue, completed, and missed event ids
- progress summaries
- whether unresolved required events keep the run open

Runtime uses event memory to select focus, update progress, and decide whether the simulation can
end.

## Interaction Contract

Interactions are durable activity records created during runtime.

An interaction may represent:

- a message
- a decision
- a negotiation move
- a public action
- a private action with visible consequences
- a reaction to another actor
- an event-level state change

Each accepted interaction should identify its source actor when applicable, target actors or world
targets when applicable, action type, intent, visible detail, and effect on the selected event.

## Runtime Log Contract

`simulation.log.jsonl` is an ordered append-only event stream.

It records:

- simulation start
- model call metadata
- finalized plan
- finalized actors
- selected runtime focus
- time advancement
- adopted interactions
- observer reports
- event-memory updates
- final report metadata
- usage summaries

Every row includes enough identity and event information to support replay, inspection, and
analysis.

## Final Report Contract

The final report explains the completed run.

It includes:

- scenario framing
- simulation conclusion
- actor outcomes
- timeline
- actor dynamics
- major event progression
- activity totals
- stop reason
- explicit errors or defaults
- usage summary

The report is a projection of the completed trace. It should not introduce unsupported outcomes
that were not represented in runtime state.

## Failure And Default Policy

`simula` favors explicit failure or explicit defaults.

- Planning and actor generation should fail when required structured data cannot be recovered.
- Runtime may use explicit default behavior only when that behavior is recorded in errors and logs.
- Final report generation should fail when the completed trace cannot be projected into the report
  contract.
- Silent degradation is not part of the contract.

## Related Docs

- architecture: [`architecture.md`](./architecture.md)
- model roles and validation: [`llm.md`](./llm.md)
- workflow stages: [`workflows/README.md`](./workflows/README.md)
