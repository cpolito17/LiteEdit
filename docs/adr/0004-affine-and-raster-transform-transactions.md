# ADR 0004: Affine and raster transform transactions

Status: Accepted for Phase 5

## Decision

Keep each layer's six-value affine matrix in the document model as the source of truth. A matrix maps layer-local coordinates into its parent coordinate plane. World transforms are produced by left-multiplying ancestor matrices. Fabric objects are renderer projections of those matrices; a completed Fabric gesture is converted back into one model matrix.

Treat an explicit affine edit as a session with one exact pre-edit document snapshot. Pointer and numeric changes update the preview model. Enter commits the final model as one history row. Escape restores the pre-edit model without adding history. A direct Move drag emits and commits once on Fabric's `object:modified` event. Arrow nudges are affine translations and coalesce for 250 ms.

Implement raster warp as a typed operation whose scope is either a whole layer or a future selection. Phase 5 executes only whole-layer scope. A 3 x 3 mesh produces eight affine triangles. Reject collapsed or folded destination triangles. Render triangles into a new canvas with overlapping clips and a two-pixel edge-padded source, then replace the raster source only when the user commits.

Store a warp as one history transaction containing exact before/after pixel snapshots plus the unchanged document model. Count both snapshots against the existing 50-step/256 MiB history budget. Undo and redo reconstruct the raster source from the stored bytes. Preview and cancel never mutate the source.

## Reasoning

- Model-owned matrices keep export, history, numeric fields, nested groups, and Fabric interaction on one serializable representation.
- A session separates high-frequency preview updates from history commits, so one gesture cannot flood the History panel.
- Exact pre-edit state makes cancellation deterministic, including active-layer state and nested transforms.
- A typed selection scope prevents Phase 5 from hard-coding whole-layer behavior into the command boundary.
- Edge padding and clip overlap prevent visible transparent seams without a per-pixel JavaScript rasterizer.
- Full raster snapshots are simple enough to validate destructive warp before the Phase 6 tile-patch engine exists.

## Invariants

- Every stored affine matrix contains finite values and has a non-zero determinant.
- Numeric compose/decompose preserves center, non-uniform scale, rotation, and horizontal skew within floating-point tolerance.
- A completed pointer gesture creates at most one history row.
- Escape restores the exact serialized model and leaves raster bytes unchanged.
- Warp commit, undo, and redo restore exact raster hashes.
- Editor controls, transform handles, and warp mesh never enter export output.

## Consequences

- Fabric scene rebuilds remain acceptable for Phase 5 previews but must not become the Phase 6 paint invalidation path.
- The transform controls target a top-level render object when an active layer is nested, because Fabric transforms the containing interactive group.
- Selection-scoped execution throws a deliberate boundary error until Phase 8 supplies a mask ID and bounds.
- Phase 6 must replace complete warp snapshots with dirty tile patches and add explicit raster-buffer disposal.
