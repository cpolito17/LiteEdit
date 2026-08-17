import { describe, expect, it } from "vitest";

import {
  clampZoom,
  documentToViewport,
  fitDocumentInViewport,
  panViewport,
  viewportToDocument,
  zoomAroundPoint,
  type ViewportTransform,
} from "./viewport";

describe("viewport transforms", () => {
  it("round-trips document and viewport coordinates", () => {
    const transform: ViewportTransform = [1.5, 0.1, -0.2, 1.25, 20, -15];
    const documentPoint = { x: 240, y: 90 };
    const viewportPoint = documentToViewport(documentPoint, transform);

    expect(viewportToDocument(viewportPoint, transform).x).toBeCloseTo(documentPoint.x);
    expect(viewportToDocument(viewportPoint, transform).y).toBeCloseTo(documentPoint.y);
  });

  it("keeps the pointer anchor fixed while zooming", () => {
    const transform: ViewportTransform = [1, 0, 0, 1, 48, 32];
    const anchor = { x: 420, y: 260 };
    const before = viewportToDocument(anchor, transform);
    const next = zoomAroundPoint(transform, 2, anchor);

    expect(documentToViewport(before, next).x).toBeCloseTo(anchor.x);
    expect(documentToViewport(before, next).y).toBeCloseTo(anchor.y);
    expect(next[0]).toBe(2);
  });

  it("fits the document inside the viewport and clamps zoom", () => {
    const transform = fitDocumentInViewport(
      { width: 1600, height: 900 },
      { width: 1000, height: 700 },
    );

    expect(transform[0]).toBeCloseTo(0.585, 5);
    expect(documentToViewport({ x: 0, y: 0 }, transform).x).toBeCloseTo(32);
    expect(documentToViewport({ x: 1600, y: 900 }, transform).y).toBeCloseTo(613.25);
    expect(clampZoom(0)).toBe(0.05);
    expect(clampZoom(99)).toBe(32);
  });

  it("adds screen-space pan without changing document scale", () => {
    const transform: ViewportTransform = [1.5, 0, 0, 1.5, 10, 20];
    expect(panViewport(transform, { x: -8, y: 14 })).toEqual([1.5, 0, 0, 1.5, 2, 34]);
  });
});
