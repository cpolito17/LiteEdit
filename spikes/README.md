# Phase 1 risk spikes

These files are disposable evidence. They are not production editor modules.

Run the spikes with:

```bash
npm test -- spikes/phase1.test.ts
```

## Results

| Spike                | Result       | Evidence                                                                                                                  | Remaining gate                                                                                                                |
| -------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Fabric scene         | Pass         | Group opacity, nested objects, serialization, and restoration pass in `phase1.test.ts`.                                   | Browser render and export comparison.                                                                                         |
| Raster bridge        | Pass         | The adapter updates one Fabric-style image object, marks it dirty, and refreshes coordinates without replacing the model. | Browser test with a real raster canvas and visible render.                                                                    |
| Tile history         | Pass         | A clipped edge tile restores an exact FNV-1a pixel hash after undo.                                                       | Integrate with the production raster buffer store later.                                                                      |
| Warp                 | Pass         | The 3 x 3 mesh produces eight triangles and maps identity checkerboard coordinates without drift.                         | Browser golden-image seam check at 100% and 400%.                                                                             |
| Selection candidates | Harness only | Two local, model-free candidates pass the synthetic fixture.                                                              | Run five representative real photos and compare against a real lazy-loaded segmentation candidate. No engine is selected yet. |
| JPEG search          | Pass         | The bounded binary search returns the highest tested quality within the target tolerance.                                 | Connect to a browser canvas encoder and test 4096 x 4096 behavior.                                                            |

Phase 1 is not fully accepted. The selection-engine gate and browser visual checks remain open. Dependent production editor work must wait for those checks.
