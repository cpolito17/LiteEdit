import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { UiButton } from "../components/primitives/Ui";
import { getLayerById, type DocumentModel, type LayerId } from "../editor/document-model";
import {
  clipDirtyRectangle,
  paintBrushSegment,
  unionDirtyRectangles,
  type BrushPoint,
  type BrushSettings,
  type DirtyRectangle,
} from "../editor/raster/brush-engine";
import { captureRasterRegion, type RasterSnapshot } from "../editor/raster/raster-snapshot";
import {
  cloneRasterSource,
  createTransparentRasterSource,
  type RasterSource,
} from "../editor/raster/raster-sources";
import {
  FabricRendererAdapter,
  renderDocumentCanvas,
  type DocumentSources,
  type RendererInteractionMode,
  type TransformGesture,
} from "../editor/renderer/fabric-adapter";
import {
  getSelectionBounds,
  selectionFromPolygon,
  selectionFromRectangle,
  type SelectionBounds,
  type SelectionCombineMode,
  type SelectionMask,
  type SelectionPoint,
} from "../editor/selection/selection-mask";
import {
  getLayerWorldTransform,
  invertMatrix,
  transformPoint,
  type TransformPoint,
} from "../editor/transform";
import {
  createShapeObject,
  type ShapeKind,
  type ShapeStyle,
} from "../editor/vector/shape-geometry";
import {
  clampZoom,
  fitDocumentInViewport,
  panViewport,
  viewportToDocument,
  zoomAroundPoint,
  type Point,
  type ViewportTransform,
} from "../editor/viewport";
import type { ToolId } from "./tool-model";

export type RasterEdit = {
  layerId: LayerId;
  bufferId: string;
  changes: Array<{ before: RasterSnapshot; after: RasterSnapshot }>;
  source: HTMLCanvasElement;
  label: string;
};

export type ViewportController = {
  renderCanvas: () => HTMLCanvasElement;
  renderPixels: () => ImageData;
};

type DocumentViewportProps = {
  model: DocumentModel;
  sources: DocumentSources;
  activeTool: ToolId;
  interactionMode: RendererInteractionMode;
  warpSession: { layerId: LayerId; nodes: TransformPoint[] } | null;
  zoomPercent: number;
  brushSettings: BrushSettings;
  selection: SelectionMask | null;
  selectionMode: SelectionCombineMode;
  autoSelectionKind: "quick" | "object";
  cropRectangle: SelectionBounds | null;
  shapeKind: ShapeKind;
  shapeStyle: ShapeStyle;
  onZoomChange: (value: number) => void;
  onPointerPosition: (point: Point | null) => void;
  onActiveLayerChange: (layerId: LayerId) => void;
  onTransformGesture: (gesture: TransformGesture) => void;
  onWarpNodesChange: (nodes: TransformPoint[]) => void;
  onStatus: (message: string) => void;
  onRasterEdit: (edit: RasterEdit) => void;
  onSelectionCommit: (mask: SelectionMask, mode: SelectionCombineMode) => void;
  onAutoSelect: (request: { seed?: SelectionPoint; region?: SelectionBounds }) => void;
  onShapeCreate: (object: ReturnType<typeof createShapeObject>) => void;
  onCropChange: (rectangle: SelectionBounds) => void;
  onPickColor: (color: string) => void;
  onControllerReady: (controller: ViewportController | null) => void;
};

type PanState = { pointerId: number; last: Point };
type WarpDragState = { pointerId: number; nodeIndex: number };
type StrokeState = {
  pointerId: number;
  layerId: LayerId;
  bufferId: string;
  source: HTMLCanvasElement;
  beforeSource: HTMLCanvasElement;
  last: BrushPoint;
  dirty: DirtyRectangle;
  dirtyTiles: Set<string>;
  worldTransform: ReturnType<typeof getLayerWorldTransform>;
};
type DrawState = {
  pointerId: number;
  kind: "marquee" | "lasso" | "shape" | "crop" | "object";
  start: SelectionPoint;
  points: SelectionPoint[];
  combineMode: SelectionCombineMode;
  constrain: boolean;
  fromCenter: boolean;
};

type LocalPointEvent = {
  currentTarget: HTMLDivElement;
  clientX: number;
  clientY: number;
};

function getLocalPoint(event: LocalPointEvent): Point {
  const bounds = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}

function getCombinationMode(
  event: { shiftKey: boolean; altKey: boolean },
  configured: SelectionCombineMode,
): SelectionCombineMode {
  if (event.shiftKey && event.altKey) return "intersect";
  if (event.altKey) return "subtract";
  if (event.shiftKey) return "add";
  return configured;
}

function ensureCanvasSource(
  source: RasterSource,
  width: number,
  height: number,
): HTMLCanvasElement {
  if (source instanceof HTMLCanvasElement && source.width === width && source.height === height) {
    return source;
  }
  const canvas = createTransparentRasterSource(width, height);
  canvas.getContext("2d")?.drawImage(source, 0, 0, width, height);
  return canvas;
}

function rgbaToHex(data: Uint8ClampedArray): string {
  return `#${[data[0] ?? 0, data[1] ?? 0, data[2] ?? 0]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

function restoreOutsideSelection(
  source: HTMLCanvasElement,
  before: HTMLCanvasElement,
  dirty: DirtyRectangle,
  selection: SelectionMask,
  worldTransform: ReturnType<typeof getLayerWorldTransform>,
): void {
  const sourceContext = source.getContext("2d", { willReadFrequently: true });
  const beforeContext = before.getContext("2d", { willReadFrequently: true });
  if (!sourceContext || !beforeContext) return;
  const current = sourceContext.getImageData(dirty.x, dirty.y, dirty.width, dirty.height);
  const original = beforeContext.getImageData(dirty.x, dirty.y, dirty.width, dirty.height);
  for (let y = 0; y < dirty.height; y += 1) {
    for (let x = 0; x < dirty.width; x += 1) {
      const documentPoint = transformPoint(
        { x: dirty.x + x + 0.5, y: dirty.y + y + 0.5 },
        worldTransform,
      );
      const documentX = Math.floor(documentPoint.x);
      const documentY = Math.floor(documentPoint.y);
      const selected =
        documentX >= 0 &&
        documentY >= 0 &&
        documentX < selection.width &&
        documentY < selection.height &&
        (selection.data[documentY * selection.width + documentX] ?? 0) > 0;
      if (selected) continue;
      const offset = (y * dirty.width + x) * 4;
      current.data.set(original.data.subarray(offset, offset + 4), offset);
    }
  }
  sourceContext.putImageData(current, dirty.x, dirty.y);
}

const RASTER_HISTORY_TILE_SIZE = 256;

function addDirtyTiles(
  tiles: Set<string>,
  dirty: DirtyRectangle,
  width: number,
  height: number,
): void {
  const clipped = clipDirtyRectangle(dirty, width, height);
  if (!clipped) return;
  const left = Math.floor(clipped.x / RASTER_HISTORY_TILE_SIZE);
  const top = Math.floor(clipped.y / RASTER_HISTORY_TILE_SIZE);
  const right = Math.floor((clipped.x + clipped.width - 1) / RASTER_HISTORY_TILE_SIZE);
  const bottom = Math.floor((clipped.y + clipped.height - 1) / RASTER_HISTORY_TILE_SIZE);
  for (let tileY = top; tileY <= bottom; tileY += 1) {
    for (let tileX = left; tileX <= right; tileX += 1) tiles.add(`${tileX},${tileY}`);
  }
}

function getTileRectangle(key: string, width: number, height: number): DirtyRectangle {
  const [tileX = 0, tileY = 0] = key.split(",").map(Number);
  const x = tileX * RASTER_HISTORY_TILE_SIZE;
  const y = tileY * RASTER_HISTORY_TILE_SIZE;
  return {
    x,
    y,
    width: Math.min(RASTER_HISTORY_TILE_SIZE, width - x),
    height: Math.min(RASTER_HISTORY_TILE_SIZE, height - y),
  };
}

export function DocumentViewport(props: DocumentViewportProps) {
  const {
    model,
    sources,
    activeTool,
    interactionMode,
    warpSession,
    zoomPercent,
    brushSettings,
    selection,
    selectionMode,
    autoSelectionKind,
    cropRectangle,
    shapeKind,
    shapeStyle,
    onZoomChange,
    onPointerPosition,
    onActiveLayerChange,
    onTransformGesture,
    onWarpNodesChange,
    onStatus,
    onRasterEdit,
    onSelectionCommit,
    onAutoSelect,
    onShapeCreate,
    onCropChange,
    onPickColor,
    onControllerReady,
  } = props;
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectionCanvasRef = useRef<HTMLCanvasElement>(null);
  const adapterRef = useRef<FabricRendererAdapter | null>(null);
  const modelRef = useRef(model);
  const sourcesRef = useRef(sources);
  const activeLayerHandlerRef = useRef(onActiveLayerChange);
  const transformGestureHandlerRef = useRef(onTransformGesture);
  const statusHandlerRef = useRef(onStatus);
  const controllerHandlerRef = useRef(onControllerReady);
  const transformRef = useRef<ViewportTransform>([1, 0, 0, 1, 0, 0]);
  const documentIdRef = useRef<string | null>(null);
  const panRef = useRef<PanState | null>(null);
  const strokeRef = useRef<StrokeState | null>(null);
  const drawRef = useRef<DrawState | null>(null);
  const warpDragRef = useRef<WarpDragState | null>(null);
  const spacePressedRef = useRef(false);
  const skipZoomEffectRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const [viewportRevision, setViewportRevision] = useState(0);
  const [draftPoints, setDraftPoints] = useState<SelectionPoint[]>([]);
  const [cursorPoint, setCursorPoint] = useState<Point | null>(null);

  modelRef.current = model;
  sourcesRef.current = sources;
  activeLayerHandlerRef.current = onActiveLayerChange;
  transformGestureHandlerRef.current = onTransformGesture;
  statusHandlerRef.current = onStatus;
  controllerHandlerRef.current = onControllerReady;

  const applyTransform = useCallback((transform: ViewportTransform) => {
    transformRef.current = transform;
    adapterRef.current?.setViewportTransform(transform);
    setViewportRevision((revision) => revision + 1);
  }, []);

  const fitToViewport = useCallback(
    (announce = true) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const next = fitDocumentInViewport(modelRef.current, {
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      });
      applyTransform(next);
      skipZoomEffectRef.current = true;
      onZoomChange(Math.round(next[0] * 100));
      if (announce) statusHandlerRef.current(`VIEW / FIT ${Math.round(next[0] * 100)}%`);
    },
    [applyTransform, onZoomChange],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) return;
    const adapter = new FabricRendererAdapter(canvas);
    adapterRef.current = adapter;
    adapter.setActiveLayerHandler((layerId) => activeLayerHandlerRef.current(layerId));
    adapter.setTransformGestureHandler((gesture) => transformGestureHandlerRef.current(gesture));
    controllerHandlerRef.current({
      renderCanvas: () => renderDocumentCanvas(modelRef.current, sourcesRef.current),
      renderPixels: () => adapter.renderDocumentPixels(modelRef.current, sourcesRef.current),
    });
    const resize = () => {
      adapter.setViewportSize(viewport.clientWidth, viewport.clientHeight);
      if (documentIdRef.current === null) fitToViewport(false);
      else adapter.setViewportTransform(transformRef.current);
      setViewportRevision((revision) => revision + 1);
    };
    resize();
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    resizeObserver?.observe(viewport);
    if (!resizeObserver) window.addEventListener("resize", resize);
    return () => {
      resizeObserver?.disconnect();
      if (!resizeObserver) window.removeEventListener("resize", resize);
      controllerHandlerRef.current(null);
      adapterRef.current = null;
      void adapter.dispose();
    };
  }, [fitToViewport]);

  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    const changedDocument = documentIdRef.current !== model.id;
    documentIdRef.current = model.id;
    adapter.setDocument(model, sources);
    if (changedDocument) {
      transformRef.current = [1, 0, 0, 1, 0, 0];
      fitToViewport(false);
    } else adapter.setViewportTransform(transformRef.current);
  }, [fitToViewport, model, sources]);

  useEffect(() => {
    adapterRef.current?.setInteractionMode(interactionMode);
    if (interactionMode !== "none") adapterRef.current?.setActiveLayer(model.activeLayerId);
  }, [interactionMode, model.activeLayerId]);

  useEffect(() => {
    if (skipZoomEffectRef.current) {
      skipZoomEffectRef.current = false;
      return;
    }
    const viewport = viewportRef.current;
    if (!viewport || !adapterRef.current) return;
    applyTransform(
      zoomAroundPoint(transformRef.current, zoomPercent / 100, {
        x: viewport.clientWidth / 2,
        y: viewport.clientHeight / 2,
      }),
    );
  }, [applyTransform, zoomPercent]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (event.code !== "Space" || target?.matches("input, textarea, select, button")) return;
      event.preventDefault();
      spacePressedRef.current = true;
      setSpacePressed(true);
    }
    function handleKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") {
        spacePressedRef.current = false;
        setSpacePressed(false);
      }
    }
    function handleWindowBlur() {
      spacePressedRef.current = false;
      setSpacePressed(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  const setZoomFromViewport = useCallback(
    (nextZoom: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      const clampedZoom = clampZoom(nextZoom);
      applyTransform(
        zoomAroundPoint(transformRef.current, clampedZoom, {
          x: viewport.clientWidth / 2,
          y: viewport.clientHeight / 2,
        }),
      );
      onZoomChange(Math.round(clampedZoom * 100));
    },
    [applyTransform, onZoomChange],
  );

  useEffect(() => {
    function handleViewportShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.matches("input, textarea, select, button") ||
        target?.closest("[role='dialog']") ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (event.key === "0") {
        event.preventDefault();
        fitToViewport();
      } else if (event.key === "1") {
        event.preventDefault();
        setZoomFromViewport(1);
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        setZoomFromViewport(Math.abs(transformRef.current[0]) * 1.25);
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setZoomFromViewport(Math.abs(transformRef.current[0]) / 1.25);
      }
    }
    window.addEventListener("keydown", handleViewportShortcut);
    return () => window.removeEventListener("keydown", handleViewportShortcut);
  }, [fitToViewport, setZoomFromViewport]);

  const toDocumentPoint = (point: Point): SelectionPoint =>
    viewportToDocument(point, transformRef.current);

  const updatePointerPosition = (point: Point) => {
    const documentPoint = toDocumentPoint(point);
    setCursorPoint(point);
    if (
      documentPoint.x < 0 ||
      documentPoint.y < 0 ||
      documentPoint.x > model.width ||
      documentPoint.y > model.height
    ) {
      onPointerPosition(null);
      return;
    }
    onPointerPosition({ x: Math.floor(documentPoint.x), y: Math.floor(documentPoint.y) });
  };

  const beginStroke = (event: React.PointerEvent<HTMLDivElement>, point: Point) => {
    const layer = getLayerById(model, model.activeLayerId);
    if (layer.kind !== "raster" || layer.locked || !layer.visible) {
      onStatus("PAINT / SELECT A VISIBLE UNLOCKED RASTER LAYER");
      return;
    }
    const rasterSource = sources[layer.bufferId];
    if (!rasterSource) return;
    const source = ensureCanvasSource(rasterSource, layer.width, layer.height);
    sourcesRef.current = { ...sourcesRef.current, [layer.bufferId]: source };
    const beforeSource = cloneRasterSource(source, layer.width, layer.height);
    const worldTransform = getLayerWorldTransform(model, layer.id);
    const local = transformPoint(toDocumentPoint(point), invertMatrix(worldTransform));
    const brushPoint = { x: local.x, y: local.y, pressure: event.pressure || 0.5 };
    const context = source.getContext("2d");
    if (!context) return;
    const dirty = paintBrushSegment(context, null, brushPoint, {
      ...brushSettings,
      mode: activeTool === "eraser" ? "erase" : "paint",
    });
    adapterRef.current?.updateRasterSource(layer.id, source);
    const dirtyTiles = new Set<string>();
    addDirtyTiles(dirtyTiles, dirty, source.width, source.height);
    event.currentTarget.setPointerCapture(event.pointerId);
    strokeRef.current = {
      pointerId: event.pointerId,
      layerId: layer.id,
      bufferId: layer.bufferId,
      source,
      beforeSource,
      last: brushPoint,
      dirty,
      dirtyTiles,
      worldTransform,
    };
  };

  const continueStroke = (event: React.PointerEvent<HTMLDivElement>, point: Point) => {
    const stroke = strokeRef.current;
    if (!stroke || stroke.pointerId !== event.pointerId) return;
    const local = transformPoint(toDocumentPoint(point), invertMatrix(stroke.worldTransform));
    const next = { x: local.x, y: local.y, pressure: event.pressure || 0.5 };
    const context = stroke.source.getContext("2d");
    if (!context) return;
    const segmentDirty = paintBrushSegment(context, stroke.last, next, {
      ...brushSettings,
      mode: activeTool === "eraser" ? "erase" : "paint",
    });
    stroke.dirty = unionDirtyRectangles(stroke.dirty, segmentDirty);
    addDirtyTiles(stroke.dirtyTiles, segmentDirty, stroke.source.width, stroke.source.height);
    stroke.last = next;
    adapterRef.current?.updateRasterSource(stroke.layerId, stroke.source);
  };

  const finishStroke = (event: React.PointerEvent<HTMLDivElement>) => {
    const stroke = strokeRef.current;
    if (!stroke || stroke.pointerId !== event.pointerId) return false;
    strokeRef.current = null;
    const clipped = clipDirtyRectangle(stroke.dirty, stroke.source.width, stroke.source.height);
    if (clipped) {
      if (selection) {
        restoreOutsideSelection(
          stroke.source,
          stroke.beforeSource,
          clipped,
          selection,
          stroke.worldTransform,
        );
      }
      const changes = [...stroke.dirtyTiles].map((tile) => {
        const rectangle = getTileRectangle(tile, stroke.source.width, stroke.source.height);
        return {
          before: captureRasterRegion(stroke.beforeSource, rectangle),
          after: captureRasterRegion(stroke.source, rectangle),
        };
      });
      adapterRef.current?.updateRasterSource(stroke.layerId, stroke.source);
      onRasterEdit({
        layerId: stroke.layerId,
        bufferId: stroke.bufferId,
        changes,
        source: stroke.source,
        label: activeTool === "eraser" ? "Eraser stroke" : "Brush stroke",
      });
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    return true;
  };

  const beginDraw = (
    event: React.PointerEvent<HTMLDivElement>,
    point: Point,
    kind: DrawState["kind"],
  ) => {
    const documentPoint = toDocumentPoint(point);
    drawRef.current = {
      pointerId: event.pointerId,
      kind,
      start: documentPoint,
      points: [documentPoint],
      combineMode: getCombinationMode(event, selectionMode),
      constrain: event.shiftKey,
      fromCenter: event.altKey,
    };
    setDraftPoints([documentPoint]);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const continueDraw = (event: React.PointerEvent<HTMLDivElement>, point: Point) => {
    const draw = drawRef.current;
    if (!draw || draw.pointerId !== event.pointerId) return;
    const documentPoint = toDocumentPoint(point);
    if (draw.kind === "lasso") draw.points.push(documentPoint);
    else draw.points = [draw.start, documentPoint];
    setDraftPoints([...draw.points]);
  };

  const finishDraw = (event: React.PointerEvent<HTMLDivElement>) => {
    const draw = drawRef.current;
    if (!draw || draw.pointerId !== event.pointerId) return false;
    drawRef.current = null;
    setDraftPoints([]);
    const end = draw.points.at(-1) ?? draw.start;
    const rectangle = {
      x: Math.min(draw.start.x, end.x),
      y: Math.min(draw.start.y, end.y),
      width: Math.max(1, Math.abs(end.x - draw.start.x)),
      height: Math.max(1, Math.abs(end.y - draw.start.y)),
    };
    if (draw.kind === "marquee") {
      onSelectionCommit(
        selectionFromRectangle(model.width, model.height, draw.start, end),
        draw.combineMode,
      );
    } else if (draw.kind === "lasso") {
      onSelectionCommit(
        selectionFromPolygon(model.width, model.height, draw.points),
        draw.combineMode,
      );
    } else if (draw.kind === "object") onAutoSelect({ region: rectangle });
    else if (draw.kind === "crop") onCropChange(rectangle);
    else {
      onShapeCreate(
        createShapeObject(shapeKind, draw.start, end, shapeStyle, {
          constrain: draw.constrain,
          fromCenter: draw.fromCenter,
        }),
      );
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    return true;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = getLocalPoint(event);
    if (activeTool === "hand" || spacePressedRef.current) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      panRef.current = { pointerId: event.pointerId, last: point };
      setIsPanning(true);
      return;
    }
    if (activeTool === "brush" || activeTool === "eraser") beginStroke(event, point);
    else if (activeTool === "marquee") beginDraw(event, point, "marquee");
    else if (activeTool === "lasso") beginDraw(event, point, "lasso");
    else if (activeTool === "shape") beginDraw(event, point, "shape");
    else if (activeTool === "crop") beginDraw(event, point, "crop");
    else if (activeTool === "select" && autoSelectionKind === "object") {
      beginDraw(event, point, "object");
    } else if (activeTool === "select") {
      onAutoSelect({ seed: toDocumentPoint(point) });
    } else if (activeTool === "picker") {
      const documentPoint = toDocumentPoint(point);
      const image = adapterRef.current?.renderDocumentPixels(model, sources);
      if (image) {
        const x = Math.max(0, Math.min(image.width - 1, Math.floor(documentPoint.x)));
        const y = Math.max(0, Math.min(image.height - 1, Math.floor(documentPoint.y)));
        const offset = (y * image.width + x) * 4;
        onPickColor(rgbaToHex(image.data.subarray(offset, offset + 4)));
      }
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = getLocalPoint(event);
    const pan = panRef.current;
    if (pan?.pointerId === event.pointerId) {
      const delta = { x: point.x - pan.last.x, y: point.y - pan.last.y };
      pan.last = point;
      applyTransform(panViewport(transformRef.current, delta));
    }
    continueStroke(event, point);
    continueDraw(event, point);
    updatePointerPosition(point);
  };

  const endPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (finishStroke(event) || finishDraw(event)) return;
    if (panRef.current?.pointerId !== event.pointerId) return;
    panRef.current = null;
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const anchor = getLocalPoint(event);
    const currentZoom = Math.max(Math.abs(transformRef.current[0]), 0.0001);
    const nextZoom = clampZoom(currentZoom * Math.exp(-event.deltaY * 0.001));
    applyTransform(zoomAroundPoint(transformRef.current, nextZoom, anchor));
    onZoomChange(Math.round(nextZoom * 100));
  };

  const selectionRenderCanvas = useMemo(() => {
    if (!selection) return null;
    const canvas = document.createElement("canvas");
    canvas.width = selection.width;
    canvas.height = selection.height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const image = context.createImageData(selection.width, selection.height);
    for (let index = 0; index < selection.data.length; index += 1) {
      if ((selection.data[index] ?? 0) === 0) continue;
      const offset = index * 4;
      image.data[offset] = 112;
      image.data[offset + 1] = 255;
      image.data[offset + 2] = 210;
      image.data[offset + 3] = 38;
    }
    context.putImageData(image, 0, 0);
    return canvas;
  }, [selection]);

  useEffect(() => {
    const canvas = selectionCanvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) return;
    canvas.width = Math.max(1, viewport.clientWidth);
    canvas.height = Math.max(1, viewport.clientHeight);
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!selectionRenderCanvas) return;
    context.save();
    context.setTransform(...transformRef.current);
    context.imageSmoothingEnabled = false;
    context.drawImage(selectionRenderCanvas, 0, 0);
    context.restore();
  }, [selectionRenderCanvas, viewportRevision]);

  const isHandMode = activeTool === "hand" || spacePressed;
  const warpLayer = warpSession ? getLayerById(model, warpSession.layerId) : null;
  const warpWorldTransform = warpSession
    ? getLayerWorldTransform(model, warpSession.layerId)
    : null;
  const warpOverlayPoints =
    warpSession && warpWorldTransform
      ? warpSession.nodes.map((node) =>
          transformPoint(transformPoint(node, warpWorldTransform), transformRef.current),
        )
      : [];
  const getWarpLine = (indices: [number, number, number]) =>
    indices
      .map((index) => {
        const point = warpOverlayPoints[index];
        return point ? `${point.x},${point.y}` : "";
      })
      .join(" ");

  const updateWarpNodeFromClient = (nodeIndex: number, clientX: number, clientY: number) => {
    if (!warpSession || !warpWorldTransform || warpLayer?.kind !== "raster") return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const bounds = viewport.getBoundingClientRect();
    const documentPoint = viewportToDocument(
      { x: clientX - bounds.left, y: clientY - bounds.top },
      transformRef.current,
    );
    const localPoint = transformPoint(documentPoint, invertMatrix(warpWorldTransform));
    onWarpNodesChange(
      warpSession.nodes.map((node, index) =>
        index === nodeIndex
          ? {
              x: Math.max(-warpLayer.width, Math.min(warpLayer.width * 2, localPoint.x)),
              y: Math.max(-warpLayer.height, Math.min(warpLayer.height * 2, localPoint.y)),
            }
          : node,
      ),
    );
  };

  const nudgeWarpNode = (nodeIndex: number, deltaX: number, deltaY: number) => {
    if (!warpSession) return;
    onWarpNodesChange(
      warpSession.nodes.map((node, index) =>
        index === nodeIndex ? { x: node.x + deltaX, y: node.y + deltaY } : node,
      ),
    );
  };

  const selectionBounds = getSelectionBounds(selection);
  const toViewportRectangle = (bounds: SelectionBounds | null) => {
    if (!bounds) return null;
    const topLeft = transformPoint({ x: bounds.x, y: bounds.y }, transformRef.current);
    const bottomRight = transformPoint(
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      transformRef.current,
    );
    return {
      x: Math.min(topLeft.x, bottomRight.x),
      y: Math.min(topLeft.y, bottomRight.y),
      width: Math.abs(bottomRight.x - topLeft.x),
      height: Math.abs(bottomRight.y - topLeft.y),
    };
  };
  const antsBounds = toViewportRectangle(selectionBounds);
  const cropBounds = toViewportRectangle(cropRectangle);
  const draftViewportPoints = draftPoints.map((point) =>
    transformPoint(point, transformRef.current),
  );

  return (
    <div
      ref={viewportRef}
      className={`document-viewport${isHandMode ? " is-hand" : ""}${isPanning ? " is-panning" : ""}`}
      data-testid="document-viewport"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onPointerLeave={() => {
        if (!panRef.current && !strokeRef.current && !drawRef.current) onPointerPosition(null);
        setCursorPoint(null);
      }}
      onWheel={handleWheel}
      aria-label={`${model.name} document viewport`}
    >
      <canvas ref={canvasRef} aria-label={`${model.name} document`} />
      <canvas ref={selectionCanvasRef} className="selection-mask-overlay" aria-hidden="true" />
      <svg className="editor-overlay" aria-hidden="true">
        {antsBounds ? (
          <rect
            className="selection-ants"
            x={antsBounds.x}
            y={antsBounds.y}
            width={antsBounds.width}
            height={antsBounds.height}
          />
        ) : null}
        {cropBounds ? (
          <rect
            className="crop-outline"
            x={cropBounds.x}
            y={cropBounds.y}
            width={cropBounds.width}
            height={cropBounds.height}
          />
        ) : null}
        {draftViewportPoints.length > 1 ? (
          drawRef.current?.kind === "lasso" ? (
            <polyline
              className="draft-outline"
              points={draftViewportPoints.map((point) => `${point.x},${point.y}`).join(" ")}
            />
          ) : (
            <rect
              className="draft-outline"
              x={Math.min(draftViewportPoints[0]?.x ?? 0, draftViewportPoints[1]?.x ?? 0)}
              y={Math.min(draftViewportPoints[0]?.y ?? 0, draftViewportPoints[1]?.y ?? 0)}
              width={Math.abs((draftViewportPoints[1]?.x ?? 0) - (draftViewportPoints[0]?.x ?? 0))}
              height={Math.abs((draftViewportPoints[1]?.y ?? 0) - (draftViewportPoints[0]?.y ?? 0))}
            />
          )
        ) : null}
        {cursorPoint && (activeTool === "brush" || activeTool === "eraser") ? (
          <circle
            className="brush-cursor"
            cx={cursorPoint.x}
            cy={cursorPoint.y}
            r={Math.max(0.5, (brushSettings.diameter * zoomPercent) / 200)}
          />
        ) : null}
      </svg>
      {warpSession && warpOverlayPoints.length === 9 ? (
        <svg className="warp-overlay" aria-label="3 by 3 raster warp mesh">
          {(
            [
              [0, 1, 2],
              [3, 4, 5],
              [6, 7, 8],
              [0, 3, 6],
              [1, 4, 7],
              [2, 5, 8],
            ] as Array<[number, number, number]>
          ).map((indices) => (
            <polyline key={indices.join("-")} points={getWarpLine(indices)} />
          ))}
          {warpOverlayPoints.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={6}
              role="slider"
              tabIndex={0}
              aria-label={`Warp node ${index + 1}`}
              aria-valuetext={`X ${Math.round(warpSession.nodes[index]?.x ?? 0)}, Y ${Math.round(warpSession.nodes[index]?.y ?? 0)}`}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.setPointerCapture(event.pointerId);
                warpDragRef.current = { pointerId: event.pointerId, nodeIndex: index };
              }}
              onPointerMove={(event) => {
                if (warpDragRef.current?.pointerId !== event.pointerId) return;
                event.preventDefault();
                event.stopPropagation();
                updateWarpNodeFromClient(index, event.clientX, event.clientY);
              }}
              onPointerUp={(event) => {
                if (warpDragRef.current?.pointerId !== event.pointerId) return;
                warpDragRef.current = null;
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
              }}
              onPointerCancel={() => {
                warpDragRef.current = null;
              }}
              onKeyDown={(event) => {
                const distance = event.shiftKey ? 10 : 1;
                if (event.key === "ArrowLeft") nudgeWarpNode(index, -distance, 0);
                else if (event.key === "ArrowRight") nudgeWarpNode(index, distance, 0);
                else if (event.key === "ArrowUp") nudgeWarpNode(index, 0, -distance);
                else if (event.key === "ArrowDown") nudgeWarpNode(index, 0, distance);
                else return;
                event.preventDefault();
                event.stopPropagation();
              }}
            />
          ))}
        </svg>
      ) : null}
      <div className="viewport-actions" role="group" aria-label="Viewport controls">
        <UiButton
          className="viewport-button"
          aria-label="Fit document"
          onClick={() => fitToViewport()}
        >
          FIT
        </UiButton>
        <UiButton
          className="viewport-button"
          aria-label="Zoom to 100 percent"
          onClick={() => setZoomFromViewport(1)}
        >
          100%
        </UiButton>
        <span className="viewport-zoom-label" aria-live="polite">
          {zoomPercent}%
        </span>
      </div>
    </div>
  );
}

export function getDocumentPointerLabel(point: Point | null): string {
  if (!point) return "X — / Y —";
  return `X ${String(Math.max(0, point.x)).padStart(4, "0")} / Y ${String(Math.max(0, point.y)).padStart(4, "0")}`;
}
