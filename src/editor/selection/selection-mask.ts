export type SelectionCombineMode = "replace" | "add" | "subtract" | "intersect";

export type SelectionPoint = { x: number; y: number };

export type SelectionBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SelectionMask = {
  width: number;
  height: number;
  data: Uint8Array;
};

function assertMask(mask: SelectionMask): void {
  if (mask.width < 1 || mask.height < 1 || mask.data.length !== mask.width * mask.height) {
    throw new Error("Selection mask dimensions do not match its pixel data.");
  }
}

export function createEmptySelection(width: number, height: number): SelectionMask {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("Selection dimensions must be positive whole numbers.");
  }
  return { width, height, data: new Uint8Array(width * height) };
}

export function cloneSelection(mask: SelectionMask): SelectionMask {
  assertMask(mask);
  return { width: mask.width, height: mask.height, data: new Uint8Array(mask.data) };
}

export function selectionFromRectangle(
  width: number,
  height: number,
  start: SelectionPoint,
  end: SelectionPoint,
): SelectionMask {
  const mask = createEmptySelection(width, height);
  const left = Math.max(0, Math.min(width, Math.floor(Math.min(start.x, end.x))));
  const right = Math.max(0, Math.min(width, Math.ceil(Math.max(start.x, end.x))));
  const top = Math.max(0, Math.min(height, Math.floor(Math.min(start.y, end.y))));
  const bottom = Math.max(0, Math.min(height, Math.ceil(Math.max(start.y, end.y))));
  for (let y = top; y < bottom; y += 1) {
    mask.data.fill(255, y * width + left, y * width + right);
  }
  return mask;
}

function pointInPolygon(x: number, y: number, points: readonly SelectionPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const currentPoint = points[index];
    const previousPoint = points[previous];
    if (!currentPoint || !previousPoint) continue;
    const crosses =
      currentPoint.y > y !== previousPoint.y > y &&
      x <
        ((previousPoint.x - currentPoint.x) * (y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y || Number.EPSILON) +
          currentPoint.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function selectionFromPolygon(
  width: number,
  height: number,
  points: readonly SelectionPoint[],
): SelectionMask {
  const mask = createEmptySelection(width, height);
  if (points.length < 3) return mask;
  const minX = Math.max(0, Math.floor(Math.min(...points.map((point) => point.x))));
  const maxX = Math.min(width - 1, Math.ceil(Math.max(...points.map((point) => point.x))));
  const minY = Math.max(0, Math.floor(Math.min(...points.map((point) => point.y))));
  const maxY = Math.min(height - 1, Math.ceil(Math.max(...points.map((point) => point.y))));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (pointInPolygon(x + 0.5, y + 0.5, points)) mask.data[y * width + x] = 255;
    }
  }
  return mask;
}

export function combineSelectionMasks(
  current: SelectionMask | null,
  incoming: SelectionMask,
  mode: SelectionCombineMode,
): SelectionMask {
  assertMask(incoming);
  if (!current || mode === "replace") return cloneSelection(incoming);
  assertMask(current);
  if (current.width !== incoming.width || current.height !== incoming.height) {
    throw new Error("Selection masks must use the same document dimensions.");
  }
  const result = createEmptySelection(current.width, current.height);
  for (let index = 0; index < result.data.length; index += 1) {
    const left = current.data[index] ?? 0;
    const right = incoming.data[index] ?? 0;
    if (mode === "add") result.data[index] = Math.max(left, right);
    else if (mode === "subtract") result.data[index] = Math.max(0, left - right);
    else result.data[index] = Math.min(left, right);
  }
  return result;
}

export function invertSelection(mask: SelectionMask): SelectionMask {
  const next = cloneSelection(mask);
  for (let index = 0; index < next.data.length; index += 1) {
    next.data[index] = 255 - (next.data[index] ?? 0);
  }
  return next;
}

export function getSelectionBounds(mask: SelectionMask | null): SelectionBounds | null {
  if (!mask) return null;
  assertMask(mask);
  let left = mask.width;
  let right = -1;
  let top = mask.height;
  let bottom = -1;
  for (let y = 0; y < mask.height; y += 1) {
    for (let x = 0; x < mask.width; x += 1) {
      if ((mask.data[y * mask.width + x] ?? 0) === 0) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  return right < left
    ? null
    : { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
}

export function isPointSelected(mask: SelectionMask | null, x: number, y: number): boolean {
  if (!mask) return true;
  const pixelX = Math.floor(x);
  const pixelY = Math.floor(y);
  if (pixelX < 0 || pixelY < 0 || pixelX >= mask.width || pixelY >= mask.height) return false;
  return (mask.data[pixelY * mask.width + pixelX] ?? 0) > 0;
}

function colorDistanceFromSample(
  data: Uint8ClampedArray,
  offset: number,
  sample: readonly [number, number, number],
): number {
  const red = (data[offset] ?? 0) - sample[0];
  const green = (data[offset + 1] ?? 0) - sample[1];
  const blue = (data[offset + 2] ?? 0) - sample[2];
  return Math.sqrt(red * red + green * green + blue * blue);
}

export function quickSelectionFromSeed(
  image: ImageData,
  seed: SelectionPoint,
  tolerance: number,
  brushSize = 1,
): SelectionMask {
  const mask = createEmptySelection(image.width, image.height);
  const seedX = Math.max(0, Math.min(image.width - 1, Math.floor(seed.x)));
  const seedY = Math.max(0, Math.min(image.height - 1, Math.floor(seed.y)));
  const queued = new Uint8Array(mask.data.length);
  const queue = new Int32Array(mask.data.length);
  let head = 0;
  let tail = 0;
  const radius = Math.max(0, Math.floor(brushSize / 2));
  let red = 0;
  let green = 0;
  let blue = 0;
  let sampleCount = 0;
  for (
    let y = Math.max(0, seedY - radius);
    y <= Math.min(image.height - 1, seedY + radius);
    y += 1
  ) {
    for (
      let x = Math.max(0, seedX - radius);
      x <= Math.min(image.width - 1, seedX + radius);
      x += 1
    ) {
      if (radius > 0 && (x - seedX) ** 2 + (y - seedY) ** 2 > radius ** 2) continue;
      const index = y * image.width + x;
      const offset = index * 4;
      red += image.data[offset] ?? 0;
      green += image.data[offset + 1] ?? 0;
      blue += image.data[offset + 2] ?? 0;
      sampleCount += 1;
      queued[index] = 1;
      queue[tail++] = index;
    }
  }
  const sample: readonly [number, number, number] = [
    red / sampleCount,
    green / sampleCount,
    blue / sampleCount,
  ];
  const threshold = Math.max(0, Math.min(441, tolerance));
  while (head < tail) {
    const index = queue[head] ?? 0;
    head += 1;
    const x = index % image.width;
    const y = Math.floor(index / image.width);
    if (colorDistanceFromSample(image.data, index * 4, sample) > threshold) continue;
    mask.data[index] = 255;
    const candidates = [
      x > 0 ? index - 1 : -1,
      x < image.width - 1 ? index + 1 : -1,
      y > 0 ? index - image.width : -1,
      y < image.height - 1 ? index + image.width : -1,
    ];
    for (const candidate of candidates) {
      if (candidate >= 0 && !queued[candidate]) {
        queued[candidate] = 1;
        queue[tail++] = candidate;
      }
    }
  }
  return mask;
}
