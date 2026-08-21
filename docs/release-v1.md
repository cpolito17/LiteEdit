# LiteEdit v1 release candidate

## Included

- Raster brush and eraser with pressure-aware stamps, interpolation, zoom-aware cursors, selection clipping, and one dirty-tile history transaction per stroke.
- Composite picker, foreground/background colors, recent colors, and locally persistent swatches.
- Rectangle, ellipse, triangle, polygon, star, line, and arrow vector layers with fill, stroke, constrained/center drawing, and root-layer rasterization.
- Marquee, lasso, Quick Selection, provisional Object Selection, Boolean mask operations, selection-aware paint/clear/lift/crop/export, worker cancellation, and stale-result protection.
- Crop presets and numeric bounds, destructive document resize modes, isolated PNG/JPEG export, JPEG matte/quality/target-size search, normalized filenames, and revoked download URLs.
- Versioned IndexedDB recovery, restore/discard/corrupt-data fallback, React error boundary, local diagnostic export, heap telemetry where available, and byte-accounted history limits.

## Verification commands

```bash
npm ci
npm run verify
npm run test:e2e
npm run cf:dry-run
```

The automated suite covers deterministic raster hashes, shape geometry, mask combinations, crop/resize dimensions, JPEG search bounds, recovery helpers, and a Chromium critical workflow. Manual browser, accessibility, privacy, performance, and production checks remain recorded in `Browser_Test.md`.

## Open evidence gate

Object Selection is not certified until five approved representative photos produce at least four acceptable foreground isolations within two seconds on the recorded reference computer. The fixtures remain local and must not be committed without confirmed rights.
