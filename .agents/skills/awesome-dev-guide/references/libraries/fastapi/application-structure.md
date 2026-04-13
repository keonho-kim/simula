# FastAPI Application Structure

Use this file when deciding how to place routers, compose the app, or grow the API surface without turning `main.py` into a monolith.

## Standard implementation pattern

- Keep a single import-stable app entrypoint.
- Use `APIRouter` per API slice or bounded feature area.
- Compose the app in one place with `app = FastAPI(...)`, `app.mount(...)`, and `app.include_router(...)`.
- Keep route modules thin: validate input, call a service, translate errors, return DTOs.
- Prefer package-level routers such as `api/chat/routers` and `api/ui/routers` over one giant router file.

## Recommended do / don't

- Do keep `main.py` focused on composition and lifespan.
- Do register routers explicitly so the HTTP surface is easy to audit.
- Do keep static mounts and redirects close to app composition.
- Do not hide route registration in side-effectful imports.
- Do not place repository or provider initialization directly inside handlers.
- Do not split one small feature across many top-level packages unless there is a real boundary.

## Framework fit notes

- Keep the public app import path stable even if the internal composition lives in a different module.
- Extend an existing bounded router package before inventing another top-level API package.
- Keep API request and response models near the owning HTTP slice, not in unrelated shared or domain packages.

## Compatibility notes

- The official docs increasingly emphasize package-based layouts over older single-file examples. Prefer the package-based layout here.
- Static file serving is part of the app composition layer, not a special case that justifies a separate startup path.

## Official sources

- https://fastapi.tiangolo.com/tutorial/bigger-applications/
- https://fastapi.tiangolo.com/tutorial/static-files/
