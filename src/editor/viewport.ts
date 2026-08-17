export type Point = { x: number; y: number };
export type ViewportTransform = [number, number, number, number, number, number];

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 32;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function documentToViewport(point: Point, transform: ViewportTransform): Point {
  const [a, b, c, d, e, f] = transform;
  return {
    x: a * point.x + c * point.y + e,
    y: b * point.x + d * point.y + f,
  };
}

export function viewportToDocument(point: Point, transform: ViewportTransform): Point {
  const [a, b, c, d, e, f] = transform;
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < Number.EPSILON) {
    throw new Error("Viewport transform cannot be inverted.");
  }

  const translatedX = point.x - e;
  const translatedY = point.y - f;
  return {
    x: (d * translatedX - c * translatedY) / determinant,
    y: (-b * translatedX + a * translatedY) / determinant,
  };
}

export function zoomAroundPoint(
  transform: ViewportTransform,
  nextZoom: number,
  anchor: Point,
): ViewportTransform {
  const currentZoom = Math.max(Math.abs(transform[0]), Number.EPSILON);
  const scale = clampZoom(nextZoom) / currentZoom;
  const documentAnchor = viewportToDocument(anchor, transform);
  const next: ViewportTransform = [
    transform[0] * scale,
    transform[1] * scale,
    transform[2] * scale,
    transform[3] * scale,
    0,
    0,
  ];
  next[4] = anchor.x - next[0] * documentAnchor.x - next[2] * documentAnchor.y;
  next[5] = anchor.y - next[1] * documentAnchor.x - next[3] * documentAnchor.y;
  return next;
}

export function panViewport(transform: ViewportTransform, delta: Point): ViewportTransform {
  return [
    transform[0],
    transform[1],
    transform[2],
    transform[3],
    transform[4] + delta.x,
    transform[5] + delta.y,
  ];
}

export function fitDocumentInViewport(
  documentSize: { width: number; height: number },
  viewportSize: { width: number; height: number },
  padding = 32,
): ViewportTransform {
  const availableWidth = Math.max(1, viewportSize.width - padding * 2);
  const availableHeight = Math.max(1, viewportSize.height - padding * 2);
  const zoom = clampZoom(
    Math.min(availableWidth / documentSize.width, availableHeight / documentSize.height),
  );
  return [
    zoom,
    0,
    0,
    zoom,
    (viewportSize.width - documentSize.width * zoom) / 2,
    (viewportSize.height - documentSize.height * zoom) / 2,
  ];
}
