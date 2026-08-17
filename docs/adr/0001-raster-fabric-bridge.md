# ADR 0001: Raster buffers behind a Fabric image adapter

Status: Proposed after Phase 1 spike

## Decision

Keep raster pixels in per-layer browser canvas buffers owned by a raster buffer store. Represent each raster layer in Fabric with one image object. When a raster layer changes, update the image object's element, mark it dirty, update its coordinates, and request one render.

The document model remains canonical. Fabric objects are a renderer representation and must not own layer order, document IDs, history, or raw pixel state.

## Reasoning

- A canvas-backed raster layer avoids thousands of React or Fabric objects for brush strokes.
- The bridge can invalidate one layer instead of rebuilding the whole scene.
- Pixel buffers stay outside React and Zustand state.
- Fabric remains responsible for viewport transforms and interactive vector objects.

## Evidence

`spikes/raster-bridge.ts` and `spikes/phase1.test.ts` verify the invalidation contract. A browser render test is still required before this ADR becomes accepted.

## Consequences

- The renderer adapter must expose an explicit raster revision and dirty state.
- Export must use a separate static compositor. It must not capture viewport overlays.
- Raster history must store dirty tile patches rather than full-document snapshots.
