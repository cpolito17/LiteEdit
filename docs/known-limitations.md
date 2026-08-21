# Known limitations

- Object Selection uses a lazy-loaded, model-free foreground extractor. It is provisional until five approved representative photos establish at least four successful isolations under two seconds on the reference computer. Quick Selection, marquee, and lasso do not depend on that gate.
- Selection lift for move/transform maps the selected raster into document pixels. It is exact for untransformed raster pixels; affine-transformed source pixels are resampled into the floating selection.
- Crop and resize keep raster sources non-destructive and express the operation through document bounds and layer transforms. The selected browser interpolation mode applies during rendering/export rather than rewriting every source buffer.
- JPEG target-size search reports when the requested size cannot be reached at the minimum quality. Automatic proportional dimension reduction remains an explicit user decision.
- Heap reporting depends on the Chromium `performance.memory` extension; other browsers display `MEMORY / N/A`. History byte accounting is available everywhere.
- Automated Chromium end-to-end coverage is included. Firefox, WebKit/Safari, Edge, keyboard-only, reduced-motion, and axe checks remain documented manual release evidence in `Browser_Test.md`.
- The renderer still rebuilds the Fabric scene after structural edits. Live brush strokes update only the active raster backing canvas, avoiding a scene rebuild for each stamp.
- Mobile and tablet layouts are not v1 targets.
