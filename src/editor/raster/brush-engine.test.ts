import { describe, expect, it } from "vitest";

import {
  getStampSpacing,
  interpolateBrushPoints,
  mapPressure,
  unionDirtyRectangles,
  type BrushSettings,
} from "./brush-engine";

const settings: BrushSettings = {
  diameter: 20,
  hardness: 70,
  opacity: 80,
  spacing: 25,
  color: "#70ffd2",
  pressure: true,
  mode: "paint",
};

describe("brush engine", () => {
  it("maps pressure and interpolates gapless stamp positions", () => {
    expect(mapPressure(0.5, true)).toBeCloseTo(0.575);
    expect(mapPressure(0.2, false)).toBe(1);
    expect(getStampSpacing(settings)).toBe(5);
    const points = interpolateBrushPoints(
      { x: 0, y: 0, pressure: 0.2 },
      { x: 20, y: 0, pressure: 1 },
      5,
    );
    expect(points).toHaveLength(4);
    expect(points.at(-1)).toEqual({ x: 20, y: 0, pressure: 1 });
    expect(
      points.every((point, index) => index === 0 || point.x - (points[index - 1]?.x ?? 0) <= 5),
    ).toBe(true);
  });

  it("tracks a single dirty region across the stroke", () => {
    expect(
      unionDirtyRectangles(
        { x: 3, y: 4, width: 5, height: 6 },
        { x: 0, y: 8, width: 4, height: 4 },
      ),
    ).toEqual({ x: 0, y: 4, width: 8, height: 8 });
  });
});
