# Known limitations

- Phase 5 supports local PNG, JPEG, and browser-decodable WebP import, blank documents, viewport navigation, isolated PNG export, nested raster layers and groups, pointer move, keyboard nudge, affine layer transforms, a full-layer 3 x 3 raster warp, and bounded undo/redo.
- The renderer rebuilds the Fabric scene after structural edits. Phase 6 must replace this coarse path for high-frequency raster invalidation.
- Phase 5 raster history stores complete before/after snapshots for each warp. This is exact and byte-accounted but intentionally temporary; Phase 6 must introduce dirty tile patches and release buffers after their final retained transaction is evicted.
- Warp currently affects one entire active raster layer. Selection-bounded transforms remain disabled until Phase 8 provides the selection mask store.
- Vector layers, selection, paint, shapes, crop, resize, recovery, and JPEG export arrive in later gated phases.
- The Soft Technical shell and Phase 5 transform workflow still require the real-browser checks in `Browser_Test.md`.
- The Phase 1 browser harness does not select an Object Selection engine. It still needs five approved local photos and a second candidate with a quantized lazy-loaded segmentation model.
- Mobile and tablet layouts are not v1 targets.
