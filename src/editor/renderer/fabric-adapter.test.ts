import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createBlankDocument,
  getLayerById,
  insertRasterLayer,
  moveLayer,
  setLayerOpacity,
  wrapLayerInGroup,
} from "../document-model";
import type { RasterSource } from "../raster/raster-sources";
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
});
