import { describe, expect, it } from "vitest";

import { createShapeObject, regularPolygonPoints } from "./shape-geometry";

describe("vector shape geometry", () => {
  it("creates regular polygons and constrained bounds", () => {
    expect(regularPolygonPoints({ x: 0, y: 0 }, 10, 10, 5)).toHaveLength(5);
    expect(regularPolygonPoints({ x: 0, y: 0 }, 10, 10, 5, 0.45)).toHaveLength(10);
    expect(
      createShapeObject(
        "rectangle",
        { x: 10, y: 10 },
        { x: 30, y: 20 },
        { fill: "#fff", stroke: "#000", strokeWidth: 2, sides: 5 },
        { constrain: true },
      ).properties,
    ).toMatchObject({ left: 10, top: 10, width: 20, height: 20 });
  });
});
