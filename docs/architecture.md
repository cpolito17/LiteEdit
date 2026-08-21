# Architecture

LiteEdit has two boundaries:

1. Cloudflare serves the static application bundle.
2. The browser owns the document, raster buffers, editor history, and export path.

No imported image bytes are sent to a Worker or third-party service.

The document model is the source of truth. It stores a validated flat node table, root order, group child order, active layer ID, and serializable layer properties. Sibling arrays are bottommost to topmost. The Layers panel reverses them for topmost-first display.

Raster sources live outside the serializable model and are keyed by `bufferId`. Every layer transform is a local-to-parent affine matrix in the serializable model; ancestor matrices left-multiply it to produce the world transform. Fabric.js remains an interactive renderer behind an adapter and reports one committed matrix per move or transform gesture. The adapter rebuilds the Fabric scene after structural model changes, updates an active raster source in place while painting, and uses Fabric groups so group opacity applies after child compositing. Export builds a separate `StaticCanvas`; it does not mutate or capture the visible editor canvas.

Explicit affine edits are sessions: the model is previewed during pointer or numeric changes, Enter commits one history transaction, and Escape restores the exact pre-session model. Direct Move gestures commit once on Fabric's completed gesture event. Repeated arrow nudges share a 250 ms coalescing key.

A document-coordinate `Uint8Array` owns selection state outside React's pixel data. Marquee, lasso, quick flood fill, and a lazy object-selection module create masks; Boolean operations combine them. Worker generations cancel stale results when the document or raster registry changes. Brush, eraser, clear, crop, export, and selection lift consult the same mask boundary.

The 3 x 3 warp remains a destructive layer-scoped operation split into eight affine triangles. Brush, eraser, selection clear, and selection lift record only affected 256 x 256 raster regions. History owns exact before/after patches, counts retained bytes, and evicts complete transactions at 50 steps or 256 MiB. Crop, resize, vector edits, and structural commands use reversible document states through the same history manager.

Vector shapes are serializable geometry objects rendered through Fabric. Rasterization renders the isolated root vector layer through the static renderer and replaces it with a raster layer in one structural command. Crop and resize update document bounds and root transforms so their undo path does not destructively resample source pixels.

IndexedDB recovery stores a versioned document plus PNG blobs for raster sources after an idle debounce. Recovery validation rejects corrupt or mismatched data without blocking application startup. Diagnostics contain model dimensions, schema and history metadata, recovery errors, and user-agent data—never pixels.

React currently owns the serializable model and the external raster-source registry. Zustand remains optional until store boundaries require it. Raw pixel arrays must not enter React or Zustand state.

The implementation follows the contracts in `BUILD_PLAN.md`. Object Selection remains provisional under ADR 0002 until its real-photo evidence gate passes. New rendering, document-model, history, selection-engine, or deployment decisions require an ADR in `docs/adr/`.
