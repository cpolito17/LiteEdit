# ADR 0003: Layer tree and structural history boundaries

Status: Accepted for Phase 4

## Decision

Store layers as a serializable flat node table plus ordered root IDs. Each group stores its ordered child IDs. Every child also stores one `parentId`. Sibling arrays use bottommost-to-topmost render order. The Layers panel reverses that order for display.

Keep raster sources outside the document model in a registry keyed by each raster layer's `bufferId`. Structural commands store reversible before/after document-model states. They do not copy pixels. Raster sources needed by undo or redo remain alive until later disposal rules prove that no retained transaction references them.

Render each raster layer as one Fabric image. Render nested model groups as Fabric groups so group opacity applies to the composited children. Rebuild the Fabric object tree after a structural change. Export through a separate `StaticCanvas` at document resolution.

## Reasoning

- The node table makes tree invariants, cycle checks, parent lookup, serialization, and immutable structural commands explicit.
- Separate root and child order prevents accidental coupling between storage order and z-order.
- A `bufferId` lets duplicate, delete, undo, and redo change structure without placing mutable canvas pixels in React state.
- Full model states are small enough for structural history. Full raster states are not. The later raster history implementation must use dirty tile patches.
- Fabric groups provide post-composite opacity. Multiplying group opacity into each child would produce incorrect overlap colors.
- A static export scene prevents viewport transforms, active controls, selections, and editor overlays from entering output files.

## Invariants

- Each node ID is unique and reachable from exactly one root.
- Each nested node has exactly one group parent, and both parent and child references agree.
- A group cannot contain itself or any ancestor.
- The active layer always exists.
- Every raster node references one available external source.
- Structural undo and redo restore the exact serialized model state.

## Consequences

- Structural scene rebuilds are acceptable for Phase 4 but are not the raster-edit invalidation path.
- Phase 6 must add buffer reference accounting and release orphaned raster sources when history eviction makes them unreachable.
- Phase 5 can extend the existing layer transform matrix without changing tree ownership.
- Renderer, history format, or tree-schema changes require a new ADR and schema migration plan.
