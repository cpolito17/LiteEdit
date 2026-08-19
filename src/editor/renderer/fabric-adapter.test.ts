import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createBlankDocument,
  getLayerById,
  insertRasterLayer,
  moveLayer,
  setLayerOpacity,
  setLayerTransform,
  wrapLayerInGroup,
} from "../document-model";
import type { RasterSource } from "../raster/raster-sources";
import { composeLayerTransform, getTransformFields } from "../transform";
import { FabricRendererAdapter } from "./fabric-adapter";

function createSolidSource(color: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 1;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Expected a canvas context.");
  }
  context.fillStyle = color;
  context.fillRect(0, 0, 2, 1);
  return canvas;
}

function createTransformFixture(size = 16): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Expected a canvas context.");
  context.fillStyle = "#ff5c5c";
  context.fillRect(1, 1, 5, 3);
  context.fillStyle = "#70ffd2";
  context.fillRect(10, 2, 3, 7);
  context.fillStyle = "#726bff";
  context.fillRect(3, 11, 7, 3);
  context.fillStyle = "#fffc8c";
  context.fillRect(7, 6, 2, 2);
  return canvas;
}

function hashPixels(data: Uint8ClampedArray): string {
  let hash = 0x811c9dc5;
  for (const value of data) {
    hash ^= value;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

describe("FabricRendererAdapter", () => {
  beforeEach(() => {
    window.requestAnimationFrame = (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    };
    window.cancelAnimationFrame = () => undefined;
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it("applies group opacity after overlapping children are composited", async () => {
    let model = createBlankDocument({ width: 2, height: 1, background: "transparent" });
    const redLayer = getLayerById(model, model.activeLayerId);
    if (redLayer.kind !== "raster") {
      throw new Error("Expected a raster layer.");
    }
    const blueResult = insertRasterLayer(model, { name: "Blue" });
    model = blueResult.document;
    model = wrapLayerInGroup(model, blueResult.layer.id, "Composite");
    const groupId = model.activeLayerId;
    model = moveLayer(model, redLayer.id, groupId, 0);
    model = setLayerOpacity(model, groupId, 0.5);

    const sources: Record<string, RasterSource> = {
      [redLayer.bufferId]: createSolidSource("#ff0000"),
      [blueResult.layer.bufferId]: createSolidSource("#0000ff"),
    };
    const element = document.createElement("canvas");
    document.body.append(element);
    const adapter = new FabricRendererAdapter(element);
    adapter.setViewportSize(2, 1);
    adapter.setDocument(model, sources);
    adapter.setViewportTransform([1, 0, 0, 1, 0, 0]);
    adapter.canvas.renderAll();

    const context = adapter.canvas.getElement().getContext("2d");
    const pixel = context?.getImageData(0, 0, 1, 1).data;
    expect(pixel && [...pixel]).toEqual([0, 0, 255, 128]);
    await adapter.dispose();
  });

  it("exports through an isolated document-sized static canvas", async () => {
    const model = createBlankDocument({ width: 2, height: 1, background: "transparent" });
    const layer = getLayerById(model, model.activeLayerId);
    if (layer.kind !== "raster") {
      throw new Error("Expected a raster layer.");
    }
    const sources = { [layer.bufferId]: createSolidSource("#70ffd2") };
    const element = document.createElement("canvas");
    document.body.append(element);
    const adapter = new FabricRendererAdapter(element);
    adapter.setViewportSize(80, 60);
    adapter.setDocument(model, sources);
    adapter.setViewportTransform([2, 0, 0, 2, 12, 8]);

    const dataUrl = adapter.exportPng(model, sources);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(adapter.canvas.getWidth()).toBe(80);
    expect(adapter.canvas.getHeight()).toBe(60);
    expect(adapter.getViewportTransform()).toEqual([2, 0, 0, 2, 12, 8]);
    await adapter.dispose();
  });

  it("matches scale, rotation, skew, and nested-group golden pixel hashes", async () => {
    const initial = createBlankDocument({ width: 16, height: 16, background: "transparent" });
    const raster = getLayerById(initial, initial.activeLayerId);
    if (raster.kind !== "raster") throw new Error("Expected a raster layer.");
    const sources = { [raster.bufferId]: createTransformFixture() };
    const element = document.createElement("canvas");
    document.body.append(element);
    const adapter = new FabricRendererAdapter(element);

    const cases = [
      { name: "scale", fields: { x: 8, y: 8, scaleX: 72, scaleY: 125, rotation: 0, skew: 0 } },
      { name: "rotate", fields: { x: 8, y: 8, scaleX: 100, scaleY: 100, rotation: 27, skew: 0 } },
      { name: "skew", fields: { x: 8, y: 8, scaleX: 100, scaleY: 100, rotation: 0, skew: 22 } },
    ] as const;
    const hashes: Record<string, string> = {};
    for (const testCase of cases) {
      const model = setLayerTransform(
        initial,
        raster.id,
        composeLayerTransform(initial, raster.id, testCase.fields),
      );
      hashes[testCase.name] = hashPixels(adapter.renderDocumentPixels(model, sources).data);
    }

    let nested = setLayerTransform(initial, raster.id, [1, 0, 0, 1, 1, 0]);
    nested = wrapLayerInGroup(nested, raster.id, "Nested");
    const groupId = nested.activeLayerId;
    nested = setLayerTransform(
      nested,
      groupId,
      composeLayerTransform(nested, groupId, {
        ...getTransformFields(nested, groupId),
        rotation: -19,
        scaleX: 88,
        scaleY: 113,
        skew: 12,
      }),
    );
    hashes.nested = hashPixels(adapter.renderDocumentPixels(nested, sources).data);

    expect(hashes).toEqual({
      scale: "92eef5b7",
      rotate: "f199a3b1",
      skew: "b5667e11",
      nested: "019af750",
    });
    await adapter.dispose();
  });

  it("emits one normalized model gesture for one Fabric modification", async () => {
    const model = createBlankDocument({ width: 16, height: 16, background: "transparent" });
    const raster = getLayerById(model, model.activeLayerId);
    if (raster.kind !== "raster") throw new Error("Expected a raster layer.");
    const element = document.createElement("canvas");
    document.body.append(element);
    const adapter = new FabricRendererAdapter(element);
    adapter.setInteractionMode("move");
    adapter.setDocument(model, { [raster.bufferId]: createTransformFixture() });
    const gestures: Array<{ action: string; matrix: number[] }> = [];
    adapter.setTransformGestureHandler((gesture) => gestures.push(gesture));

    const object = adapter.canvas.getObjects()[0];
    if (!object) throw new Error("Expected a rendered object.");
    object.set({ left: (object.left ?? 0) + 3 });
    object.setCoords();
    adapter.canvas.fire("object:modified", {
      target: object,
      transform: { action: "drag" },
    } as never);

    expect(gestures).toHaveLength(1);
    expect(gestures[0]?.action).toBe("move");
    expect(gestures[0]?.matrix[4]).toBeCloseTo(3, 8);
    await adapter.dispose();
  });
});
