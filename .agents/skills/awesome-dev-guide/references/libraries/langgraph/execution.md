# LangGraph Execution and State Transitions

LangGraph primitives used often for execution flow, fan-out, state accumulation, and durable execution.

## 1. `Send`

### When To Use It

- When building a map-reduce style graph that needs fan-out
- When passing different state slices into each branch

### Minimal Usage Rules

- Apply an upper bound to the input list before fan-out.
- Keep branch payloads small and independent.
- Include identifiers so fan-in can merge the results later.

### When To Avoid It

- When the branch count is always one
- When payloads are so large that fan-out itself becomes costly

## 2. `Command`

### When To Use It

- When you want to express a state update and the next hop together
- When resuming a graph after human intervention through `resume` input

### Core Forms

- `Command(update=...)`
- `Command(goto=...)`
- `Command(update=..., goto=...)`
- `Command(resume=...)`

### Minimal Usage Rules

- Prefer returning a dict when only a state update is needed.
- Use `Command` only when you need to express branching and updating together.
- Use `resume` only for human-intervention resumption input.

## 3. Reducers

### When To Use Them

- When multiple nodes need to accumulate updates into the same state key
- When gathering fan-out results

### Minimal Usage Rules

- Add reducers only to keys that need accumulation.
- Fix reducer meaning as part of the contract.
- If an empty list is used as an initialization signal, document that rule explicitly.

## 4. Checkpointer

### When To Use It

- When durable execution is required
- When supporting interrupts, resumption, or long-running workflows

### Minimal Usage Rules

- An in-memory saver is enough for development and testing.
- In production, default to a durable checkpointer.
- Graphs that use a checkpointer must be replay-safe.

## 5. `thread_id`

### When To Use It

- For every graph execution that uses a checkpointer
- For resumption after an interrupt
- For session-level state accumulation

### Minimal Usage Rules

- The thread identifier must be stable and reusable.
- Reuse the same `thread_id` when continuing the same workflow.
- Create a new `thread_id` only when starting a new execution.

## 6. Durability

### When To Use It

- For graphs that need long-running execution, human intervention, or restart recovery

### Minimal Usage Rules

- Use stronger durability only on paths where recovery matters.
- Avoid excessive durability on paths where performance is the higher priority.

## 7. Task

### When To Use It

- When separating side effects or nondeterministic work in a replay-safe way

### Minimal Usage Rules

- Wrap only operations such as external API calls, file writes, or random value generation.
- Do not turn pure computation into tasks by default.
- Separate the operations that must not be duplicated during replay first.

## 8. Checklist

1. Do you use `Send` only when fan-out is actually needed?
2. Are you avoiding `Command` when a dict return would be enough?
3. Are reducers accumulating only the keys that require merged state?
4. Did you design the checkpointer and `thread_id` together?
5. Did you identify the side effects that should be isolated as tasks?
