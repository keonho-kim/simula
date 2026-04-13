# LangGraph Human-In-The-Loop Primitives

LangGraph primitives used often when designing human intervention flows around `interrupt` and resume.

## 1. `interrupt`

### When To Use It

- When human approval, editing, or supplemental input is required
- When the graph must wait for external input

### Minimal Usage Rules

- Keep payloads serializable.
- Side effects before `interrupt` must be idempotent.
- Do not wrap `interrupt` in a bare `try/except`.
- When using multiple interrupts in one node, keep their order deterministic.

## 2. `Command(resume=...)`

### When To Use It

- When resuming the graph after a human decision

### Minimal Usage Rules

- Keep the resume payload structured.
- Normalize human decisions into tokens such as `approve`, `edit`, and `reject`.
- Resume the same workflow with the same `thread_id`.

## 3. Replay-Safe Resume Rules

- Assume that a node may execute again from the beginning during resumption.
- Side effects before `interrupt` must be replay-safe.
- Split strong side effects into a separate node or move them after `interrupt`.

## 4. Payload Rules

- A human should be able to understand in one view what is being approved or edited.
- Do not provide only free text; use a structured payload.
- Separate the review payload from the human revision payload.

## 5. Checklist

1. Did you choose only the points that truly require `interrupt`?
2. Is the resume input structured?
3. Did you design `thread_id` together with the checkpointer?
4. Are side effects before `interrupt` replay-safe?
5. Is the order of multiple interrupts deterministic?
