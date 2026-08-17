# LiteEdit

LiteEdit is a desktop-first, browser-local photo editor. The Worker serves static application assets. Image decoding, editing, history, and export stay on the user's device.

## Current status

Phase 0 through Phase 2 are merged into `main`. The current application provides the accessible industrial shell, local font assets, keyboard shortcut routing, reusable UI primitives, a development-only component gallery, and a development-only real-browser Phase 1 spike harness. The Fabric, raster, warp, history, and JPEG harnesses now require manual confirmation. Object Selection remains gated on five approved photos and a second local segmentation candidate.

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

The component gallery is available at `/__gallery` while running `npm run dev`. The Phase 1 browser harness is available at `/__spikes/phase1`.

Use Node `24.19.0` for local development. Do not commit `.env`, `.dev.vars`, credentials, account IDs, or image fixtures with restricted rights.

## Deployment target

The production target is `https://liteedit.charliepolito.com`. Cloudflare Workers Static Assets serves the built SPA. v1 has no API, database, object storage, account system, or server-side image processing.

See [the build plan](BUILD_PLAN.md), [architecture notes](docs/architecture.md), and [deployment runbook](docs/deployment.md).
