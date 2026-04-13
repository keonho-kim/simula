# LangGraph State And Reducers

Use this file when you are adding state keys, changing merge behavior, or designing fan-in after parallel branches.

## Standard implementation pattern

- Define state with a typed schema such as `TypedDict` or a focused Pydantic model.
- Treat every state key as a contract with a stable meaning.
- Use the default overwrite semantics for single-writer keys.
- Add reducers only for keys that intentionally merge updates from multiple nodes or multiple parallel tasks.
- Use `Annotated[..., reducer]` for reducer-backed keys.

## Reducer guidance

- Use overwrite semantics for scalar status, routing, or latest-value fields.
- Use reducers for append-only collections such as partial results or parallel outputs.
- Use `operator.add` or an equivalent reducer only when list concatenation is exactly the intended behavior.
- Use message-aware reducers such as `add_messages` when the state key stores LangChain-style message histories.
- Keep reducer behavior deterministic and cheap. A reducer should merge updates, not perform I/O.

## Recommended do / don't

- Do keep state narrow and intentional.
- Do name keys after business meaning, not node mechanics.
- Do add reducers only where multiple writes are expected.
- Do not put opaque blobs into state if only one small derived value is needed downstream.
- Do not use a reducer to hide an unclear ownership model.

## Practical notes

- If some state keys already carry user-visible meaning, document that meaning and keep it stable.
- When parallel fan-out is introduced, create a dedicated reducer-backed accumulation key instead of reusing an existing scalar key.
- Keep streamed token buffers out of long-lived state unless they are genuinely required for replay or downstream logic.

## Compatibility notes

- Reducers are the key mechanism for map-reduce style LangGraph flows. If the graph can branch in parallel, decide the reducer before writing the target node.
- A reducer is a merge policy, not a substitute for a missing data model.

## Official sources

- https://docs.langchain.com/oss/python/langgraph/use-graph-api
- https://docs.langchain.com/oss/python/langgraph/add-memory
