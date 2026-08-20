import { getLayerById, type DocumentModel, type LayerId, type Matrix2D } from "./document-model";

export type TransformPoint = {
  x: number;
  y: number;
};

export type LayerBounds = TransformPoint & {
  width: number;
  height: number;
};

export type TransformFields = {
  /** Center position in the parent coordinate plane. */
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  skew: number;
};

const MIN_SCALE = 0.01;
const MAX_SCALE = 100;
const MAX_SKEW = 85;

export function multiplyMatrices(left: Matrix2D, right: Matrix2D): Matrix2D {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

export function invertMatrix(matrix: Matrix2D): Matrix2D {
  const determinant = matrix[0] * matrix[3] - matrix[1] * matrix[2];
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-8) {
    throw new Error("The transform matrix cannot be singular.");
  }
  return [
    matrix[3] / determinant,
    -matrix[1] / determinant,
    -matrix[2] / determinant,
    matrix[0] / determinant,
    (matrix[2] * matrix[5] - matrix[3] * matrix[4]) / determinant,
    (matrix[1] * matrix[4] - matrix[0] * matrix[5]) / determinant,
  ];
}

export function transformPoint(point: TransformPoint, matrix: Matrix2D): TransformPoint {
  return {
    x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
    y: matrix[1] * point.x + matrix[3] * point.y + matrix[5],
  };
}

function boundsFromPoints(points: TransformPoint[]): LayerBounds {
  const xValues = points.map((point) => point.x);
  const yValues = points.map((point) => point.y);
  const left = Math.min(...xValues);
  const top = Math.min(...yValues);
  const right = Math.max(...xValues);
  const bottom = Math.max(...yValues);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function transformBounds(bounds: LayerBounds, matrix: Matrix2D): LayerBounds {
  return boundsFromPoints([
    transformPoint({ x: bounds.x, y: bounds.y }, matrix),
    transformPoint({ x: bounds.x + bounds.width, y: bounds.y }, matrix),
    transformPoint({ x: bounds.x + bounds.width, y: bounds.y + bounds.height }, matrix),
    transformPoint({ x: bounds.x, y: bounds.y + bounds.height }, matrix),
  ]);
}

export function getLayerLocalBounds(document: DocumentModel, layerId: LayerId): LayerBounds {
  const layer = getLayerById(document, layerId);
  if (layer.kind === "raster") {
    return { x: 0, y: 0, width: layer.width, height: layer.height };
  }
  if (layer.kind === "vector") {
    const width = Number(layer.object.properties.width ?? 1);
    const height = Number(layer.object.properties.height ?? 1);
    return {
      x: 0,
      y: 0,
      width: Number.isFinite(width) && width > 0 ? width : 1,
      height: Number.isFinite(height) && height > 0 ? height : 1,
    };
  }
  if (layer.childIds.length === 0) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }

  const childBounds = layer.childIds.map((childId) => {
    const child = getLayerById(document, childId);
    return transformBounds(getLayerLocalBounds(document, childId), child.transform);
  });
  return boundsFromPoints(
    childBounds.flatMap((bounds) => [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
    ]),
  );
}

export function getLayerWorldTransform(document: DocumentModel, layerId: LayerId): Matrix2D {
  let current = getLayerById(document, layerId);
  let matrix = [...current.transform] as Matrix2D;
  while (current.parentId !== null) {
    current = getLayerById(document, current.parentId);
    matrix = multiplyMatrices(current.transform, matrix);
  }
  return matrix;
}

function degrees(value: number): number {
  return (value * 180) / Math.PI;
}

function radians(value: number): number {
  return (value * Math.PI) / 180;
}

export function getTransformFields(document: DocumentModel, layerId: LayerId): TransformFields {
  const layer = getLayerById(document, layerId);
  const [a, b, c, d] = layer.transform;
  const scaleX = Math.sqrt(a * a + b * b);
  if (scaleX < MIN_SCALE) {
    throw new Error("The transform scale is too small.");
  }
  const scaleY = (a * d - b * c) / scaleX;
  const rotation = degrees(Math.atan2(b, a));
  const skewTangent = (a * c + b * d) / (scaleX * scaleY);
  const skew = degrees(Math.atan(skewTangent));
  const bounds = getLayerLocalBounds(document, layerId);
  const center = transformPoint(
    { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    layer.transform,
  );
  return {
    x: center.x,
    y: center.y,
    scaleX: scaleX * 100,
    scaleY: scaleY * 100,
    rotation,
    skew,
  };
}

export function composeLayerTransform(
  document: DocumentModel,
  layerId: LayerId,
  fields: TransformFields,
): Matrix2D {
  const values = Object.values(fields);
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("Transform values must be finite numbers.");
  }
  const scaleX = Math.max(MIN_SCALE, Math.min(MAX_SCALE, fields.scaleX / 100));
  const scaleY = Math.max(MIN_SCALE, Math.min(MAX_SCALE, fields.scaleY / 100));
  const skew = Math.max(-MAX_SKEW, Math.min(MAX_SKEW, fields.skew));
  const angle = radians(fields.rotation);
  const skewRadians = radians(skew);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const tangent = Math.tan(skewRadians);

  // Rotation * horizontal skew * scale.
  const a = cosine * scaleX;
  const b = sine * scaleX;
  const c = (cosine * tangent - sine) * scaleY;
  const d = (sine * tangent + cosine) * scaleY;
  const bounds = getLayerLocalBounds(document, layerId);
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  return [
    a,
    b,
    c,
    d,
    fields.x - (a * centerX + c * centerY),
    fields.y - (b * centerX + d * centerY),
  ];
}

export function translateMatrix(matrix: Matrix2D, deltaX: number, deltaY: number): Matrix2D {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
    throw new Error("Move offsets must be finite numbers.");
  }
  return [matrix[0], matrix[1], matrix[2], matrix[3], matrix[4] + deltaX, matrix[5] + deltaY];
}
