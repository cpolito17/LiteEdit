export const TILE_SIZE = 256;
const CHANNELS = 4;

export type TilePatchSide = "before" | "after";

export interface TileBounds {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface TilePatch {
  readonly after: Uint8ClampedArray;
  readonly before: Uint8ClampedArray;
  readonly bounds: TileBounds;
  readonly tileX: number;
  readonly tileY: number;
}

export function getTileBounds(
  documentWidth: number,
  documentHeight: number,
  tileX: number,
  tileY: number,
): TileBounds {
  const left = tileX * TILE_SIZE;
  const top = tileY * TILE_SIZE;

  return {
    height: Math.max(0, Math.min(TILE_SIZE, documentHeight - top)),
    left,
    top,
    width: Math.max(0, Math.min(TILE_SIZE, documentWidth - left)),
  };
}

function copyTile(
  pixels: Uint8ClampedArray,
  documentWidth: number,
  bounds: TileBounds,
): Uint8ClampedArray {
  const tile = new Uint8ClampedArray(bounds.width * bounds.height * CHANNELS);

  for (let row = 0; row < bounds.height; row += 1) {
    const sourceStart = ((bounds.top + row) * documentWidth + bounds.left) * CHANNELS;
    const targetStart = row * bounds.width * CHANNELS;
    tile.set(pixels.subarray(sourceStart, sourceStart + bounds.width * CHANNELS), targetStart);
  }

  return tile;
}

export function createTilePatch(
  beforePixels: Uint8ClampedArray,
  afterPixels: Uint8ClampedArray,
  documentWidth: number,
  documentHeight: number,
  tileX: number,
  tileY: number,
): TilePatch {
  const bounds = getTileBounds(documentWidth, documentHeight, tileX, tileY);

  return {
    after: copyTile(afterPixels, documentWidth, bounds),
    before: copyTile(beforePixels, documentWidth, bounds),
    bounds,
    tileX,
    tileY,
  };
}

export function applyTilePatch(
  pixels: Uint8ClampedArray,
  documentWidth: number,
  patch: TilePatch,
  side: TilePatchSide,
): void {
  const source = side === "before" ? patch.before : patch.after;
  const { bounds } = patch;

  for (let row = 0; row < bounds.height; row += 1) {
    const sourceStart = row * bounds.width * CHANNELS;
    const targetStart = ((bounds.top + row) * documentWidth + bounds.left) * CHANNELS;
    pixels.set(source.subarray(sourceStart, sourceStart + bounds.width * CHANNELS), targetStart);
  }
}

export function hashPixels(pixels: Uint8ClampedArray): string {
  let hash = 2_166_136_261;

  for (const value of pixels) {
    hash ^= value;
    hash = Math.imul(hash, 16_777_619);
  }

  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
