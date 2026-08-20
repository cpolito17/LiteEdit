import { describe, expect, it } from "vitest";

import {
  assertDocumentInvariant,
  createBlankDocument,
  createDocumentModel,
  deleteLayerSubtree,
  duplicateLayerSubtree,
  getLayerById,
  insertGroupLayer,
  insertRasterLayer,
  MAX_DOCUMENT_DIMENSION,
  MAX_DOCUMENT_PIXELS,
  moveLayer,
  moveLayerWithinParent,
  outdentLayer,
  renameLayer,
  setActiveLayer,
  setLayerOpacity,
  setLayerVisibility,
  ungroupLayer,
  wrapLayerInGroup,
} from "./document-model";

describe("document model", () => {
  it("creates a valid blank document with one active raster layer", () => {
    const document = createBlankDocument({
      width: 1200,
      height: 800,
      background: "transparent",
    });

    expect(document.name).toBe("Untitled");
    expect(document.rootLayerIds).toHaveLength(1);
    expect(document.layers).toHaveLength(1);
    expect(document.layers[0]).toMatchObject({
      kind: "raster",
      name: "Background",
      parentId: null,
      width: 1200,
      height: 800,
      visible: true,
      locked: false,
      opacity: 1,
    });
    expect(document.activeLayerId).toBe(document.layers[0]?.id);
  });

  it("keeps the document reference stable when the active layer is reselected", () => {
    const document = createBlankDocument({
      width: 64,
      height: 64,
      background: "transparent",
    });

    expect(setActiveLayer(document, document.activeLayerId)).toBe(document);
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

  it("creates, nests, reorders, duplicates, and removes layer subtrees", () => {
    let document = createBlankDocument({ width: 64, height: 64, background: "white" });
    const backgroundId = document.activeLayerId;
    const paint = insertRasterLayer(document, { name: "Paint" });
    document = paint.document;
    const paintId = paint.layer.id;
    document = wrapLayerInGroup(document, paintId, "Details");
    const groupId = document.activeLayerId;
    document = setLayerOpacity(document, groupId, 0.5);

    expect(getLayerById(document, groupId)).toMatchObject({
      kind: "group",
      opacity: 0.5,
      childIds: [paintId],
    });
    expect(getLayerById(document, paintId).opacity).toBe(1);

    const duplicate = duplicateLayerSubtree(document, groupId);
    document = duplicate.document;
    expect(duplicate.bufferCopies).toHaveLength(1);
    expect(document.layers).toHaveLength(5);
    expect(new Set(document.layers.map((layer) => layer.id)).size).toBe(5);

    document = moveLayerWithinParent(document, duplicate.rootLayerId, "down");
    document = ungroupLayer(document, duplicate.rootLayerId);
    const duplicatedPaintId = document.activeLayerId;
    document = outdentLayer(document, paintId);
    expect(getLayerById(document, paintId).parentId).toBeNull();
    expect(document.rootLayerIds).toContain(backgroundId);

    document = deleteLayerSubtree(document, duplicatedPaintId);
    assertDocumentInvariant(document);
  });

  it("prevents cycles and keeps parent references consistent during drag moves", () => {
    let document = createBlankDocument({ width: 32, height: 32, background: "transparent" });
    const firstGroup = insertGroupLayer(document, { name: "Outer" });
    document = firstGroup.document;
    const secondGroup = insertGroupLayer(document, { name: "Inner" });
    document = secondGroup.document;
    document = moveLayer(document, secondGroup.layer.id, firstGroup.layer.id, 0);

    expect(() => moveLayer(document, firstGroup.layer.id, secondGroup.layer.id, 0)).toThrow(
      "own descendant",
    );
    expect(getLayerById(document, secondGroup.layer.id).parentId).toBe(firstGroup.layer.id);
    assertDocumentInvariant(document);
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

    expect(() => deleteLayerSubtree(document, layer.id)).toThrow("keep at least one");
    expect(() => renameLayer(document, layer.id, "  ")).toThrow("cannot be empty");
    expect(setLayerVisibility(document, layer.id, false).layers[0]?.visible).toBe(false);
  });
});
