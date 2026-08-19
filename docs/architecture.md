# Architecture

LiteEdit has two boundaries:

1. Cloudflare serves the static application bundle.
2. The browser owns the document, raster buffers, editor history, and export path.

No imported image bytes are sent to a Worker or third-party service.

The document model is the source of truth. It stores a validated flat node table, root order, group child order, active layer ID, and serializable layer properties. Sibling arrays are bottommost to topmost. The Layers panel reverses them for topmost-first display.

Raster sources live outside the serializable model and are keyed by `bufferId`. Structural undo keeps small before/after model states. Pixel history will use dirty tile patches in Phase 6. Fabric.js is an interactive renderer behind an adapter. The adapter rebuilds the Fabric scene after structural changes and uses Fabric groups so group opacity applies after child compositing. Export builds a separate `StaticCanvas`; it does not mutate or capture the visible editor canvas.

React currently owns the serializable model and the external raster-source registry. Zustand remains optional until store boundaries require it. Raw pixel arrays must not enter React or Zustand state.

The implementation follows the phases in `BUILD_PLAN.md`. New rendering, document-model, history, selection-engine, or deployment decisions require an ADR in `docs/adr/`.
