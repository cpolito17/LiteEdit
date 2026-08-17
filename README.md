# LiteEdit

LiteEdit is a desktop-first, browser-local photo editor. The Worker serves static application assets. Image decoding, editing, history, and export stay on the user's device.

## Current status

Phase 0 bootstrap is implemented in draft PR #1. Phase 1 risk spikes are in draft PR #2, with the real-browser visual and five-photo object-selection gate still open. Phase 2 industrial shell work is in draft PR #3. The current application provides the accessible shell, local font assets, keyboard shortcut routing, reusable UI primitives, and a development-only component gallery; editor behavior remains gated for later phases.

## Development

```bash
npm ci
npm run dev
```

Run the local checks:

```bash
npm run verify
npm run test:e2e
npm run cf:dry-run
```

The component gallery is available at `/__gallery` while running `npm run dev`.

Use Node `24.19.0` for local development. Do not commit `.env`, `.dev.vars`, credentials, account IDs, or image fixtures with restricted rights.

## Deployment target

The production target is `https://liteedit.charliepolito.com`. Cloudflare Workers Static Assets serves the built SPA. v1 has no API, database, object storage, account system, or server-side image processing.

See [the build plan](BUILD_PLAN.md), [architecture notes](docs/architecture.md), and [deployment runbook](docs/deployment.md).
