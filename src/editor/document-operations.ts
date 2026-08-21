import {
  assertDocumentInvariant,
  assertSupportedDimensions,
  cloneDocumentModel,
  type DocumentModel,
  type Matrix2D,
} from "./document-model";
import { multiplyMatrices } from "./transform";

export type CropRectangle = { x: number; y: number; width: number; height: number };
export type ResamplingMode = "nearest" | "bilinear" | "high";

export function normalizeCropRectangle(
  rectangle: CropRectangle,
  documentWidth: number,
  documentHeight: number,
): CropRectangle {
  const x = Math.max(0, Math.min(documentWidth - 1, Math.floor(rectangle.x)));
  const y = Math.max(0, Math.min(documentHeight - 1, Math.floor(rectangle.y)));
  const width = Math.max(1, Math.min(documentWidth - x, Math.round(rectangle.width)));
  const height = Math.max(1, Math.min(documentHeight - y, Math.round(rectangle.height)));
  return { x, y, width, height };
}

function transformRootLayers(document: DocumentModel, matrix: Matrix2D): DocumentModel {
  const next = cloneDocumentModel(document);
  const rootIds = new Set(next.rootLayerIds);
  next.layers = next.layers.map((layer) =>
    rootIds.has(layer.id)
      ? { ...layer, transform: multiplyMatrices(matrix, layer.transform) }
      : layer,
  );
  return next;
}

export function cropDocument(document: DocumentModel, rectangle: CropRectangle): DocumentModel {
  const crop = normalizeCropRectangle(rectangle, document.width, document.height);
  const next = transformRootLayers(document, [1, 0, 0, 1, -crop.x, -crop.y]);
  next.width = crop.width;
  next.height = crop.height;
  assertDocumentInvariant(next);
  return next;
}

export function resizeDocument(
  document: DocumentModel,
  width: number,
  height: number,
  resampling: ResamplingMode,
): DocumentModel {
  assertSupportedDimensions(width, height);
  const scaleX = width / document.width;
  const scaleY = height / document.height;
  const next = transformRootLayers(document, [scaleX, 0, 0, scaleY, 0, 0]);
  next.width = width;
  next.height = height;
  next.resampling = resampling;
  assertDocumentInvariant(next);
  return next;
}
