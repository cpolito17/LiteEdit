import { useCallback, useEffect, useRef, useState } from "react";

import { getLayerById, type DocumentModel, type LayerId } from "../editor/document-model";
import {
  FabricRendererAdapter,
  type DocumentSources,
  type RendererInteractionMode,
  type TransformGesture,
} from "../editor/renderer/fabric-adapter";
import {
  getLayerWorldTransform,
  invertMatrix,
  transformPoint,
  type TransformPoint,
} from "../editor/transform";
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
import { UiButton } from "../components/primitives/Ui";

type DocumentViewportProps = {
  model: DocumentModel;
  sources: DocumentSources;
  activeTool: ToolId;
  interactionMode: RendererInteractionMode;
  warpSession: { layerId: LayerId; nodes: TransformPoint[] } | null;
  zoomPercent: number;
  onZoomChange: (value: number) => void;
  onPointerPosition: (point: Point | null) => void;
  onActiveLayerChange: (layerId: LayerId) => void;
  onTransformGesture: (gesture: TransformGesture) => void;
  onWarpNodesChange: (nodes: TransformPoint[]) => void;
  onStatus: (message: string) => void;
  onExportReady: (handler: (() => void) | null) => void;
};

type PanState = {
  pointerId: number;
  last: Point;
};

type WarpDragState = {
  pointerId: number;
  nodeIndex: number;
};

type LocalPointEvent = {
  currentTarget: HTMLDivElement;
  clientX: number;
  clientY: number;
};

function getLocalPoint(event: LocalPointEvent): Point {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
  };
}

function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

export function DocumentViewport({
  model,
  sources,
  activeTool,
  interactionMode,
  warpSession,
  zoomPercent,
  onZoomChange,
  onPointerPosition,
  onActiveLayerChange,
  onTransformGesture,
  onWarpNodesChange,
  onStatus,
  onExportReady,
}: DocumentViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const adapterRef = useRef<FabricRendererAdapter | null>(null);
  const modelRef = useRef(model);
  const sourcesRef = useRef(sources);
  const activeLayerHandlerRef = useRef(onActiveLayerChange);
  const transformGestureHandlerRef = useRef(onTransformGesture);
  const statusHandlerRef = useRef(onStatus);
  const transformRef = useRef<ViewportTransform>([1, 0, 0, 1, 0, 0]);
  const documentIdRef = useRef<string | null>(null);
  const panRef = useRef<PanState | null>(null);
  const warpDragRef = useRef<WarpDragState | null>(null);
  const spacePressedRef = useRef(false);
  const skipZoomEffectRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const [viewportRevision, setViewportRevision] = useState(0);

  modelRef.current = model;
  sourcesRef.current = sources;
  activeLayerHandlerRef.current = onActiveLayerChange;
  transformGestureHandlerRef.current = onTransformGesture;
  statusHandlerRef.current = onStatus;

  const applyTransform = useCallback((transform: ViewportTransform) => {
    transformRef.current = transform;
    adapterRef.current?.setViewportTransform(transform);
    setViewportRevision((revision) => revision + 1);
  }, []);

  const fitToViewport = useCallback(
    (announce = true) => {
      const viewport = viewportRef.current;
      const currentModel = modelRef.current;
      if (!viewport) {
        return;
      }

      const next = fitDocumentInViewport(currentModel, {
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      });
      applyTransform(next);
      skipZoomEffectRef.current = true;
      onZoomChange(Math.round(next[0] * 100));
      if (announce) {
        statusHandlerRef.current(`VIEW / FIT ${Math.round(next[0] * 100)}%`);
      }
    },
    [applyTransform, onZoomChange],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) {
      return;
    }

    const adapter = new FabricRendererAdapter(canvas);
    adapterRef.current = adapter;
    adapter.setActiveLayerHandler((layerId) => activeLayerHandlerRef.current(layerId));
    adapter.setTransformGestureHandler((gesture) => transformGestureHandlerRef.current(gesture));

    const resize = () => {
      adapter.setViewportSize(viewport.clientWidth, viewport.clientHeight);
      if (documentIdRef.current === null) {
        fitToViewport(false);
      } else {
        adapter.setViewportTransform(transformRef.current);
      }
    };

    resize();
    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    resizeObserver?.observe(viewport);
    if (!resizeObserver) {
      window.addEventListener("resize", resize);
    }

    const exportHandler = () => {
      const currentModel = modelRef.current;
      const dataUrl = adapter.exportPng(currentModel, sourcesRef.current);
      downloadDataUrl(dataUrl, `${currentModel.name || "Untitled"}-edited.png`);
      statusHandlerRef.current("EXPORT / PNG READY");
    };
    onExportReady(exportHandler);

    return () => {
      resizeObserver?.disconnect();
      if (!resizeObserver) {
        window.removeEventListener("resize", resize);
      }
      onExportReady(null);
      adapterRef.current = null;
      void adapter.dispose();
    };
  }, [fitToViewport, onExportReady]);

  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter) {
      return;
    }
    const changedDocument = documentIdRef.current !== model.id;
    documentIdRef.current = model.id;
    adapter.setDocument(model, sources);
    if (changedDocument) {
      transformRef.current = [1, 0, 0, 1, 0, 0];
      fitToViewport(false);
    } else {
      adapter.setViewportTransform(transformRef.current);
    }
  }, [fitToViewport, model, sources]);

  useEffect(() => {
    adapterRef.current?.setInteractionMode(interactionMode);
    if (interactionMode !== "none") {
      adapterRef.current?.setActiveLayer(model.activeLayerId);
    }
  }, [interactionMode, model.activeLayerId]);

  useEffect(() => {
    if (skipZoomEffectRef.current) {
      skipZoomEffectRef.current = false;
      return;
    }

    const viewport = viewportRef.current;
    if (!viewport || !adapterRef.current) {
      return;
    }

    const anchor = {
      x: viewport.clientWidth / 2,
      y: viewport.clientHeight / 2,
    };
    applyTransform(zoomAroundPoint(transformRef.current, zoomPercent / 100, anchor));
  }, [applyTransform, zoomPercent]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (event.code !== "Space" || target?.matches("input, textarea, select, button")) {
        return;
      }

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
      if (!viewport) {
        return;
      }

      const anchor = {
        x: viewport.clientWidth / 2,
        y: viewport.clientHeight / 2,
      };
      const clampedZoom = clampZoom(nextZoom);
      applyTransform(zoomAroundPoint(transformRef.current, clampedZoom, anchor));
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
      ) {
        return;
      }

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

  const updatePointerPosition = (point: Point) => {
    const documentPoint = viewportToDocument(point, transformRef.current);
    if (
      documentPoint.x < 0 ||
      documentPoint.y < 0 ||
      documentPoint.x > model.width ||
      documentPoint.y > model.height
    ) {
      onPointerPosition(null);
      return;
    }

    onPointerPosition({
      x: Math.floor(documentPoint.x),
      y: Math.floor(documentPoint.y),
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool !== "hand" && !spacePressedRef.current) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = { pointerId: event.pointerId, last: getLocalPoint(event) };
    setIsPanning(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = getLocalPoint(event);
    const pan = panRef.current;
    if (pan?.pointerId === event.pointerId) {
      const delta = { x: point.x - pan.last.x, y: point.y - pan.last.y };
      pan.last = point;
      applyTransform(panViewport(transformRef.current, delta));
    }
    updatePointerPosition(point);
  };

  const endPan = (event: React.PointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId !== event.pointerId) {
      return;
    }

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

  const handlePointerLeave = () => {
    if (!panRef.current) {
      onPointerPosition(null);
    }
  };

  const isHandMode = activeTool === "hand" || spacePressed;
  void viewportRevision;
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
    const next = warpSession.nodes.map((node, index) =>
      index === nodeIndex
        ? {
            x: Math.max(-warpLayer.width, Math.min(warpLayer.width * 2, localPoint.x)),
            y: Math.max(-warpLayer.height, Math.min(warpLayer.height * 2, localPoint.y)),
          }
        : node,
    );
    onWarpNodesChange(next);
  };

  const nudgeWarpNode = (nodeIndex: number, deltaX: number, deltaY: number) => {
    if (!warpSession) return;
    onWarpNodesChange(
      warpSession.nodes.map((node, index) =>
        index === nodeIndex ? { x: node.x + deltaX, y: node.y + deltaY } : node,
      ),
    );
  };

  const getWarpLine = (indices: [number, number, number]) =>
    indices
      .map((index) => {
        const point = warpOverlayPoints[index];
        return point ? `${point.x},${point.y}` : "";
      })
      .join(" ");

  return (
    <div
      ref={viewportRef}
      className={`document-viewport${isHandMode ? " is-hand" : ""}${isPanning ? " is-panning" : ""}`}
      data-testid="document-viewport"
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onPointerLeave={handlePointerLeave}
      onWheel={handleWheel}
      aria-label={`${model.name} document viewport`}
    >
      <canvas ref={canvasRef} aria-label={`${model.name} document`} />
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
  if (!point) {
    return "X — / Y —";
  }
  return `X ${String(Math.max(0, point.x)).padStart(4, "0")} / Y ${String(Math.max(0, point.y)).padStart(4, "0")}`;
}
