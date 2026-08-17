import {
  assertSupportedDimensions,
  createImportedDocument,
  MAX_DOCUMENT_DIMENSION,
  MAX_DOCUMENT_PIXELS,
} from "./document-model";

export const MAX_IMAGE_FILE_BYTES = 100 * 1024 * 1024;

const supportedMimeTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const supportedExtensions = new Set(["png", "jpg", "jpeg", "webp"]);
const extensionMimeTypes: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export type DecodedLocalImage = {
  source: HTMLImageElement;
  name: string;
  width: number;
  height: number;
};

export class ImageImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageImportError";
  }
}

function getExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function getBaseName(name: string): string {
  const baseName = name.replace(/\.[^.]+$/, "").trim();
  return baseName || "Untitled";
}

export function validateImageFile(file: Pick<File, "name" | "size" | "type">): void {
  if (file.size > MAX_IMAGE_FILE_BYTES) {
    throw new ImageImportError("This file exceeds the 100 MB local import limit.");
  }

  const extension = getExtension(file.name);
  const expectedMimeType = extensionMimeTypes[extension];
  if (
    !supportedExtensions.has(extension) ||
    (file.type && (!supportedMimeTypes.has(file.type) || file.type !== expectedMimeType))
  ) {
    throw new ImageImportError("LiteEdit accepts PNG, JPEG, and browser-decodable WebP files.");
  }
}

export function validateDecodedDimensions(width: number, height: number): void {
  try {
    assertSupportedDimensions(width, height);
  } catch (error) {
    if (width > MAX_DOCUMENT_DIMENSION || height > MAX_DOCUMENT_DIMENSION) {
      throw new ImageImportError(`Images cannot exceed ${MAX_DOCUMENT_DIMENSION} px on one side.`);
    }
    if (width * height > MAX_DOCUMENT_PIXELS) {
      throw new ImageImportError("This image has too many pixels for a safe browser document.");
    }
    throw new ImageImportError(
      error instanceof Error ? error.message : "Invalid image dimensions.",
    );
  }
}

export async function decodeLocalImage(file: File): Promise<DecodedLocalImage> {
  validateImageFile(file);

  const objectUrl = URL.createObjectURL(file);
  try {
    const source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(new ImageImportError("The browser could not decode this image."));
      image.src = objectUrl;
    });

    validateDecodedDimensions(source.naturalWidth, source.naturalHeight);
    return {
      source,
      name: getBaseName(file.name),
      width: source.naturalWidth,
      height: source.naturalHeight,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function createBlankSource(
  width: number,
  height: number,
  background: "transparent" | "white" | "black",
): HTMLCanvasElement {
  validateDecodedDimensions(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new ImageImportError("The browser did not provide a 2D canvas context.");
  }

  if (background !== "transparent") {
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);
  }

  return canvas;
}

export function createDocumentFromDecodedImage(image: DecodedLocalImage) {
  return createImportedDocument({
    name: image.name,
    width: image.width,
    height: image.height,
  });
}
