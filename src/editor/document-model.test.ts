import { describe, expect, it } from "vitest";

import {
  assertDocumentInvariant,
  createBlankDocument,
  createDocumentModel,
  MAX_DOCUMENT_DIMENSION,
  MAX_DOCUMENT_PIXELS,
} from "./document-model";

describe("document model", () => {
  it("creates a valid blank document with one active raster layer", () => {
    const document = createBlankDocument({
      width: 1200,
      height: 800,
      background: "transparent",
    });

    expect(document.name).toBe("Untitled");
    expect(document.layers).toHaveLength(1);
    expect(document.layers[0]).toMatchObject({
      kind: "raster",
      name: "Background",
      width: 1200,
      height: 800,
      visible: true,
      locked: false,
      opacity: 1,
    });
    expect(document.activeLayerId).toBe(document.layers[0]?.id);
  });

  it("rejects dimensions before a document can be allocated", () => {
    expect(() =>
      createDocumentModel({
        name: "Invalid",
        width: 0,
        height: 100,
        background: "transparent",
        layerName: "Layer",
      }),
    ).toThrow("positive whole numbers");

    expect(() =>
      createDocumentModel({
        name: "Too Wide",
        width: MAX_DOCUMENT_DIMENSION + 1,
        height: 1,
        background: "transparent",
        layerName: "Layer",
      }),
    ).toThrow("cannot exceed");

    const heightOverPixelLimit = Math.floor(MAX_DOCUMENT_PIXELS / 6400) + 1;
    expect(() =>
      createDocumentModel({
        name: "Too Many Pixels",
        width: 6400,
        height: heightOverPixelLimit,
        background: "transparent",
        layerName: "Layer",
      }),
    ).toThrow("pixel count");
  });

  it("detects broken layer invariants", () => {
    const document = createBlankDocument({
      width: 64,
      height: 64,
      background: "white",
    });
    const layer = document.layers[0];
    if (!layer) {
      throw new Error("Expected a background layer.");
    }

    expect(() =>
      assertDocumentInvariant({
        ...document,
        activeLayerId: "missing-layer",
      }),
    ).toThrow("active layer");

    expect(() =>
      assertDocumentInvariant({
        ...document,
        layers: [layer, { ...layer }],
      }),
    ).toThrow("unique");

    expect(() =>
      assertDocumentInvariant({
        ...document,
        layers: [{ ...layer, opacity: 2 }],
      }),
    ).toThrow("opacity");
  });
});
