# LangGraph Durable Execution

Use this file when a graph must resume after interruption, tolerate retries, or replay work safely.

## Standard implementation pattern

- Compile the graph with a checkpointer.
- Run with a stable `thread_id` in the configurable runtime config.
- Make node behavior replay-safe.
- Isolate side effects so replay does not duplicate writes or irreversible actions.
- Keep non-deterministic work explicit and bounded.

## Replay-safety rules

- Split “compute next state” from “perform external side effect” when replay matters.
- Make external writes idempotent, keyed, or explicitly guarded.
- Do not hide randomness, time-based branching, or network writes in reducers.
- Treat checkpointed thread state as durable control flow, not as a cache for arbitrary large payloads.

## Recommended do / don't

- Do use durable execution for long-running, resumable, or human-in-the-loop workflows.
- Do define a thread identity strategy up front.
- Do document which nodes are safe to replay and which side effects must be deduplicated.
- Do not assume “checkpointed” means “every side effect is safe”.
- Do not use durable execution as a substitute for explicit application-level idempotency.

## Practical notes

- Moving from an in-memory checkpointer to a durable backend changes operational behavior and replay expectations.
- If the workflow starts mutating external systems beyond chat history storage, move side-effect ownership into clearly identified nodes or service helpers with idempotency guards.

## Official sources

- https://docs.langchain.com/oss/python/langgraph/durable-execution
- https://docs.langchain.com/oss/python/langgraph/add-memory
