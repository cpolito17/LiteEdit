import { describe, expect, it } from "vitest";

import { normalizeExportFilename, searchQualityWithEncoder } from "./export-service";

describe("export service", () => {
  it("normalizes local filenames and terminates target-size search", async () => {
    expect(normalizeExportFilename("photo.final.PNG", "jpeg")).toBe("photo.final-edited.jpg");
    const result = await searchQualityWithEncoder(
      500,
      async (quality) => new Blob([new Uint8Array(Math.round(quality * 1000))]),
    );
    expect(result.blob.size).toBeLessThanOrEqual(525);
    expect(result.quality).toBeGreaterThan(0.45);
  });
});
