import { createTransparentRasterSource, type RasterSource } from "./raster-sources";

export type RasterSnapshot = {
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
    width: snapshot.width,
    height: snapshot.height,
    pixels: new Uint8ClampedArray(snapshot.pixels),
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

export function rasterSnapshotsEqual(left: RasterSnapshot, right: RasterSnapshot): boolean {
  if (
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
  return `${snapshot.width}x${snapshot.height}:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
