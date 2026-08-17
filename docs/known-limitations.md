# Known limitations

- Phase 3 supports local PNG, JPEG, and browser-decodable WebP import, blank documents, viewport navigation, and unchanged-document PNG export. Pixel editing is not implemented yet.
- The current document model has one imported or background raster layer. Layer editing, history, selection, paint, shapes, transforms, crop, and resize arrive in later gated phases.
- The Phase 3 shell self-hosts IBM Plex Mono and uses the Soft Technical visual system; the browser test plan still requires real-browser confirmation of local import, export, and navigation.
- The Phase 1 browser harness does not select an Object Selection engine. It still needs five approved local photos and a second candidate with a quantized lazy-loaded segmentation model.
- Mobile and tablet layouts are not v1 targets.
