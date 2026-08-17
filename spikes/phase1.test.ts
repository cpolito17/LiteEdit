import { beforeEach, describe, expect, it } from "vitest";

import {
  buildFabricScene,
  createSpikeCanvas,
  restoreFabricScene,
  serializeFabricScene,
} from "./fabric-scene";
import { findJpegQuality } from "./export-search";
import { syncRasterSurface, type RasterImageAdapter } from "./raster-bridge";
import {
  borderContrastCandidate,
  createSyntheticFixture,
  floodFillCandidate,
  intersectionOverUnion,
} from "./selection-candidates";
import { applyTilePatch, createTilePatch, hashPixels } from "./tile-history";
import { buildMeshTriangles, mapPointThroughMesh, type Point } from "./warp-mesh";

function snapshotObjects(
  snapshot: ReturnType<typeof serializeFabricScene>,
): Array<Record<string, unknown>> {
  const json = JSON.parse(JSON.stringify(snapshot)) as { objects?: Array<Record<string, unknown>> };
  return json.objects ?? [];
}

describe("Phase 1 risk spikes", () => {
  beforeEach(() => {
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    };
    window.cancelAnimationFrame = () => undefined;
  });

  it("serializes and restores a grouped Fabric scene", async () => {
    const canvas = createSpikeCanvas(document.createElement("canvas"));
    const group = buildFabricScene(canvas);
    const snapshot = serializeFabricScene(canvas);

    expect(snapshotObjects(snapshot)).toHaveLength(1);
    expect(group.opacity).toBe(0.5);
    expect(snapshotObjects(snapshot)[0]?.objects).toHaveLength(2);

    const restored = await restoreFabricScene(document.createElement("canvas"), snapshot);
    expect(restored.getObjects()).toHaveLength(1);
    expect(restored.getObjects()[0]?.opacity).toBe(0.5);

    await canvas.dispose();
    await restored.dispose();
  });

  it("invalidates one raster renderer without replacing the document model", () => {
    const calls: string[] = [];
    const adapter: RasterImageAdapter = {
      set(property, value) {
        calls.push(`${property}:${String(value)}`);
      },
      setCoords() {
        calls.push("setCoords");
      },
      setElement() {
        calls.push("setElement");
      },
    };

    const result = syncRasterSurface(adapter, {
      canvas: document.createElement("canvas"),
      revision: 7,
    });

    expect(result).toEqual({ invalidated: true, revision: 7 });
    expect(calls).toEqual(["setElement", "dirty:true", "setCoords"]);
  });

  it("round-trips an exact 256-pixel tile patch", () => {
    const width = 300;
    const height = 280;
    const before = new Uint8ClampedArray(width * height * 4);
    const after = before.slice();
    after[(270 * width + 299) * 4] = 255;
    const patch = createTilePatch(before, after, width, height, 1, 1);
    const work = before.slice();
    const originalHash = hashPixels(work);

    applyTilePatch(work, width, patch, "after");
    expect(hashPixels(work)).not.toBe(originalHash);
    applyTilePatch(work, width, patch, "before");
    expect(hashPixels(work)).toBe(originalHash);
    expect(patch.bounds).toEqual({ height: 24, left: 256, top: 256, width: 44 });
  });

  it("maps a checkerboard through eight seam-free mesh triangles", () => {
    const nodes: Point[] = [
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 50 },
      { x: 50, y: 50 },
      { x: 100, y: 50 },
      { x: 0, y: 100 },
      { x: 50, y: 100 },
      { x: 100, y: 100 },
    ];
    const mesh = buildMeshTriangles(100, 100, nodes);
    const mapped = mapPointThroughMesh({ x: 25, y: 25 }, mesh);

    expect(mesh).toHaveLength(8);
    expect(mapped.x).toBeCloseTo(25);
    expect(mapped.y).toBeCloseTo(25);
  });

  it("compares two local selection candidates on a deterministic fixture", () => {
    const { expected, fixture } = createSyntheticFixture(24, 16, {
      bottom: 13,
      left: 7,
      right: 17,
      top: 3,
    });
    const flood = floodFillCandidate(fixture, { x: 10, y: 8 }, 4);
    const contrast = borderContrastCandidate(fixture, 100);

    expect(intersectionOverUnion(flood.mask, expected)).toBe(1);
    expect(intersectionOverUnion(contrast.mask, expected)).toBe(1);
    expect(flood.engine).not.toBe(contrast.engine);
  });

  it("finds the highest JPEG quality within a target-size tolerance", () => {
    const result = findJpegQuality({
      encodeBytes: (quality) => Math.round(200 + quality * 800),
      targetBytes: 700,
    });

    expect(result.bytes).toBeLessThanOrEqual(700);
    expect(result.quality).toBeGreaterThan(0.5);
    expect(result.quality).toBeLessThan(0.7);
    expect(result.withinTarget).toBe(true);
  });
});
