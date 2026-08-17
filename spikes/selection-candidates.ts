export interface RasterFixture {
  readonly data: Uint8ClampedArray;
  readonly height: number;
  readonly width: number;
}

export interface SelectionPoint {
  readonly x: number;
  readonly y: number;
}

export interface SelectionCandidateResult {
  readonly engine: string;
  readonly mask: Uint8Array;
}

function pixelOffset(fixture: RasterFixture, point: SelectionPoint): number {
  return (point.y * fixture.width + point.x) * 4;
}

function colorDistance(data: Uint8ClampedArray, leftOffset: number, rightOffset: number): number {
  const red = (data[leftOffset] ?? 0) - (data[rightOffset] ?? 0);
  const green = (data[leftOffset + 1] ?? 0) - (data[rightOffset + 1] ?? 0);
  const blue = (data[leftOffset + 2] ?? 0) - (data[rightOffset + 2] ?? 0);
  return Math.sqrt(red * red + green * green + blue * blue);
}

function isValidPoint(fixture: RasterFixture, point: SelectionPoint): boolean {
  return point.x >= 0 && point.x < fixture.width && point.y >= 0 && point.y < fixture.height;
}

export function createSyntheticFixture(
  width: number,
  height: number,
  subject: {
    readonly bottom: number;
    readonly left: number;
    readonly right: number;
    readonly top: number;
  },
): { expected: Uint8Array; fixture: RasterFixture } {
  const background = [24, 32, 40, 255];
  const foreground = [220, 40, 30, 255];
  const data = new Uint8ClampedArray(width * height * 4);
  const expected = new Uint8Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const isSubject =
        x >= subject.left && x < subject.right && y >= subject.top && y < subject.bottom;
      const offset = (y * width + x) * 4;
      const color = isSubject ? foreground : background;
      data.set(color, offset);
      expected[y * width + x] = isSubject ? 1 : 0;
    }
  }

  return { expected, fixture: { data, height, width } };
}

export function floodFillCandidate(
  fixture: RasterFixture,
  seed: SelectionPoint,
  tolerance: number,
): SelectionCandidateResult {
  if (!isValidPoint(fixture, seed)) {
    throw new Error("Selection seed is outside the fixture.");
  }

  const mask = new Uint8Array(fixture.width * fixture.height);
  const visited = new Uint8Array(mask.length);
  const queue: SelectionPoint[] = [seed];
  const seedOffset = pixelOffset(fixture, seed);

  while (queue.length > 0) {
    const point = queue.shift();

    if (!point || !isValidPoint(fixture, point)) {
      continue;
    }

    const index = point.y * fixture.width + point.x;
    if (
      visited[index] ||
      colorDistance(fixture.data, pixelOffset(fixture, point), seedOffset) > tolerance
    ) {
      continue;
    }

    visited[index] = 1;
    mask[index] = 1;
    queue.push(
      { x: point.x - 1, y: point.y },
      { x: point.x + 1, y: point.y },
      { x: point.x, y: point.y - 1 },
      { x: point.x, y: point.y + 1 },
    );
  }

  return { engine: "model-free-color-flood", mask };
}

export function borderContrastCandidate(
  fixture: RasterFixture,
  minimumDistance: number,
): SelectionCandidateResult {
  const borderColor = [0, 0, 0];
  let borderSamples = 0;

  for (let y = 0; y < fixture.height; y += 1) {
    for (let x = 0; x < fixture.width; x += 1) {
      if (x !== 0 && y !== 0 && x !== fixture.width - 1 && y !== fixture.height - 1) {
        continue;
      }
      const offset = (y * fixture.width + x) * 4;
      borderColor[0] = (borderColor[0] ?? 0) + (fixture.data[offset] ?? 0);
      borderColor[1] = (borderColor[1] ?? 0) + (fixture.data[offset + 1] ?? 0);
      borderColor[2] = (borderColor[2] ?? 0) + (fixture.data[offset + 2] ?? 0);
      borderSamples += 1;
    }
  }

  const average = borderColor.map((value) => value / borderSamples);
  const mask = new Uint8Array(fixture.width * fixture.height);

  for (let y = 0; y < fixture.height; y += 1) {
    for (let x = 0; x < fixture.width; x += 1) {
      const offset = (y * fixture.width + x) * 4;
      const distance = Math.sqrt(
        ((fixture.data[offset] ?? 0) - (average[0] ?? 0)) ** 2 +
          ((fixture.data[offset + 1] ?? 0) - (average[1] ?? 0)) ** 2 +
          ((fixture.data[offset + 2] ?? 0) - (average[2] ?? 0)) ** 2,
      );
      mask[y * fixture.width + x] = distance >= minimumDistance ? 1 : 0;
    }
  }

  return { engine: "model-free-border-contrast", mask };
}

export function intersectionOverUnion(left: Uint8Array, right: Uint8Array): number {
  if (left.length !== right.length) {
    throw new Error("Selection masks must have the same length.");
  }

  let intersection = 0;
  let union = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftSelected = left[index] === 1;
    const rightSelected = right[index] === 1;
    intersection += leftSelected && rightSelected ? 1 : 0;
    union += leftSelected || rightSelected ? 1 : 0;
  }

  return union === 0 ? 1 : intersection / union;
}
