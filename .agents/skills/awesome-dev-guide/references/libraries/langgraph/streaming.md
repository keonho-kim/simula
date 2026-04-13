# LangGraph Streaming Guidance

Use this file when user-visible progress, token delivery, or execution telemetry must be streamed incrementally.

## Stream API

### Commonly used modes

| mode | Meaning |
| --- | --- |
| `values` | full state at each step |
| `updates` | state updates at each step |
| `messages` | LLM tokens and metadata |
| `custom` | user-defined events |
| `checkpoints` | checkpoint events |
| `tasks` | task start, finish, result, and error |

### Minimal usage rules

- Limit production UIs mainly to `updates`, `messages`, and `custom`.
- Do not overuse `values` if the full state is not strictly needed.
- Narrow externally visible events again through your own event contract.

## `get_stream_writer`

### When to use it

- When emitting custom events directly inside a node

### Minimal usage rules

- Emit only intermediate outputs with user value.
- Fix event names in the domain language.
- Do not expose internal debug data as-is.

## Event contract principles

- Do not expose the entire internal state directly.
- Expose only policy/branch events and high-value intermediate outputs.
- Expose final natural-language output as `token` and `assistant_message`.
- Remember that as the number of events grows, network and UI complexity also grow.

## Split responsibilities between `messages` and `custom`

- Use `messages` mainly for LLM token streaming.
- Use `custom` for structured events such as review requests, tool start, references, or sql plan.
- Do not emit the same information through both modes.

## Standard implementation pattern

- Choose the smallest stream surface the consumer needs.
- Stream token-level or event-level updates separately from durable state when possible.
- Use LangGraph stream modes intentionally instead of exposing internal state writes by default.
- Use custom stream events with `get_stream_writer` when you need purpose-built progress events.

## Practical stream choices

- Use state-update streaming when the caller needs graph progress by node or state key.
- Use token or message streaming when the caller only needs model output increments.
- Use custom writer events when the caller needs a stable product-specific telemetry contract.
- Use heavier “show me everything” stream modes only for debugging or developer tooling.

## Streaming optimization rules

- Prefer streaming the user-visible payload, not the entire mutable state.
- Keep streamed chunks stable, small, and append-friendly.
- Avoid writing large intermediate blobs to state just to expose them downstream.
- If the consumer only needs token text, stream token text; do not emit full graph snapshots on every chunk.
- Reserve heavier stream modes for debugging, tracing, or developer tooling.

## Recommended do / don't

- Do define one public event contract per caller surface.
- Do keep node names clear because they frequently surface in operational streams.
- Do separate streaming concerns from checkpoint durability concerns.
- Do not leak provider-native chunk shapes directly to the UI.
- Do not let debug-oriented stream data become part of the stable product contract.

## Practical notes

- Preserve a stable public event contract once a caller depends on it.
- If you add a new node that should stream, decide whether it contributes tokens, status updates, or only final state.
- Keep stream serialization close to the execution service or HTTP boundary rather than burying it in reusable nodes.
- If a node needs product-specific progress events, use `get_stream_writer` there and translate that stream once at the service or API boundary.

## Compatibility notes

- LangGraph supports multiple stream styles, including state-oriented updates, token or message streams, and custom writer events. Pick the minimal one that matches the consumer.
- Streaming and durability are related but separate choices. A graph can stream without durable checkpoints, and it can checkpoint without exposing every state write as a public event.

## Checklist

1. Did you keep only events with real user value?
2. Would a narrower mode be enough instead of `values`?
3. Are custom event names stable?
4. Did you separate token streaming from structured events by role?

## Official sources

- https://docs.langchain.com/oss/python/langgraph/streaming
- https://reference.langchain.com/python/langgraph/config/
