# FastAPI Dependencies And Lifespan

Use this file when adding request-scoped dependencies, app-wide resources, or cleanup behavior.

## Standard implementation pattern

- Use `Depends(...)` for request-scoped wiring.
- Use dependency functions with `yield` when the resource must be created and cleaned up per request.
- Use the application lifespan for app-wide resources such as long-lived clients, queues, or service singletons.
- Keep resource ownership obvious: request-scoped resources belong in dependencies; application-scoped resources belong in lifespan-managed runtime wiring.

## Recommended do / don't

- Do create long-lived resources once and shut them down in lifespan.
- Do pass fully built runtime services into routers instead of rebuilding them per request.
- Do use `yield` dependencies when cleanup must always run after the request.
- Do not mix request-scoped and app-scoped ownership in the same helper unless the contract is explicit.
- Do not rely on import-time side effects for resources that need shutdown.
- Do not add global mutable singletons when lifespan ownership would be clearer.

## Practical notes

- Load configuration before importing modules that consume import-time settings.
- Keep app-level lifespan behavior in one composition owner.
- If a new integration client must be reused, wire it through an API runtime helper or lifespan-managed service, then inject it downward.

## Compatibility notes

- The official docs treat lifespan as the preferred pattern for startup and shutdown over older `startup` and `shutdown` events for new code.
- If the lock version and upstream docs diverge, keep the lifespan-based pattern unless an existing slice is intentionally still on the event hook path.

## Official sources

- https://fastapi.tiangolo.com/tutorial/dependencies/
- https://fastapi.tiangolo.com/advanced/advanced-dependencies/
- https://fastapi.tiangolo.com/advanced/events/
