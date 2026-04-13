# FastAPI Testing Guidance

Use this file when deciding where and how to test the HTTP boundary.

## Standard implementation pattern

- Use `TestClient` for HTTP contract tests.
- Use the client as a context manager when lifespan behavior matters.
- Override dependencies through `app.dependency_overrides` rather than patching deep internals when the goal is HTTP-surface verification.
- Keep API tests focused on request validation, response shape, status mapping, and lifecycle behavior.

## Recommended do / don't

- Do test through the route surface for HTTP contracts.
- Do keep fixtures small and aligned with one API slice.
- Do use dependency overrides for external clients or expensive runtime services.
- Do not rebuild business logic assertions in API tests if service-level or graph-level tests already own them.
- Do not skip lifespan behavior when startup wiring materially affects correctness.

## Practical notes

- Treat end-to-end tests as contract and smoke coverage for the public surface.
- Prefer targeted tests for the touched route family before broader E2E runs.
- When an endpoint depends on startup-managed resources, use a lifespan-aware client setup so you test the real wiring path.

## Official sources

- https://fastapi.tiangolo.com/tutorial/testing/
- https://fastapi.tiangolo.com/advanced/testing-events/
- https://fastapi.tiangolo.com/tutorial/dependencies/
