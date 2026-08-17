# Architecture

LiteEdit has two boundaries:

1. Cloudflare serves the static application bundle.
2. The browser owns the document, raster buffers, editor history, and export path.

No imported image bytes are sent to a Worker or third-party service.

The document model will remain the source of truth. Fabric.js is an interactive renderer behind an adapter. Zustand may hold serializable document metadata and UI state, but it must not hold raw pixel arrays. Raster buffers will live in a dedicated store outside React state.

The implementation follows the phases in `BUILD_PLAN.md`. New rendering, document-model, history, selection-engine, or deployment decisions require an ADR in `docs/adr/`.
