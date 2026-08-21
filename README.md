# LiteEdit

LiteEdit is a desktop-first, browser-local photo editor. The Worker serves static application assets. Image decoding, editing, history, and export stay on the user's device.

## Current status

LiteEdit v1 is implemented as a browser-local release candidate. It includes raster brush and eraser tools with dirty-tile history, composite color picking and persistent swatches, vector shapes and rasterization, marquee/lasso/quick/object selection, selection-aware editing, crop and document resize, PNG/JPEG export with JPEG target-size search, IndexedDB recovery, diagnostics, and memory/history instrumentation. The Phase 0-5 import, layer, affine-transform, warp, and bounded-history workflows remain available.

All image decoding, pixel editing, recovery, and export remain on the device. The only unresolved acceptance gate is the real-photo Object Selection benchmark: five approved local photos are still required to certify the provisional lazy-loaded foreground extractor at four-of-five successful isolations under two seconds. See [known limitations](docs/known-limitations.md).

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

See [the build plan](BUILD_PLAN.md), [v1 release notes](docs/release-v1.md), [design system](docs/design-system.md), [architecture notes](docs/architecture.md), and [deployment runbook](docs/deployment.md).
