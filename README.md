# LiteEdit

LiteEdit is a desktop-first, browser-local photo editor. The Worker serves static application assets. Image decoding, editing, history, and export stay on the user's device.

## Current status

Phase 0 bootstrap is implemented. The repository currently contains the verified application shell and the toolchain required for the next gated phases. Editor behavior is intentionally not represented by disabled shell controls.

## Development

```bash
npm ci
npm run dev
```

Run the Phase 0 checks:

```bash
npm run verify
npm run test:e2e
npm run cf:dry-run
```

Use Node `24.19.0` for local development. Do not commit `.env`, `.dev.vars`, credentials, account IDs, or image fixtures with restricted rights.

## Deployment target

The production target is `https://liteedit.charliepolito.com`. Cloudflare Workers Static Assets serves the built SPA. v1 has no API, database, object storage, account system, or server-side image processing.

See [the build plan](BUILD_PLAN.md), [architecture notes](docs/architecture.md), and [deployment runbook](docs/deployment.md).
