import { describe, expect, it } from "vitest";

import {
  combineSelectionMasks,
  getSelectionBounds,
  invertSelection,
  quickSelectionFromSeed,
  selectionFromPolygon,
  selectionFromRectangle,
} from "./selection-mask";

describe("selection masks", () => {
  it("combines rectangle masks with exact Boolean semantics", () => {
    const left = selectionFromRectangle(5, 4, { x: 0, y: 0 }, { x: 3, y: 3 });
    const right = selectionFromRectangle(5, 4, { x: 2, y: 1 }, { x: 5, y: 4 });
    expect(getSelectionBounds(combineSelectionMasks(left, right, "add"))).toEqual({
      x: 0,
      y: 0,
      width: 5,
      height: 4,
    });
    expect(getSelectionBounds(combineSelectionMasks(left, right, "intersect"))).toEqual({
      x: 2,
      y: 1,
      width: 1,
      height: 2,
    });
    expect(combineSelectionMasks(left, right, "subtract").data.filter(Boolean)).toHaveLength(7);
    expect(invertSelection(left).data.filter(Boolean)).toHaveLength(11);
  });

  it("rasterizes lasso polygons and expands a color-connected seed", () => {
    const polygon = selectionFromPolygon(6, 6, [
      { x: 1, y: 1 },
      { x: 5, y: 1 },
      { x: 3, y: 5 },
    ]);
    expect(polygon.data.filter(Boolean).length).toBeGreaterThan(4);
    const image = {
      width: 4,
      height: 2,
      data: new Uint8ClampedArray(4 * 2 * 4),
      colorSpace: "srgb",
    } as ImageData;
    for (let index = 0; index < 8; index += 1) {
      image.data.set(index % 4 < 2 ? [10, 20, 30, 255] : [220, 230, 240, 255], index * 4);
    }
    expect(quickSelectionFromSeed(image, { x: 0, y: 0 }, 10).data.filter(Boolean)).toHaveLength(4);
  });

  it("bounds the flood queue to one entry per pixel", () => {
    const image = {
      width: 64,
      height: 64,
      data: new Uint8ClampedArray(64 * 64 * 4).fill(80),
      colorSpace: "srgb",
    } as ImageData;
    expect(
      quickSelectionFromSeed(image, { x: 32, y: 32 }, 0, 24).data.filter(Boolean),
    ).toHaveLength(64 * 64);
  });
});
