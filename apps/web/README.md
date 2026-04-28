# Simula Web

`apps/web` is the Vite React client for `simula`. It provides the local command surface for:

- editing or loading scenarios
- drafting scenarios with Story Builder
- configuring role-based model settings
- starting simulation runs
- viewing live actor activity and graph replay
- reading and exporting completed reports

## Development

Run the API server and web app from the repository root:

```bash
bun run dev:server
bun run dev:web
```

Or run both with:

```bash
bun run dev
```

The Vite dev server proxies `/api` to `http://localhost:3001` by default. Override the server origin
with:

```bash
SIMULA_API_ORIGIN=http://127.0.0.1:3001 bun --filter @simula/web dev
```

## App Structure

The web app follows the repository's Feature-Sliced Design convention:

| Path | Purpose |
| --- | --- |
| `src/app` | application composition and top-level workflow state |
| `src/widgets` | large simulation surfaces such as activity, actors, graph, replay, and command bar |
| `src/features` | scenario, settings, and report workflows |
| `src/entities` | run-specific domain UI |
| `src/shared` | shared UI utilities |
| `src/store` | cross-cutting Zustand state |
| `src/lib` | API and i18n helpers |

The UI uses React, Tailwind CSS v4, shadcn/ui components, TanStack Query, Zustand, lucide icons,
graphology, and Sigma.

## API Assumptions

The client expects the server routes documented in the root README:

- `/api/settings`
- `/api/story-builder/draft`
- `/api/scenarios/samples`
- `/api/runs`
- `/api/runs/:id/events`
- `/api/runs/:id/report`
- `/api/runs/:id/export`

Run events are streamed through Server-Sent Events. The client subscribes to the known `RunEvent`
types and batches live state updates with `requestAnimationFrame`.

## Localization

The client supports English and Korean UI text. The selected prompt language is also passed into
scenario creation and Story Builder requests so model-facing natural language follows the chosen
locale while machine-readable tokens remain unchanged.

## Validation

From the repository root:

```bash
bun --filter @simula/web typecheck
bun --filter @simula/web lint
bun --filter @simula/web build
```

End-to-end smoke tests are configured at the repository root:

```bash
bun run test:e2e
```
