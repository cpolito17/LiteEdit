import { describe, expect, it } from "vitest";

import { captureRasterSnapshot, hashRasterSnapshot, rasterSnapshotsEqual } from "./raster-snapshot";
import { buildWarpTriangles, createDefaultWarpNodes, warpRasterSource } from "./warp";

function createCheckerboard(size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Expected a canvas context.");
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      context.fillStyle = (x + y) % 2 === 0 ? "#70ffd2" : "#32195f";
      context.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

function setCanvasOpacity(source: HTMLCanvasElement, opacity: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Expected a canvas context.");
  context.globalAlpha = opacity;
  context.drawImage(source, 0, 0);
  return canvas;
}

describe("3 by 3 raster warp", () => {
  it("returns an exact clone for an identity mesh", () => {
    const source = createCheckerboard(12);
    const before = captureRasterSnapshot(source, 12, 12);
    const output = warpRasterSource(source, 12, 12, {
      scope: { kind: "layer" },
      destinationNodes: createDefaultWarpNodes(12, 12),
    });

    expect(output).not.toBe(source);
    expect(rasterSnapshotsEqual(before, captureRasterSnapshot(output, 12, 12))).toBe(true);
  });

  it("renders a deterministic opaque warp without one-pixel mesh seams", () => {
    const source = createCheckerboard(12);
    const nodes = createDefaultWarpNodes(12, 12);
    nodes[4] = { x: 7, y: 5 };
    const snapshot = captureRasterSnapshot(
      warpRasterSource(source, 12, 12, {
        scope: { kind: "layer" },
        destinationNodes: nodes,
      }),
      12,
      12,
    );

    // Canvas clip antialiasing may vary by up to five alpha levels; a visible seam may not.
    const opacityGaps = Array.from({ length: 12 * 12 }, (_, index) => ({
      x: index % 12,
      y: Math.floor(index / 12),
      alpha: snapshot.pixels[index * 4 + 3] ?? 0,
    })).filter(({ alpha }) => alpha < 250);
    expect(opacityGaps).toEqual([]);
    expect(hashRasterSnapshot(snapshot)).toBe("12x12:9127fb10");
  });

  it("rejects folded meshes and preserves the future selection command boundary", () => {
    const folded = createDefaultWarpNodes(12, 12);
    folded[4] = { x: -2, y: -2 };
    expect(() => buildWarpTriangles(12, 12, folded)).toThrow(/fold or collapse/i);

    expect(() =>
      warpRasterSource(createCheckerboard(12), 12, 12, {
        scope: {
          kind: "selection",
          bounds: { x: 2, y: 2, width: 8, height: 8 },
          maskId: "future-mask",
        },
        destinationNodes: createDefaultWarpNodes(12, 12),
      }),
    ).toThrow(/Phase 8 selection mask store/i);
  });

  it("does not double semi-transparent alpha where triangle clips overlap", () => {
    const nodes = createDefaultWarpNodes(12, 12);
    nodes[4] = { x: 7, y: 5 };
    const snapshot = captureRasterSnapshot(
      warpRasterSource(setCanvasOpacity(createCheckerboard(12), 0.5), 12, 12, {
        scope: { kind: "layer" },
        destinationNodes: nodes,
      }),
      12,
      12,
    );
    const alpha = snapshot.pixels.filter((_, index) => index % 4 === 3);

    expect(Math.max(...alpha)).toBeLessThanOrEqual(128);
    expect(Math.min(...alpha)).toBeGreaterThanOrEqual(125);
  });
});
