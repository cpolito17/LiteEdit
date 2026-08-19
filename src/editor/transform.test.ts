import { describe, expect, it } from "vitest";

import {
  createBlankDocument,
  getLayerById,
  setLayerTransform,
  wrapLayerInGroup,
  type Matrix2D,
} from "./document-model";
import {
  composeLayerTransform,
  getLayerLocalBounds,
  getLayerWorldTransform,
  getTransformFields,
  invertMatrix,
  multiplyMatrices,
  transformPoint,
} from "./transform";

function expectMatrixClose(actual: Matrix2D, expected: Matrix2D): void {
  actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index] ?? 0, 8));
}

describe("layer transforms", () => {
  it("round-trips points through composed and inverse matrices", () => {
    const first: Matrix2D = [1.2, 0.3, -0.2, 0.8, 14, -7];
    const second: Matrix2D = [0.9, -0.1, 0.4, 1.1, -3, 5];
    const composed = multiplyMatrices(first, second);
    const point = { x: 17, y: -4 };

    expect(transformPoint(transformPoint(point, composed), invertMatrix(composed))).toEqual(
      expect.objectContaining({
        x: expect.closeTo(point.x, 8),
        y: expect.closeTo(point.y, 8),
      }),
    );
    expectMatrixClose(multiplyMatrices(composed, invertMatrix(composed)), [1, 0, 0, 1, 0, 0]);
  });

  it("round-trips non-uniform scale, rotation, skew, and numeric center fields", () => {
    const model = createBlankDocument({ width: 80, height: 40, background: "transparent" });
    const fields = {
      x: 53.25,
      y: 21.5,
      scaleX: 175,
      scaleY: 62.5,
      rotation: 31,
      skew: -18,
    };
    const matrix = composeLayerTransform(model, model.activeLayerId, fields);
    const transformed = setLayerTransform(model, model.activeLayerId, matrix);
    const restored = getTransformFields(transformed, model.activeLayerId);

    expect(restored.x).toBeCloseTo(fields.x, 8);
    expect(restored.y).toBeCloseTo(fields.y, 8);
    expect(restored.scaleX).toBeCloseTo(fields.scaleX, 8);
    expect(restored.scaleY).toBeCloseTo(fields.scaleY, 8);
    expect(restored.rotation).toBeCloseTo(fields.rotation, 8);
    expect(restored.skew).toBeCloseTo(fields.skew, 8);
  });

  it("composes nested group transforms without flattening child coordinates", () => {
    let model = createBlankDocument({ width: 8, height: 6, background: "transparent" });
    const rasterId = model.activeLayerId;
    model = wrapLayerInGroup(model, rasterId, "Inner");
    const innerId = model.activeLayerId;
    model = wrapLayerInGroup(model, innerId, "Outer");
    const outerId = model.activeLayerId;
    model = setLayerTransform(model, rasterId, [1, 0, 0, 1, 2, 3]);
    model = setLayerTransform(model, innerId, [2, 0, 0, 2, 5, 6]);
    model = setLayerTransform(model, outerId, [1, 0, 0, 1, 10, 20]);

    expect(getLayerById(model, rasterId).parentId).toBe(innerId);
    expect(getLayerLocalBounds(model, innerId)).toEqual({ x: 2, y: 3, width: 8, height: 6 });
    expect(getLayerLocalBounds(model, outerId)).toEqual({ x: 9, y: 12, width: 16, height: 12 });
    expectMatrixClose(getLayerWorldTransform(model, rasterId), [2, 0, 0, 2, 19, 32]);
  });
});
