export interface JpegQualitySearchOptions {
  readonly encodeBytes: (quality: number) => number;
  readonly maxIterations?: number;
  readonly maxQuality?: number;
  readonly minQuality?: number;
  readonly targetBytes: number;
  readonly toleranceBytes?: number;
}

export interface JpegQualitySearchResult {
  readonly bytes: number;
  readonly iterations: number;
  readonly quality: number;
  readonly withinTarget: boolean;
}

export interface AsyncJpegQualitySearchOptions extends Omit<
  JpegQualitySearchOptions,
  "encodeBytes"
> {
  readonly encodeBytes: (quality: number) => Promise<number>;
}

export function findJpegQuality(options: JpegQualitySearchOptions): JpegQualitySearchResult {
  const minQuality = options.minQuality ?? 0.1;
  const maxQuality = options.maxQuality ?? 1;
  const maxIterations = options.maxIterations ?? 12;
  const toleranceBytes = options.toleranceBytes ?? Math.max(1, options.targetBytes * 0.05);
  let low = minQuality;
  let high = maxQuality;
  let bestQuality = minQuality;
  let bestBytes = options.encodeBytes(minQuality);
  let iterations = 1;

  if (bestBytes <= options.targetBytes) {
    bestQuality = minQuality;
  }

  for (; iterations < maxIterations; iterations += 1) {
    const quality = (low + high) / 2;
    const bytes = options.encodeBytes(quality);

    if (bytes <= options.targetBytes) {
      bestQuality = quality;
      bestBytes = bytes;
      low = quality;
    } else {
      high = quality;
    }
  }

  return {
    bytes: bestBytes,
    iterations,
    quality: bestQuality,
    withinTarget: bestBytes <= options.targetBytes + toleranceBytes,
  };
}

export async function findJpegQualityAsync(
  options: AsyncJpegQualitySearchOptions,
): Promise<JpegQualitySearchResult> {
  const minQuality = options.minQuality ?? 0.1;
  const maxQuality = options.maxQuality ?? 1;
  const maxIterations = options.maxIterations ?? 12;
  const toleranceBytes = options.toleranceBytes ?? Math.max(1, options.targetBytes * 0.05);
  let low = minQuality;
  let high = maxQuality;
  let bestQuality = minQuality;
  let bestBytes = await options.encodeBytes(minQuality);
  let iterations = 1;

  for (; iterations < maxIterations; iterations += 1) {
    const quality = (low + high) / 2;
    const bytes = await options.encodeBytes(quality);

    if (bytes <= options.targetBytes) {
      bestQuality = quality;
      bestBytes = bytes;
      low = quality;
    } else {
      high = quality;
    }
  }

  return {
    bytes: bestBytes,
    iterations,
    quality: bestQuality,
    withinTarget: bestBytes <= options.targetBytes + toleranceBytes,
  };
}
