# FastAPI Errors, Responses, And Streaming

Use this file when changing HTTP error contracts, response classes, or streaming endpoints.

## Standard implementation pattern

- Raise `HTTPException` or translate domain exceptions into HTTP exceptions at the router boundary.
- Use shared exception handlers only when several endpoints truly share the same HTTP mapping policy.
- Use explicit response models for normal JSON APIs.
- Use `StreamingResponse` or SSE endpoints only when the client really needs incremental delivery.
- Keep user-visible streaming event schemas stable and documented.

## Recommended do / don't

- Do keep error-code-to-status translation close to the API layer.
- Do keep streaming payloads small and purpose-built.
- Do return one transport contract per endpoint: plain JSON, chunked streaming, SSE, or websocket.
- Do not leak internal exception types through the HTTP boundary.
- Do not stream full mutable state snapshots if token-level or event-level payloads are sufficient.
- Do not make provider-specific chunk formats part of the public HTTP contract.

## Practical notes

- Extend a boundary-owned error translation pattern instead of duplicating `try/except` blocks everywhere.
- A streaming endpoint is an API contract, not an internal transport detail. If you change streaming semantics, update the public payload, consumers, and docs together.
- Keep SSE serialization rules in the API layer, not inside graph nodes or provider wrappers.

## Compatibility notes

- `StreamingResponse` is a transport primitive. If you want browser event handling semantics, model the endpoint as SSE intentionally instead of treating it as arbitrary bytes.
- If a response must outlive the request body parsing phase, design cleanup carefully so request-scoped dependencies do not close resources too early.

## Official sources

- https://fastapi.tiangolo.com/tutorial/handling-errors/
- https://fastapi.tiangolo.com/advanced/custom-response/
