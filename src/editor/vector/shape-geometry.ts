import type { SerializedVectorObject } from "../document-model";

export type ShapeKind =
  "rectangle" | "ellipse" | "triangle" | "polygon" | "star" | "line" | "arrow";

export type ShapeStyle = {
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  sides: number;
};

export type ShapePoint = { x: number; y: number };

export function regularPolygonPoints(
  center: ShapePoint,
  radiusX: number,
  radiusY: number,
  sides: number,
  innerRatio = 1,
): ShapePoint[] {
  const safeSides = Math.max(3, Math.min(12, Math.round(sides)));
  const count = innerRatio < 1 ? safeSides * 2 : safeSides;
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
    const ratio = innerRatio < 1 && index % 2 === 1 ? innerRatio : 1;
    return {
      x: center.x + Math.cos(angle) * radiusX * ratio,
      y: center.y + Math.sin(angle) * radiusY * ratio,
    };
  });
}

export function createShapeObject(
  kind: ShapeKind,
  start: ShapePoint,
  end: ShapePoint,
  style: ShapeStyle,
  options: { constrain?: boolean; fromCenter?: boolean } = {},
): SerializedVectorObject {
  let left = Math.min(start.x, end.x);
  let top = Math.min(start.y, end.y);
  let width = Math.max(1, Math.abs(end.x - start.x));
  let height = Math.max(1, Math.abs(end.y - start.y));
  if (options.constrain) {
    const size = Math.max(width, height);
    width = size;
    height = size;
    left = end.x < start.x ? start.x - size : start.x;
    top = end.y < start.y ? start.y - size : start.y;
  }
  if (options.fromCenter) {
    left = start.x - width;
    top = start.y - height;
    width *= 2;
    height *= 2;
  }
  return {
    type: "shape",
    properties: {
      kind,
      left,
      top,
      width,
      height,
      startX: start.x,
      startY: start.y,
      endX: end.x,
      endY: end.y,
      fill: style.fill,
      stroke: style.stroke,
      strokeWidth: Math.max(0, style.strokeWidth),
      sides: Math.max(3, Math.min(12, Math.round(style.sides))),
    },
  };
}
