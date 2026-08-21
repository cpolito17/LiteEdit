import { createTransparentRasterSource, type RasterSource } from "./raster-sources";

export type RasterSnapshot = {
  /** Region origin. Missing values in older records mean zero. */
  x?: number;
  y?: number;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
};

export function captureRasterSnapshot(
  source: RasterSource,
  width: number,
  height: number,
): RasterSnapshot {
  const canvas = createTransparentRasterSource(width, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("The browser did not provide a 2D canvas context.");
  }
  context.drawImage(source, 0, 0, width, height);
  return {
    width,
    height,
    pixels: new Uint8ClampedArray(context.getImageData(0, 0, width, height).data),
  };
}

export function cloneRasterSnapshot(snapshot: RasterSnapshot): RasterSnapshot {
  return {
    x: snapshot.x,
    y: snapshot.y,
    width: snapshot.width,
    height: snapshot.height,
    pixels: new Uint8ClampedArray(snapshot.pixels),
  };
}

export function captureRasterRegion(
  source: RasterSource,
  region: { x: number; y: number; width: number; height: number },
): RasterSnapshot {
  const sourceCanvas = createTransparentRasterSource(
    "naturalWidth" in source ? source.naturalWidth : source.width,
    "naturalHeight" in source ? source.naturalHeight : source.height,
  );
  const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("The browser did not provide a 2D canvas context.");
  context.drawImage(source, 0, 0, sourceCanvas.width, sourceCanvas.height);
  const x = Math.max(0, Math.floor(region.x));
  const y = Math.max(0, Math.floor(region.y));
  const width = Math.max(0, Math.min(sourceCanvas.width - x, Math.ceil(region.width)));
  const height = Math.max(0, Math.min(sourceCanvas.height - y, Math.ceil(region.height)));
  if (width < 1 || height < 1) throw new Error("Raster history region is empty.");
  return {
    x,
    y,
    width,
    height,
    pixels: new Uint8ClampedArray(context.getImageData(x, y, width, height).data),
  };
}

export function restoreRasterSnapshot(snapshot: RasterSnapshot): HTMLCanvasElement {
  const canvas = createTransparentRasterSource(snapshot.width, snapshot.height);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("The browser did not provide a 2D canvas context.");
  }
  const image = context.createImageData(snapshot.width, snapshot.height);
  image.data.set(snapshot.pixels);
  context.putImageData(image, 0, 0);
  return canvas;
}

export function applyRasterSnapshot(
  source: RasterSource,
  snapshot: RasterSnapshot,
): HTMLCanvasElement {
  const sourceWidth = "naturalWidth" in source ? source.naturalWidth : source.width;
  const sourceHeight = "naturalHeight" in source ? source.naturalHeight : source.height;
  const x = snapshot.x ?? 0;
  const y = snapshot.y ?? 0;
  if (x === 0 && y === 0 && snapshot.width === sourceWidth && snapshot.height === sourceHeight) {
    return restoreRasterSnapshot(snapshot);
  }
  const canvas = createTransparentRasterSource(sourceWidth, sourceHeight);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The browser did not provide a 2D canvas context.");
  context.drawImage(source, 0, 0, sourceWidth, sourceHeight);
  const image = context.createImageData(snapshot.width, snapshot.height);
  image.data.set(snapshot.pixels);
  context.putImageData(image, x, y);
  return canvas;
}

export function rasterSnapshotsEqual(left: RasterSnapshot, right: RasterSnapshot): boolean {
  if (
    (left.x ?? 0) !== (right.x ?? 0) ||
    (left.y ?? 0) !== (right.y ?? 0) ||
    left.width !== right.width ||
    left.height !== right.height ||
    left.pixels.length !== right.pixels.length
  ) {
    return false;
  }
  return left.pixels.every((value, index) => value === right.pixels[index]);
}

export function hashRasterSnapshot(snapshot: RasterSnapshot): string {
  let hash = 0x811c9dc5;
  for (const value of snapshot.pixels) {
    hash ^= value;
    hash = Math.imul(hash, 0x01000193);
  }
  const origin =
    (snapshot.x ?? 0) === 0 && (snapshot.y ?? 0) === 0
      ? ""
      : `@${snapshot.x ?? 0},${snapshot.y ?? 0}`;
  return `${snapshot.width}x${snapshot.height}${origin}:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
