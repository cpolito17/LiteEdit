# Known limitations

- Phase 4 supports local PNG, JPEG, and browser-decodable WebP import, blank documents, viewport navigation, isolated PNG export, nested raster layers and groups, structural layer commands, and bounded undo/redo. Pixel editing is not implemented yet.
- The renderer rebuilds the Fabric scene after structural edits. Phase 6 must replace this coarse path for high-frequency raster invalidation.
- Deleted and undone raster buffers remain available until the document closes so redo stays exact. Phase 6 history disposal must release buffers when their final transaction is evicted.
- Vector layers, selection, paint, shapes, transforms, crop, resize, recovery, and JPEG export arrive in later gated phases.
- The Soft Technical shell and Phase 4 layer workflow still require the real-browser checks in `Browser_Test.md`.
- The Phase 1 browser harness does not select an Object Selection engine. It still needs five approved local photos and a second candidate with a quantized lazy-loaded segmentation model.
- Mobile and tablet layouts are not v1 targets.
