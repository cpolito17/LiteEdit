export type ExportFormat = "png" | "jpeg";

export type ExportOptions = {
  format: ExportFormat;
  quality: number;
  matte: string;
  targetBytes?: number;
};

export type ExportResult = {
  blob: Blob;
  quality: number;
  targetMet: boolean;
};

export function normalizeExportFilename(name: string, format: ExportFormat): string {
  const base =
    name
      .replace(/\.[a-z0-9]{1,5}$/i, "")
      .replace(/[^a-z0-9._ -]+/gi, "-")
      .trim()
      .replace(/[. ]+$/, "") || "Untitled";
  return `${base}-edited.${format === "jpeg" ? "jpg" : "png"}`;
}

export function flattenCanvasForJpeg(source: HTMLCanvasElement, matte: string): HTMLCanvasElement {
  const output = document.createElement("canvas");
  output.width = source.width;
  output.height = source.height;
  const context = output.getContext("2d");
  if (!context) throw new Error("The browser did not provide a 2D canvas context.");
  context.fillStyle = matte;
  context.fillRect(0, 0, output.width, output.height);
  context.drawImage(source, 0, 0);
  return output;
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: "image/png" | "image/jpeg",
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("The browser encoder returned no file."))),
      type,
      quality,
    );
  });
}

export async function searchQualityWithEncoder(
  targetBytes: number,
  encoder: (quality: number) => Promise<Blob>,
  minimumQuality = 0.1,
  maximumQuality = 0.98,
  iterations = 8,
): Promise<ExportResult> {
  let low = minimumQuality;
  let high = maximumQuality;
  let best = await encoder(minimumQuality);
  let bestQuality = minimumQuality;
  for (let index = 0; index < iterations; index += 1) {
    const quality = (low + high) / 2;
    const blob = await encoder(quality);
    if (blob.size <= targetBytes) {
      best = blob;
      bestQuality = quality;
      low = quality;
    } else {
      high = quality;
    }
  }
  return {
    blob: best,
    quality: bestQuality,
    targetMet: best.size <= targetBytes * 1.05,
  };
}

export async function encodeExport(
  source: HTMLCanvasElement,
  options: ExportOptions,
): Promise<ExportResult> {
  if (options.format === "png") {
    return {
      blob: await canvasToBlob(source, "image/png"),
      quality: 1,
      targetMet: true,
    };
  }
  const canvas = flattenCanvasForJpeg(source, options.matte);
  const encode = (quality: number) => canvasToBlob(canvas, "image/jpeg", quality);
  return options.targetBytes
    ? searchQualityWithEncoder(options.targetBytes, encode)
    : {
        blob: await encode(Math.max(0.1, Math.min(1, options.quality))),
        quality: Math.max(0.1, Math.min(1, options.quality)),
        targetMet: true,
      };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
