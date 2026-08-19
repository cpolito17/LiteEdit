# LiteEdit

LiteEdit is a desktop-first, browser-local photo editor. The Worker serves static application assets. Image decoding, editing, history, and export stay on the user's device.

## Current status

Phase 0 through Phase 4 are implemented. The current application provides the accessible soft technical shell, local PNG/JPEG/WebP import, blank documents, Fabric-backed viewport navigation, isolated unchanged-document PNG export, nested raster layer groups, visibility, lock, opacity, ordering, duplication, deletion, drag hierarchy, and bounded structural undo/redo with a visible History panel. The layer model and raster sources remain local to the browser.

Raster painting, transforms, warp, selection-aware editing, crop, resize, recovery, and JPEG export still require later phases. Object Selection remains gated on five approved photos and a second local segmentation candidate.

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

See [the build plan](BUILD_PLAN.md), [design system](docs/design-system.md), [architecture notes](docs/architecture.md), and [deployment runbook](docs/deployment.md).
