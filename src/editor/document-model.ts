export const MAX_DOCUMENT_DIMENSION = 8192;
export const MAX_DOCUMENT_PIXELS = 32_000_000;

export type DocumentBackground = "transparent" | "white" | "black";

export type RasterLayer = {
  id: string;
  kind: "raster";
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type DocumentModel = {
  id: string;
  name: string;
  width: number;
  height: number;
  background: DocumentBackground;
  layers: RasterLayer[];
  activeLayerId: string;
};

export type DocumentDimensions = Pick<DocumentModel, "width" | "height">;

let generatedId = 0;

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  generatedId += 1;
  return `${prefix}-${generatedId}`;
}

export function assertSupportedDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new Error("Document dimensions must be positive whole numbers.");
  }

  if (width > MAX_DOCUMENT_DIMENSION || height > MAX_DOCUMENT_DIMENSION) {
    throw new Error(`Document dimensions cannot exceed ${MAX_DOCUMENT_DIMENSION} px.`);
  }

  if (width * height > MAX_DOCUMENT_PIXELS) {
    throw new Error("Document pixel count exceeds the safe browser limit.");
  }
}

function createRasterLayer(name: string, width: number, height: number): RasterLayer {
  return {
    id: createId("layer"),
    kind: "raster",
    name,
    visible: true,
    locked: false,
    opacity: 1,
    left: 0,
    top: 0,
    width,
    height,
  };
}

export function createDocumentModel(options: {
  name: string;
  width: number;
  height: number;
  background: DocumentBackground;
  layerName: string;
}): DocumentModel {
  assertSupportedDimensions(options.width, options.height);
  const layer = createRasterLayer(options.layerName, options.width, options.height);
  const model: DocumentModel = {
    id: createId("document"),
    name: options.name,
    width: options.width,
    height: options.height,
    background: options.background,
    layers: [layer],
    activeLayerId: layer.id,
  };

  assertDocumentInvariant(model);
  return model;
}

export function createBlankDocument(options: {
  width: number;
  height: number;
  background: DocumentBackground;
}): DocumentModel {
  return createDocumentModel({
    ...options,
    name: "Untitled",
    layerName: "Background",
  });
}

export function createImportedDocument(options: {
  name: string;
  width: number;
  height: number;
}): DocumentModel {
  return createDocumentModel({
    ...options,
    background: "transparent",
    layerName: options.name,
  });
}

export function assertDocumentInvariant(document: DocumentModel): void {
  assertSupportedDimensions(document.width, document.height);

  if (document.layers.length === 0) {
    throw new Error("A document must contain at least one layer.");
  }

  if (!document.layers.some((layer) => layer.id === document.activeLayerId)) {
    throw new Error("The active layer must exist in the document layer list.");
  }

  const ids = new Set<string>();
  for (const layer of document.layers) {
    if (ids.has(layer.id)) {
      throw new Error("Document layer IDs must be unique.");
    }
    ids.add(layer.id);

    if (layer.width < 1 || layer.height < 1) {
      throw new Error("Layer dimensions must be positive.");
    }

    if (layer.opacity < 0 || layer.opacity > 1) {
      throw new Error("Layer opacity must be between 0 and 1.");
    }
  }
}
