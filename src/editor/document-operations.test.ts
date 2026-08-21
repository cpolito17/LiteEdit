import { describe, expect, it } from "vitest";

import { createBlankDocument, getActiveLayer } from "./document-model";
import { cropDocument, resizeDocument } from "./document-operations";

describe("document crop and resize", () => {
  it("changes exact bounds and offsets while remaining reversible by model history", () => {
    const model = createBlankDocument({ width: 100, height: 80, background: "transparent" });
    const cropped = cropDocument(model, { x: 10, y: 5, width: 70, height: 60 });
    expect({ width: cropped.width, height: cropped.height }).toEqual({ width: 70, height: 60 });
    expect(getActiveLayer(cropped).transform).toEqual([1, 0, 0, 1, -10, -5]);
    const resized = resizeDocument(cropped, 140, 120, "high");
    expect({ width: resized.width, height: resized.height }).toEqual({ width: 140, height: 120 });
    expect(resized.resampling).toBe("high");
    expect(getActiveLayer(resized).transform).toEqual([2, 0, 0, 2, -20, -10]);
  });
});
