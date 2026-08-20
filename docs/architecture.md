# Architecture

LiteEdit has two boundaries:

1. Cloudflare serves the static application bundle.
2. The browser owns the document, raster buffers, editor history, and export path.

No imported image bytes are sent to a Worker or third-party service.

The document model is the source of truth. It stores a validated flat node table, root order, group child order, active layer ID, and serializable layer properties. Sibling arrays are bottommost to topmost. The Layers panel reverses them for topmost-first display.

Raster sources live outside the serializable model and are keyed by `bufferId`. Every layer transform is a local-to-parent affine matrix in the serializable model; ancestor matrices left-multiply it to produce the world transform. Fabric.js remains an interactive renderer behind an adapter and reports one committed matrix per move or transform gesture. The adapter rebuilds the Fabric scene after model changes and uses Fabric groups so group opacity applies after child compositing. Export builds a separate `StaticCanvas`; it does not mutate or capture the visible editor canvas.

Explicit affine edits are sessions: the model is previewed during pointer or numeric changes, Enter commits one history transaction, and Escape restores the exact pre-session model. Direct Move gestures commit once on Fabric's completed gesture event. Repeated arrow nudges share a 250 ms coalescing key. A future selection-scoped transform uses the same typed command boundary but cannot execute until Phase 8 supplies a mask store.

The Phase 5 warp is a destructive, layer-scoped 3 x 3 mesh split into eight affine triangles. Its mesh is an editor-only SVG overlay. Folded triangles are rejected, shared clips overlap, and the source is edge-padded to prevent transparent seams. The raster source is not changed during preview. Commit stores exact before/after pixel snapshots in the existing 50-step/256 MiB history budget; undo and redo restore those bytes. Full snapshots are a deliberate Phase 5 bridge. Phase 6 must replace them with dirty tile patches and buffer-lifetime accounting before high-frequency painting lands.

React currently owns the serializable model and the external raster-source registry. Zustand remains optional until store boundaries require it. Raw pixel arrays must not enter React or Zustand state.

The implementation follows the phases in `BUILD_PLAN.md`. New rendering, document-model, history, selection-engine, or deployment decisions require an ADR in `docs/adr/`.
