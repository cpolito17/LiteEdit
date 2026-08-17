import { useCallback, useEffect, useRef, useState } from "react";

import type { DocumentModel } from "../editor/document-model";
import type { DocumentSource } from "../editor/renderer/fabric-adapter";
import { FabricRendererAdapter } from "../editor/renderer/fabric-adapter";
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
  source: DocumentSource;
  activeTool: ToolId;
  zoomPercent: number;
  onZoomChange: (value: number) => void;
  onPointerPosition: (point: Point | null) => void;
  onStatus: (message: string) => void;
  onExportReady: (handler: (() => void) | null) => void;
};

type PanState = {
  pointerId: number;
  last: Point;
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
  source,
  activeTool,
  zoomPercent,
  onZoomChange,
  onPointerPosition,
  onStatus,
  onExportReady,
}: DocumentViewportProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const adapterRef = useRef<FabricRendererAdapter | null>(null);
  const transformRef = useRef<ViewportTransform>([1, 0, 0, 1, 0, 0]);
  const panRef = useRef<PanState | null>(null);
  const spacePressedRef = useRef(false);
  const skipZoomEffectRef = useRef(false);
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);

  const applyTransform = useCallback((transform: ViewportTransform) => {
    transformRef.current = transform;
    adapterRef.current?.setViewportTransform(transform);
  }, []);

  const fitToViewport = useCallback(
    (announce = true) => {
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }

      const next = fitDocumentInViewport(model, {
        width: viewport.clientWidth,
        height: viewport.clientHeight,
      });
      applyTransform(next);
      skipZoomEffectRef.current = true;
      onZoomChange(Math.round(next[0] * 100));
      if (announce) {
        onStatus(`VIEW / FIT ${Math.round(next[0] * 100)}%`);
      }
    },
    [applyTransform, model, onStatus, onZoomChange],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const viewport = viewportRef.current;
    if (!canvas || !viewport) {
      return;
    }

    const adapter = new FabricRendererAdapter(canvas);
    adapterRef.current = adapter;
    adapter.setDocumentSource(source, model);

    const resize = () => {
      adapter.setViewportSize(viewport.clientWidth, viewport.clientHeight);
      if (transformRef.current[4] === 0 && transformRef.current[5] === 0) {
        const next = fitDocumentInViewport(model, {
          width: viewport.clientWidth,
          height: viewport.clientHeight,
        });
        applyTransform(next);
        skipZoomEffectRef.current = true;
        onZoomChange(Math.round(next[0] * 100));
      } else {
        adapter.setViewportTransform(transformRef.current);
      }
    };

    transformRef.current = [1, 0, 0, 1, 0, 0];
    resize();

    const resizeObserver =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    resizeObserver?.observe(viewport);
    if (!resizeObserver) {
      window.addEventListener("resize", resize);
    }

    const exportHandler = () => {
      const dataUrl = adapter.exportPng();
      downloadDataUrl(dataUrl, `${model.name || "Untitled"}-edited.png`);
      onStatus("EXPORT / PNG READY");
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
  }, [applyTransform, model, onExportReady, onStatus, onZoomChange, source]);

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
  const zoomLabel = `${zoomPercent}%`;

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
          {zoomLabel}
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
