import {
  cloneRasterSource,
  createTransparentRasterSource,
  type RasterSource,
} from "./raster-sources";
import type { LayerBounds, TransformPoint } from "../transform";

export type RasterTransformScope =
  { kind: "layer" } | { kind: "selection"; bounds: LayerBounds; maskId: string };

export type WarpOperation = {
  scope: RasterTransformScope;
  destinationNodes: readonly TransformPoint[];
};

export type WarpTriangle = {
  source: readonly [TransformPoint, TransformPoint, TransformPoint];
  destination: readonly [TransformPoint, TransformPoint, TransformPoint];
};

function nodeAt(nodes: readonly TransformPoint[], row: number, column: number): TransformPoint {
  const node = nodes[row * 3 + column];
  if (!node) {
    throw new Error(`Missing warp node at row ${row}, column ${column}.`);
  }
  return node;
}

export function createDefaultWarpNodes(width: number, height: number): TransformPoint[] {
  return [0, 1, 2].flatMap((row) =>
    [0, 1, 2].map((column) => ({
      x: (width / 2) * column,
      y: (height / 2) * row,
    })),
  );
}

export function buildWarpTriangles(
  width: number,
  height: number,
  destinationNodes: readonly TransformPoint[],
): WarpTriangle[] {
  if (destinationNodes.length !== 9) {
    throw new Error("A 3 x 3 warp mesh requires exactly nine destination nodes.");
  }
  if (destinationNodes.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
    throw new Error("Warp nodes must contain finite coordinates.");
  }
  const sourceNodes = createDefaultWarpNodes(width, height);
  const triangles: WarpTriangle[] = [];
  for (let row = 0; row < 2; row += 1) {
    for (let column = 0; column < 2; column += 1) {
      const sourceTopLeft = nodeAt(sourceNodes, row, column);
      const sourceTopRight = nodeAt(sourceNodes, row, column + 1);
      const sourceBottomLeft = nodeAt(sourceNodes, row + 1, column);
      const sourceBottomRight = nodeAt(sourceNodes, row + 1, column + 1);
      const destinationTopLeft = nodeAt(destinationNodes, row, column);
      const destinationTopRight = nodeAt(destinationNodes, row, column + 1);
      const destinationBottomLeft = nodeAt(destinationNodes, row + 1, column);
      const destinationBottomRight = nodeAt(destinationNodes, row + 1, column + 1);
      triangles.push(
        {
          source: [sourceTopLeft, sourceTopRight, sourceBottomRight],
          destination: [destinationTopLeft, destinationTopRight, destinationBottomRight],
        },
        {
          source: [sourceTopLeft, sourceBottomRight, sourceBottomLeft],
          destination: [destinationTopLeft, destinationBottomRight, destinationBottomLeft],
        },
      );
    }
  }
  for (const triangle of triangles) {
    if (signedArea(triangle.destination) <= 1e-4) {
      throw new Error("Warp nodes cannot fold or collapse the mesh.");
    }
  }
  return triangles;
}

function signedArea(points: readonly [TransformPoint, TransformPoint, TransformPoint]): number {
  const [a, b, c] = points;
  return ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
}

function getTriangleTransform(
  triangle: WarpTriangle,
): [number, number, number, number, number, number] {
  const [sourceA, sourceB, sourceC] = triangle.source;
  const [destinationA, destinationB, destinationC] = triangle.destination;
  const sourceX1 = sourceB.x - sourceA.x;
  const sourceY1 = sourceB.y - sourceA.y;
  const sourceX2 = sourceC.x - sourceA.x;
  const sourceY2 = sourceC.y - sourceA.y;
  const destinationX1 = destinationB.x - destinationA.x;
  const destinationY1 = destinationB.y - destinationA.y;
  const destinationX2 = destinationC.x - destinationA.x;
  const destinationY2 = destinationC.y - destinationA.y;
  const determinant = sourceX1 * sourceY2 - sourceY1 * sourceX2;
  if (Math.abs(determinant) < 1e-8) {
    throw new Error("The source warp triangle is singular.");
  }
  const a = (destinationX1 * sourceY2 - destinationX2 * sourceY1) / determinant;
  const c = (-destinationX1 * sourceX2 + destinationX2 * sourceX1) / determinant;
  const b = (destinationY1 * sourceY2 - destinationY2 * sourceY1) / determinant;
  const d = (-destinationY1 * sourceX2 + destinationY2 * sourceX1) / determinant;
  return [
    a,
    b,
    c,
    d,
    destinationA.x - a * sourceA.x - c * sourceA.y,
    destinationA.y - b * sourceA.x - d * sourceA.y,
  ];
}

function expandTriangle(
  points: readonly [TransformPoint, TransformPoint, TransformPoint],
  amount: number,
): readonly [TransformPoint, TransformPoint, TransformPoint] {
  const center = {
    x: (points[0].x + points[1].x + points[2].x) / 3,
    y: (points[0].y + points[1].y + points[2].y) / 3,
  };
  return points.map((point) => {
    const distance = Math.hypot(point.x - center.x, point.y - center.y) || 1;
    return {
      x: point.x + ((point.x - center.x) / distance) * amount,
      y: point.y + ((point.y - center.y) / distance) * amount,
    };
  }) as unknown as readonly [TransformPoint, TransformPoint, TransformPoint];
}

function nodesAreIdentity(
  nodes: readonly TransformPoint[],
  width: number,
  height: number,
): boolean {
  const identity = createDefaultWarpNodes(width, height);
  return identity.every(
    (point, index) =>
      Math.abs(point.x - (nodes[index]?.x ?? Number.NaN)) < 1e-8 &&
      Math.abs(point.y - (nodes[index]?.y ?? Number.NaN)) < 1e-8,
  );
}

function createEdgePaddedSource(
  source: RasterSource,
  width: number,
  height: number,
  padding: number,
): HTMLCanvasElement {
  const normalized = cloneRasterSource(source, width, height);
  const padded = createTransparentRasterSource(width + padding * 2, height + padding * 2);
  const context = padded.getContext("2d");
  if (!context) {
    throw new Error("The browser did not provide a 2D canvas context.");
  }
  context.imageSmoothingEnabled = false;
  context.drawImage(normalized, padding, padding);
  context.drawImage(normalized, 0, 0, width, 1, padding, 0, width, padding);
  context.drawImage(normalized, 0, height - 1, width, 1, padding, padding + height, width, padding);
  context.drawImage(normalized, 0, 0, 1, height, 0, padding, padding, height);
  context.drawImage(normalized, width - 1, 0, 1, height, padding + width, padding, padding, height);
  context.drawImage(normalized, 0, 0, 1, 1, 0, 0, padding, padding);
  context.drawImage(normalized, width - 1, 0, 1, 1, padding + width, 0, padding, padding);
  context.drawImage(normalized, 0, height - 1, 1, 1, 0, padding + height, padding, padding);
  context.drawImage(
    normalized,
    width - 1,
    height - 1,
    1,
    1,
    padding + width,
    padding + height,
    padding,
    padding,
  );
  return padded;
}

export function warpRasterSource(
  source: RasterSource,
  width: number,
  height: number,
  operation: WarpOperation,
): HTMLCanvasElement {
  if (operation.scope.kind === "selection") {
    throw new Error("Selection-scoped transforms require the Phase 8 selection mask store.");
  }
  const triangles = buildWarpTriangles(width, height, operation.destinationNodes);
  if (nodesAreIdentity(operation.destinationNodes, width, height)) {
    return cloneRasterSource(source, width, height);
  }

  const output = createTransparentRasterSource(width, height);
  const context = output.getContext("2d");
  if (!context) {
    throw new Error("The browser did not provide a 2D canvas context.");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  const padding = 2;
  const paddedSource = createEdgePaddedSource(source, width, height, padding);

  for (const triangle of triangles) {
    // Clip beyond shared edges so antialiasing cannot expose a one-pixel mesh seam.
    const clip = expandTriangle(triangle.destination, 1.5);
    const matrix = getTriangleTransform(triangle);
    context.save();
    context.beginPath();
    context.moveTo(clip[0].x, clip[0].y);
    context.lineTo(clip[1].x, clip[1].y);
    context.lineTo(clip[2].x, clip[2].y);
    context.closePath();
    context.clip();
    context.globalCompositeOperation = "copy";
    context.setTransform(...matrix);
    context.drawImage(paddedSource, -padding, -padding);
    context.restore();
  }
  return output;
}
