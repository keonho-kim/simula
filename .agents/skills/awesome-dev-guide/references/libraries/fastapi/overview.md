# FastAPI Guidance

Use this folder when the change affects application structure, routers, dependency injection, error handling, startup or shutdown, HTTP streaming, or API testing.

## Version baseline used in this repo

- FastAPI lock version: `0.135.1`
- Treat the official docs as the primary source of truth.
- If an example from newer docs uses an API shape that differs from `0.135.x`, keep the repository on the lock-compatible pattern unless the user asked to upgrade.

## When to read FastAPI guidance

Read this folder whenever the change affects:

- app composition
- router structure
- API DTOs and mappers
- dependency wiring
- lifespan setup
- HTTP-focused tests

## Topic map

- `application-structure.md`: app composition, `APIRouter`, static mounts, package layout
- `dependencies-and-lifespan.md`: `Depends`, `yield`, app-wide resources, startup/shutdown
- `errors-responses-and-streaming.md`: error mapping, custom responses, `StreamingResponse`, SSE boundaries
- `testing.md`: `TestClient`, dependency overrides, lifespan-aware tests

## Standard selection rules

- New endpoint family: extend an existing bounded router package before creating a new top-level API subtree.
- New startup or runtime dependency: wire it in the app composition layer or dedicated runtime helpers, not in unrelated routers.
- New error mapping: keep translation close to the HTTP boundary instead of duplicating it per endpoint.
- New streaming endpoint: decide whether it is plain chunked HTTP, SSE, or websocket before writing the handler. The response contract should be explicit at the router layer.

## Official sources

- https://fastapi.tiangolo.com/tutorial/bigger-applications/
- https://fastapi.tiangolo.com/tutorial/static-files/
- https://fastapi.tiangolo.com/tutorial/dependencies/
- https://fastapi.tiangolo.com/advanced/advanced-dependencies/
- https://fastapi.tiangolo.com/advanced/events/
- https://fastapi.tiangolo.com/tutorial/handling-errors/
- https://fastapi.tiangolo.com/advanced/custom-response/
- https://fastapi.tiangolo.com/tutorial/testing/
- https://fastapi.tiangolo.com/advanced/testing-events/
