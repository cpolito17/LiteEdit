import { describe, expect, it } from "vitest";

import {
  captureRasterSnapshot,
  cloneRasterSnapshot,
  hashRasterSnapshot,
  rasterSnapshotsEqual,
  restoreRasterSnapshot,
} from "./raster-snapshot";

function createFixture(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 3;
  canvas.height = 2;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Expected a canvas context.");
  const image = context.createImageData(3, 2);
  image.data.set([
    255, 0, 0, 255, 0, 255, 0, 128, 0, 0, 255, 64, 255, 255, 0, 255, 0, 255, 255, 192, 255, 0, 255,
    0,
  ]);
  context.putImageData(image, 0, 0);
  return canvas;
}

describe("raster snapshots", () => {
  it("restores exact pixels and keeps cloned storage independent", () => {
    const snapshot = captureRasterSnapshot(createFixture(), 3, 2);
    const clone = cloneRasterSnapshot(snapshot);
    const restored = captureRasterSnapshot(restoreRasterSnapshot(snapshot), 3, 2);

    expect(hashRasterSnapshot(snapshot)).toBe("3x2:c3c04c14");
    expect(rasterSnapshotsEqual(snapshot, restored)).toBe(true);
    clone.pixels[0] = 0;
    expect(snapshot.pixels[0]).toBe(255);
    expect(rasterSnapshotsEqual(snapshot, clone)).toBe(false);
  });
});
