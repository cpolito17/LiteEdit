export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface MeshTriangle {
  readonly destination: readonly [Point, Point, Point];
  readonly source: readonly [Point, Point, Point];
}

function nodeAt(nodes: readonly Point[], row: number, column: number): Point {
  const node = nodes[row * 3 + column];

  if (!node) {
    throw new Error(`Missing mesh node at row ${row}, column ${column}.`);
  }

  return node;
}

export function buildMeshTriangles(
  sourceWidth: number,
  sourceHeight: number,
  destinationNodes: readonly Point[],
): MeshTriangle[] {
  if (destinationNodes.length !== 9) {
    throw new Error("A 3 x 3 warp mesh requires exactly nine destination nodes.");
  }

  const sourceNodes = [0, 1, 2].flatMap((row) =>
    [0, 1, 2].map((column) => ({
      x: (sourceWidth / 2) * column,
      y: (sourceHeight / 2) * row,
    })),
  );
  const triangles: MeshTriangle[] = [];

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
          destination: [destinationTopLeft, destinationTopRight, destinationBottomRight],
          source: [sourceTopLeft, sourceTopRight, sourceBottomRight],
        },
        {
          destination: [destinationTopLeft, destinationBottomRight, destinationBottomLeft],
          source: [sourceTopLeft, sourceBottomRight, sourceBottomLeft],
        },
      );
    }
  }

  return triangles;
}

function barycentricWeights(point: Point, triangle: readonly [Point, Point, Point]): Point | null {
  const [a, b, c] = triangle;
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);

  if (Math.abs(denominator) < Number.EPSILON) {
    return null;
  }

  const first = ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) / denominator;
  const second = ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) / denominator;

  return { x: first, y: second };
}

function pointInTriangle(point: Point, triangle: readonly [Point, Point, Point]): boolean {
  const weights = barycentricWeights(point, triangle);

  if (!weights) {
    return false;
  }

  const third = 1 - weights.x - weights.y;
  return weights.x >= -1e-7 && weights.y >= -1e-7 && third >= -1e-7;
}

function mapPoint(point: Point, triangle: MeshTriangle): Point {
  const weights = barycentricWeights(point, triangle.destination);

  if (!weights) {
    throw new Error("Cannot map a point through a degenerate destination triangle.");
  }

  const third = 1 - weights.x - weights.y;
  const [a, b, c] = triangle.source;

  return {
    x: a.x * weights.x + b.x * weights.y + c.x * third,
    y: a.y * weights.x + b.y * weights.y + c.y * third,
  };
}

export function mapPointThroughMesh(point: Point, mesh: readonly MeshTriangle[]): Point {
  const triangle = mesh.find((candidate) => pointInTriangle(point, candidate.destination));

  if (!triangle) {
    throw new Error("Point is outside the destination mesh.");
  }

  return mapPoint(point, triangle);
}
