import { getLayerById, type DocumentModel } from "../document-model";

export type RasterSource = HTMLImageElement | HTMLCanvasElement;
export type RasterSourceMap = Readonly<Record<string, RasterSource>>;

export function createRasterSourceMap(
  documentModel: DocumentModel,
  source: RasterSource,
): Record<string, RasterSource> {
  const activeLayer = getLayerById(documentModel, documentModel.activeLayerId);
  if (activeLayer.kind !== "raster") {
    throw new Error("A new document must start with an active raster layer.");
  }
  return { [activeLayer.bufferId]: source };
}

export function createTransparentRasterSource(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("The browser did not provide a 2D canvas context.");
  }
  context.clearRect(0, 0, width, height);
  return canvas;
}

export function cloneRasterSource(
  source: RasterSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  const clone = createTransparentRasterSource(width, height);
  const context = clone.getContext("2d");
  if (!context) {
    throw new Error("The browser did not provide a 2D canvas context.");
  }
  context.drawImage(source, 0, 0, width, height);
  return clone;
}
