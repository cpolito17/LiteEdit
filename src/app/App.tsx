import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ComponentGallery } from "./ComponentGallery";
import {
  DocumentViewport,
  getDocumentPointerLabel,
  type RasterEdit,
  type ViewportController,
} from "./DocumentViewport";
import { Phase1SpikeGallery } from "./Phase1SpikeGallery";
import { getShortcutAction } from "./shortcuts";
import { panels, tools, type PanelId, type ToolId } from "./tool-model";
import { HistoryPanel } from "../components/panels/HistoryPanel";
import { LayersPanel } from "../components/panels/LayersPanel";
import { TransformPanel } from "../components/panels/TransformPanel";
import { SwatchesPanel } from "../components/panels/SwatchesPanel";
import { ToolOptionsPanel } from "../components/panels/ToolOptionsPanel";
import { Dialog, NumericField, Tabs, Toast, Tooltip, UiButton } from "../components/primitives/Ui";
import {
  createBlankDocument,
  cloneDocumentModel,
  deleteLayerSubtree,
  duplicateLayerSubtree,
  getLayerById,
  insertGroupLayer,
  insertRasterLayer,
  insertVectorLayer,
  moveLayer,
  moveLayerWithinParent,
  outdentLayer,
  renameLayer,
  rasterizeRootVectorLayer,
  setActiveLayer,
  setLayerLocked,
  setLayerOpacity,
  setLayerTransform,
  setLayerVisibility,
  setVectorObject,
  ungroupLayer,
  wrapLayerInGroup,
  type DocumentBackground,
  type DocumentModel,
  type LayerId,
} from "../editor/document-model";
import { cropDocument, resizeDocument, type ResamplingMode } from "../editor/document-operations";
import {
  downloadBlob,
  encodeExport,
  normalizeExportFilename,
  type ExportFormat,
} from "../editor/export/export-service";
import { loadSavedSwatches, normalizeHexColor, saveSwatches } from "../editor/color/color";
import { DEFAULT_BRUSH_SETTINGS, type BrushSettings } from "../editor/raster/brush-engine";
import {
  StructuralHistory,
  type CommitHistoryOptions,
  type HistoryRestore,
} from "../editor/history/structural-history";
import {
  createBlankSource,
  createDocumentFromDecodedImage,
  decodeLocalImage,
  ImageImportError,
} from "../editor/import-validation";
import {
  cloneRasterSource,
  createRasterSourceMap,
  createTransparentRasterSource,
  type RasterSource,
} from "../editor/raster/raster-sources";
import {
  applyRasterSnapshot,
  captureRasterRegion,
  captureRasterSnapshot,
  restoreRasterSnapshot,
  type RasterSnapshot,
} from "../editor/raster/raster-snapshot";
import { createDefaultWarpNodes, warpRasterSource } from "../editor/raster/warp";
import {
  clearRecovery,
  loadRecovery,
  restoreRecovery,
  saveRecovery,
  type RecoveryRecord,
} from "../editor/recovery/recovery-service";
import {
  renderDocumentCanvas,
  type RendererInteractionMode,
  type TransformGesture,
} from "../editor/renderer/fabric-adapter";
import {
  composeLayerTransform,
  getLayerWorldTransform,
  transformPoint,
  translateMatrix,
  type TransformFields,
  type TransformPoint,
} from "../editor/transform";
import type { Point } from "../editor/viewport";
import {
  combineSelectionMasks,
  getSelectionBounds,
  invertSelection,
  type SelectionBounds,
  type SelectionCombineMode,
  type SelectionMask,
} from "../editor/selection/selection-mask";
import { SelectionService } from "../editor/selection/selection-service";
import type { ShapeKind, ShapeStyle } from "../editor/vector/shape-geometry";

const panelOptions = panels.map((panel) => ({ id: panel, label: panel }));

const panelCopy: Record<PanelId, string> = {
  LAYERS: "Create or open a document to manage its layer tree.",
  HISTORY: "Structural edits appear here as reversible transactions.",
  PROPERTIES: "Transform and viewport controls appear after a document is opened.",
  SWATCHES: "Foreground, background, recent, and saved colors stay on this device.",
};

type ToastTone = "info" | "success" | "warning";

type TransformSession = {
  layerId: LayerId;
  before: DocumentModel;
};

type WarpSession = {
  layerId: LayerId;
  before: RasterSnapshot;
  nodes: TransformPoint[];
};

const DEFAULT_SHAPE_STYLE: ShapeStyle = {
  fill: "#70FFD2",
  stroke: "#101719",
  strokeWidth: 2,
  sides: 5,
};

function getTransformTargetId(model: DocumentModel, layerId: LayerId): LayerId {
  let layer = getLayerById(model, layerId);
  while (layer.parentId !== null) {
    layer = getLayerById(model, layer.parentId);
  }
  return layer.id;
}

function matricesEqual(left: readonly number[], right: readonly number[]): boolean {
  return left.every((value, index) => Math.abs(value - (right[index] ?? Number.NaN)) < 1e-10);
}

function App() {
  const [activeTool, setActiveTool] = useState<ToolId>("move");
  const [activePanel, setActivePanel] = useState<PanelId>("LAYERS");
  const [zoom, setZoom] = useState(100);
  const [transformSession, setTransformSession] = useState<TransformSession | null>(null);
  const [warpSession, setWarpSession] = useState<WarpSession | null>(null);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [resizeDialogOpen, setResizeDialogOpen] = useState(false);
  const [recoveryRecord, setRecoveryRecord] = useState<RecoveryRecord | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<ToastTone>("info");
  const [documentModel, setDocumentModel] = useState<DocumentModel | null>(null);
  const [documentSources, setDocumentSources] = useState<Record<string, RasterSource> | null>(null);
  const [pointerPosition, setPointerPosition] = useState<Point | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [newDocumentWidth, setNewDocumentWidth] = useState(1920);
  const [newDocumentHeight, setNewDocumentHeight] = useState(1080);
  const [newDocumentBackground, setNewDocumentBackground] =
    useState<DocumentBackground>("transparent");
  const [exportReady, setExportReady] = useState(false);
  const [foregroundColor, setForegroundColor] = useState("#101719");
  const [backgroundColor, setBackgroundColor] = useState("#FFFFFF");
  const [recentColors, setRecentColors] = useState<string[]>(["#101719", "#FFFFFF"]);
  const [savedSwatches, setSavedSwatches] = useState<string[]>(() => loadSavedSwatches());
  const [brushSettings, setBrushSettings] = useState<BrushSettings>(DEFAULT_BRUSH_SETTINGS);
  const [selection, setSelection] = useState<SelectionMask | null>(null);
  const [selectionMode, setSelectionMode] = useState<SelectionCombineMode>("replace");
  const [autoSelectionKind, setAutoSelectionKind] = useState<"quick" | "object">("quick");
  const [selectionTolerance, setSelectionTolerance] = useState(48);
  const [selectionBrushSize, setSelectionBrushSize] = useState(24);
  const [selectionBusy, setSelectionBusy] = useState(false);
  const [cropRectangle, setCropRectangle] = useState<SelectionBounds | null>(null);
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rectangle");
  const [shapeStyle, setShapeStyle] = useState<ShapeStyle>(DEFAULT_SHAPE_STYLE);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [exportQuality, setExportQuality] = useState(0.9);
  const [exportTargetKilobytes, setExportTargetKilobytes] = useState(0);
  const [exportMatte, setExportMatte] = useState("#FFFFFF");
  const [exportSelectionOnly, setExportSelectionOnly] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [resizeWidth, setResizeWidth] = useState(1920);
  const [resizeHeight, setResizeHeight] = useState(1080);
  const [resizeLinked, setResizeLinked] = useState(true);
  const [resampling, setResampling] = useState<ResamplingMode>("high");
  const [historyVersion, setHistoryVersion] = useState(0);
  const [heapMegabytes, setHeapMegabytes] = useState<number | null>(null);
  const historyRef = useRef(new StructuralHistory());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewportControllerRef = useRef<ViewportController | null>(null);
  const selectionServiceRef = useRef(new SelectionService());
  const exportGenerationRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);
  const historySnapshot = useMemo(() => historyRef.current.snapshot(), [historyVersion]);

  const announce = useCallback((message: string, tone: ToastTone = "info") => {
    setToastMessage(message);
    setToastTone(tone);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToastMessage(null), 2400);
  }, []);

  useEffect(
    () => () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    let active = true;
    void loadRecovery()
      .then((record) => {
        if (active && record) setRecoveryRecord(record);
      })
      .catch((error) => {
        if (!active) return;
        setRecoveryError(error instanceof Error ? error.message : "Local recovery could not load.");
      });
    return () => {
      active = false;
      selectionServiceRef.current.cancel();
    };
  }, []);

  useEffect(() => {
    if (!documentModel || !documentSources) return;
    const timer = window.setTimeout(() => {
      void saveRecovery(documentModel, documentSources).catch((error) => {
        setRecoveryError(
          error instanceof Error ? error.message : "Local recovery could not be written.",
        );
      });
    }, 750);
    return () => window.clearTimeout(timer);
  }, [documentModel, documentSources, historyVersion]);

  useEffect(() => {
    const updateHeap = () => {
      const memory = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory;
      setHeapMegabytes(
        typeof memory?.usedJSHeapSize === "number"
          ? Math.round(memory.usedJSHeapSize / (1024 * 1024))
          : null,
      );
    };
    updateHeap();
    const timer = window.setInterval(updateHeap, 2_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    selectionServiceRef.current.cancel();
    setSelectionBusy(false);
  }, [documentModel, documentSources]);

  const updateForegroundColor = useCallback((color: string) => {
    const normalized = normalizeHexColor(color);
    setForegroundColor(normalized);
    setBrushSettings((current) => ({ ...current, color: normalized }));
    setRecentColors((current) =>
      [normalized, ...current.filter((value) => value !== normalized)].slice(0, 12),
    );
  }, []);

  const refreshHistory = useCallback(() => {
    setHistoryVersion((version) => version + 1);
  }, []);

  const recordDocumentCommit = useCallback(
    (
      label: string,
      before: DocumentModel,
      next: DocumentModel,
      options: CommitHistoryOptions = {},
      tone: ToastTone = "success",
    ) => {
      const committed = historyRef.current.commit(label, before, next, options);
      if (!committed) {
        return false;
      }
      setDocumentModel(next);
      refreshHistory();
      announce(label.toUpperCase(), tone);
      return true;
    },
    [announce, refreshHistory],
  );

  const commitDocument = useCallback(
    (
      label: string,
      next: DocumentModel,
      options: CommitHistoryOptions = {},
      tone: ToastTone = "success",
    ) => (documentModel ? recordDocumentCommit(label, documentModel, next, options, tone) : false),
    [documentModel, recordDocumentCommit],
  );

  const applyHistoryRestore = useCallback((restored: HistoryRestore) => {
    setDocumentModel(restored.document);
    if (restored.rasterChanges.length > 0) {
      setDocumentSources((current) => {
        if (!current) return current;
        const next = { ...current };
        for (const change of restored.rasterChanges) {
          const source = next[change.bufferId];
          if (source) next[change.bufferId] = applyRasterSnapshot(source, change.snapshot);
        }
        return next;
      });
    }
  }, []);

  const cancelExport = useCallback(() => {
    exportGenerationRef.current += 1;
    setExportBusy(false);
    setExportDialogOpen(false);
    announce("EXPORT / CANCELLED");
  }, [announce]);

  const cancelActiveEdit = useCallback(() => {
    if (transformSession) {
      setDocumentModel(transformSession.before);
      setTransformSession(null);
      announce("TRANSFORM / CANCELLED");
      return true;
    }
    if (warpSession) {
      setWarpSession(null);
      announce("WARP / CANCELLED");
      return true;
    }
    if (cropRectangle) {
      setCropRectangle(null);
      announce("CROP / CANCELLED");
      return true;
    }
    if (selectionBusy) {
      selectionServiceRef.current.cancel();
      setSelectionBusy(false);
      announce("SELECTION / CANCELLED");
      return true;
    }
    if (exportDialogOpen) {
      cancelExport();
      return true;
    }
    if (resizeDialogOpen) {
      setResizeDialogOpen(false);
      return true;
    }
    if (newDialogOpen) {
      setNewDialogOpen(false);
      announce("ACTION / CANCELLED");
      return true;
    }
    return false;
  }, [
    announce,
    cancelExport,
    cropRectangle,
    exportDialogOpen,
    newDialogOpen,
    resizeDialogOpen,
    selectionBusy,
    transformSession,
    warpSession,
  ]);

  const handleUndo = useCallback(() => {
    if (transformSession || warpSession) {
      cancelActiveEdit();
      return;
    }
    const label = historyRef.current.snapshot().applied.at(-1)?.label;
    const restored = historyRef.current.undo();
    if (!restored) {
      announce(documentModel ? "UNDO / AT DOCUMENT START" : "UNDO / NO DOCUMENT LOADED");
      return;
    }
    applyHistoryRestore(restored);
    refreshHistory();
    announce(`UNDO / ${label ?? "EDIT"}`);
  }, [
    announce,
    applyHistoryRestore,
    cancelActiveEdit,
    documentModel,
    refreshHistory,
    transformSession,
    warpSession,
  ]);

  const handleRedo = useCallback(() => {
    if (transformSession || warpSession) {
      cancelActiveEdit();
      return;
    }
    const label = historyRef.current.snapshot().redo[0]?.label;
    const restored = historyRef.current.redo();
    if (!restored) {
      announce(documentModel ? "REDO / NO PENDING EDIT" : "REDO / NO DOCUMENT LOADED");
      return;
    }
    applyHistoryRestore(restored);
    refreshHistory();
    announce(`REDO / ${label ?? "EDIT"}`);
  }, [
    announce,
    applyHistoryRestore,
    cancelActiveEdit,
    documentModel,
    refreshHistory,
    transformSession,
    warpSession,
  ]);

  const beginTransform = useCallback(() => {
    if (!documentModel) {
      announce("TRANSFORM / WAITING FOR DOCUMENT");
      return;
    }
    if (transformSession) {
      announce("TRANSFORM / ALREADY ACTIVE");
      return;
    }
    let workingDocument = documentModel;
    let layerId = getTransformTargetId(documentModel, documentModel.activeLayerId);
    let layer = getLayerById(documentModel, layerId);
    if (selection && documentSources) {
      const selectedLayer = getLayerById(documentModel, documentModel.activeLayerId);
      if (selectedLayer.kind === "raster" && !selectedLayer.locked && selectedLayer.visible) {
        const source = documentSources[selectedLayer.bufferId];
        if (source) {
          const original = cloneRasterSource(source, selectedLayer.width, selectedLayer.height);
          const beforeSource = cloneRasterSource(source, selectedLayer.width, selectedLayer.height);
          const lifted = createTransparentRasterSource(documentModel.width, documentModel.height);
          const originalContext = original.getContext("2d", { willReadFrequently: true });
          const liftedContext = lifted.getContext("2d");
          if (originalContext && liftedContext) {
            const originalImage = originalContext.getImageData(
              0,
              0,
              original.width,
              original.height,
            );
            const liftedImage = liftedContext.createImageData(lifted.width, lifted.height);
            const world = getLayerWorldTransform(documentModel, selectedLayer.id);
            let left = original.width;
            let top = original.height;
            let right = -1;
            let bottom = -1;
            for (let y = 0; y < original.height; y += 1) {
              for (let x = 0; x < original.width; x += 1) {
                const point = transformPoint({ x: x + 0.5, y: y + 0.5 }, world);
                const documentX = Math.floor(point.x);
                const documentY = Math.floor(point.y);
                if (
                  documentX < 0 ||
                  documentY < 0 ||
                  documentX >= selection.width ||
                  documentY >= selection.height ||
                  (selection.data[documentY * selection.width + documentX] ?? 0) === 0
                )
                  continue;
                const sourceOffset = (y * original.width + x) * 4;
                const destinationOffset = (documentY * lifted.width + documentX) * 4;
                liftedImage.data.set(
                  originalImage.data.subarray(sourceOffset, sourceOffset + 4),
                  destinationOffset,
                );
                originalImage.data.fill(0, sourceOffset, sourceOffset + 4);
                left = Math.min(left, x);
                top = Math.min(top, y);
                right = Math.max(right, x);
                bottom = Math.max(bottom, y);
              }
            }
            if (right >= left) {
              originalContext.putImageData(originalImage, 0, 0);
              liftedContext.putImageData(liftedImage, 0, 0);
              const result = insertRasterLayer(documentModel, {
                name: "Floating Selection",
                parentId: null,
                index: documentModel.rootLayerIds.length,
              });
              const region = {
                x: left,
                y: top,
                width: right - left + 1,
                height: bottom - top + 1,
              };
              historyRef.current.commit("Lift selection", documentModel, result.document, {
                rasterChanges: [
                  {
                    bufferId: selectedLayer.bufferId,
                    before: captureRasterRegion(beforeSource, region),
                    after: captureRasterRegion(original, region),
                  },
                ],
              });
              setDocumentSources({
                ...documentSources,
                [selectedLayer.bufferId]: original,
                [result.layer.bufferId]: lifted,
              });
              workingDocument = result.document;
              layerId = result.layer.id;
              layer = result.layer;
              setSelection(null);
              refreshHistory();
              announce("SELECTION / LIFTED TO RASTER LAYER", "success");
            }
          }
        }
      }
    }
    if (layer.locked) {
      announce("TRANSFORM / LAYER IS LOCKED", "warning");
      return;
    }
    setWarpSession(null);
    setTransformSession({ layerId, before: workingDocument });
    setDocumentModel(setActiveLayer(workingDocument, layerId));
    setActivePanel("PROPERTIES");
    setActiveTool("move");
    announce(`TRANSFORM / ${layer.name.toUpperCase()}`);
  }, [announce, documentModel, documentSources, refreshHistory, selection, transformSession]);

  const beginWarp = useCallback(() => {
    if (!documentModel || !documentSources) return;
    const layer = getLayerById(documentModel, documentModel.activeLayerId);
    if (layer.kind !== "raster") {
      announce("WARP / SELECT ONE RASTER LAYER", "warning");
      return;
    }
    if (layer.locked) {
      announce("WARP / LAYER IS LOCKED", "warning");
      return;
    }
    const source = documentSources[layer.bufferId];
    if (!source) {
      announce("WARP / RASTER SOURCE IS MISSING", "warning");
      return;
    }
    setTransformSession(null);
    setWarpSession({
      layerId: layer.id,
      before: captureRasterSnapshot(source, layer.width, layer.height),
      nodes: createDefaultWarpNodes(layer.width, layer.height),
    });
    setActivePanel("PROPERTIES");
    announce(`WARP / ${layer.name.toUpperCase()}`);
  }, [announce, documentModel, documentSources]);

  const commitActiveEdit = useCallback(() => {
    if (!documentModel) return false;
    if (transformSession) {
      const layer = getLayerById(documentModel, transformSession.layerId);
      const beforeLayer = getLayerById(transformSession.before, transformSession.layerId);
      setTransformSession(null);
      if (matricesEqual(layer.transform, beforeLayer.transform)) {
        setDocumentModel(transformSession.before);
        announce("TRANSFORM / NO CHANGE");
        return true;
      }
      if (
        !recordDocumentCommit(`Transform: ${layer.name}`, transformSession.before, documentModel)
      ) {
        announce("TRANSFORM / NO CHANGE");
      }
      return true;
    }
    if (warpSession && documentSources) {
      try {
        const layer = getLayerById(documentModel, warpSession.layerId);
        if (layer.kind !== "raster") {
          throw new Error("Warp requires one raster layer.");
        }
        const output = warpRasterSource(
          restoreRasterSnapshot(warpSession.before),
          layer.width,
          layer.height,
          { scope: { kind: "layer" }, destinationNodes: warpSession.nodes },
        );
        const after = captureRasterSnapshot(output, layer.width, layer.height);
        const committed = recordDocumentCommit(
          `Warp: ${layer.name}`,
          documentModel,
          documentModel,
          {
            rasterChanges: [{ bufferId: layer.bufferId, before: warpSession.before, after }],
          },
        );
        setWarpSession(null);
        if (committed) {
          setDocumentSources((current) =>
            current ? { ...current, [layer.bufferId]: output } : current,
          );
        } else {
          announce("WARP / NO CHANGE");
        }
        return true;
      } catch (error) {
        announce(
          error instanceof Error ? error.message : "The warp could not be committed.",
          "warning",
        );
        return false;
      }
    }
    return false;
  }, [
    announce,
    documentModel,
    documentSources,
    recordDocumentCommit,
    transformSession,
    warpSession,
  ]);

  const handleTransformChange = useCallback(
    (fields: TransformFields) => {
      if (!documentModel || !transformSession) return;
      try {
        const matrix = composeLayerTransform(documentModel, transformSession.layerId, fields);
        setDocumentModel(setLayerTransform(documentModel, transformSession.layerId, matrix));
      } catch (error) {
        announce(error instanceof Error ? error.message : "The transform is invalid.", "warning");
      }
    },
    [announce, documentModel, transformSession],
  );

  const handleTransformGesture = useCallback(
    (gesture: TransformGesture) => {
      if (!documentModel) return;
      const layer = getLayerById(documentModel, gesture.layerId);
      if (layer.locked) return;
      const next = setLayerTransform(
        setActiveLayer(documentModel, gesture.layerId),
        gesture.layerId,
        gesture.matrix,
      );
      if (transformSession) {
        setDocumentModel(next);
        announce(`${gesture.action.toUpperCase()} / PREVIEW`);
        return;
      }
      const prefix =
        gesture.action === "move"
          ? "Move"
          : gesture.action === "scale"
            ? "Scale"
            : gesture.action === "rotate"
              ? "Rotate"
              : "Transform";
      commitDocument(`${prefix}: ${layer.name}`, next);
    },
    [announce, commitDocument, documentModel, transformSession],
  );

  const handleNudge = useCallback(
    (deltaX: number, deltaY: number) => {
      if (!documentModel || warpSession) return;
      const layerId = transformSession?.layerId ?? documentModel.activeLayerId;
      const layer = getLayerById(documentModel, layerId);
      if (layer.locked) {
        announce("MOVE / LAYER IS LOCKED", "warning");
        return;
      }
      const next = setLayerTransform(
        documentModel,
        layerId,
        translateMatrix(layer.transform, deltaX, deltaY),
      );
      if (transformSession) {
        setDocumentModel(next);
      } else {
        commitDocument(`Nudge: ${layer.name}`, next, { coalesceKey: `nudge:${layerId}` });
      }
    },
    [announce, commitDocument, documentModel, transformSession, warpSession],
  );

  const handleClearSelectedPixels = useCallback(() => {
    if (!documentModel || !documentSources || !selection) {
      announce("CLEAR / NO ACTIVE SELECTION");
      return;
    }
    const layer = getLayerById(documentModel, documentModel.activeLayerId);
    if (layer.kind !== "raster" || layer.locked || !layer.visible) {
      announce("CLEAR / SELECT A VISIBLE UNLOCKED RASTER LAYER", "warning");
      return;
    }
    const source = documentSources[layer.bufferId];
    if (!source) return;
    const canvas = cloneRasterSource(source, layer.width, layer.height);
    const beforeSource = cloneRasterSource(source, layer.width, layer.height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const world = getLayerWorldTransform(documentModel, layer.id);
    let left = canvas.width;
    let top = canvas.height;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < canvas.height; y += 1) {
      for (let x = 0; x < canvas.width; x += 1) {
        const point = transformPoint({ x: x + 0.5, y: y + 0.5 }, world);
        const documentX = Math.floor(point.x);
        const documentY = Math.floor(point.y);
        if (
          documentX < 0 ||
          documentY < 0 ||
          documentX >= selection.width ||
          documentY >= selection.height ||
          (selection.data[documentY * selection.width + documentX] ?? 0) === 0
        )
          continue;
        const offset = (y * canvas.width + x) * 4;
        image.data[offset] = 0;
        image.data[offset + 1] = 0;
        image.data[offset + 2] = 0;
        image.data[offset + 3] = 0;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
    if (right < left) {
      announce("CLEAR / SELECTION DOES NOT CROSS ACTIVE LAYER");
      return;
    }
    context.putImageData(image, 0, 0);
    const region = { x: left, y: top, width: right - left + 1, height: bottom - top + 1 };
    const before = captureRasterRegion(beforeSource, region);
    const after = captureRasterRegion(canvas, region);
    recordDocumentCommit("Clear selection", documentModel, documentModel, {
      rasterChanges: [{ bufferId: layer.bufferId, before, after }],
    });
    setDocumentSources({ ...documentSources, [layer.bufferId]: canvas });
  }, [announce, documentModel, documentSources, recordDocumentCommit, selection]);

  const activateTool = useCallback(
    (tool: ToolId) => {
      cancelActiveEdit();
      if (
        documentModel &&
        documentSources &&
        (tool === "brush" || tool === "eraser") &&
        getLayerById(documentModel, documentModel.activeLayerId).kind !== "raster"
      ) {
        const result = insertRasterLayer(documentModel, { name: "Paint Layer" });
        const source = createTransparentRasterSource(documentModel.width, documentModel.height);
        setDocumentSources({ ...documentSources, [result.layer.bufferId]: source });
        commitDocument("Add: Paint Layer", result.document);
        announce("PAINT / NEW RASTER LAYER CREATED");
      }
      setActiveTool(tool);
      if (tool === "crop" && selection) {
        setCropRectangle(getSelectionBounds(selection));
      }
      if (
        tool === "shape" ||
        tool === "brush" ||
        tool === "eraser" ||
        tool === "crop" ||
        tool === "select" ||
        tool === "marquee" ||
        tool === "lasso"
      ) {
        setActivePanel("PROPERTIES");
      }
      announce(`ACTIVE TOOL / ${tool.toUpperCase()}`);
    },
    [announce, cancelActiveEdit, commitDocument, documentModel, documentSources, selection],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const action = getShortcutAction(event);
      if (!action) {
        return;
      }

      if (newDialogOpen && action.type !== "cancel") {
        return;
      }

      if (
        (action.type === "commit" || action.type === "cancel") &&
        !transformSession &&
        !warpSession &&
        !newDialogOpen
      ) {
        return;
      }
      event.preventDefault();
      switch (action.type) {
        case "tool":
          activateTool(action.tool);
          break;
        case "undo":
          handleUndo();
          break;
        case "redo":
          handleRedo();
          break;
        case "clear-selection":
          setSelection(null);
          announce("SELECTION / CLEARED");
          break;
        case "transform":
          beginTransform();
          break;
        case "commit":
          commitActiveEdit();
          break;
        case "nudge":
          handleNudge(action.x, action.y);
          break;
        case "clear-pixels":
          handleClearSelectedPixels();
          break;
        case "cancel":
          cancelActiveEdit();
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    announce,
    activateTool,
    beginTransform,
    cancelActiveEdit,
    commitActiveEdit,
    handleNudge,
    handleClearSelectedPixels,
    handleRedo,
    handleUndo,
    newDialogOpen,
    transformSession,
    warpSession,
  ]);

  const setDocument = useCallback(
    (model: DocumentModel, source: RasterSource, message: string) => {
      historyRef.current.clear();
      setDocumentModel(model);
      setDocumentSources(createRasterSourceMap(model, source));
      setPointerPosition(null);
      setImportError(null);
      setZoom(100);
      setTransformSession(null);
      setWarpSession(null);
      setSelection(null);
      setCropRectangle(null);
      setResizeWidth(model.width);
      setResizeHeight(model.height);
      refreshHistory();
      announce(message, "success");
    },
    [announce, refreshHistory],
  );

  const handleFile = useCallback(
    async (file: File) => {
      try {
        const decoded = await decodeLocalImage(file);
        setDocument(
          createDocumentFromDecodedImage(decoded),
          decoded.source,
          `OPEN / ${decoded.name.toUpperCase()}`,
        );
      } catch (error) {
        const message =
          error instanceof ImageImportError ? error.message : "The image could not be opened.";
        setImportError(message);
        announce(`OPEN / ${message}`, "warning");
      }
    },
    [announce, setDocument],
  );

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) {
      void handleFile(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      void handleFile(file);
    }
  };

  const handleCreateBlank = () => {
    try {
      const source = createBlankSource(newDocumentWidth, newDocumentHeight, newDocumentBackground);
      setDocument(
        createBlankDocument({
          width: newDocumentWidth,
          height: newDocumentHeight,
          background: newDocumentBackground,
        }),
        source,
        "NEW / BLANK DOCUMENT READY",
      );
      setNewDialogOpen(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "The blank document could not be created.";
      setImportError(message);
      announce(`NEW / ${message}`, "warning");
    }
  };

  const handleAddRaster = () => {
    if (!documentModel) {
      return;
    }
    try {
      const result = insertRasterLayer(documentModel);
      const source = createTransparentRasterSource(documentModel.width, documentModel.height);
      setDocumentSources((current) => ({
        ...(current ?? {}),
        [result.layer.bufferId]: source,
      }));
      commitDocument(`Add: ${result.layer.name}`, result.document);
    } catch (error) {
      announce(
        error instanceof Error ? error.message : "The layer could not be created.",
        "warning",
      );
    }
  };

  const handleDuplicate = (layerId: LayerId) => {
    if (!documentModel || !documentSources) {
      return;
    }
    try {
      const result = duplicateLayerSubtree(documentModel, layerId);
      const sourceUpdates: Record<string, RasterSource> = {};
      for (const copy of result.bufferCopies) {
        const source = documentSources[copy.sourceBufferId];
        const sourceLayer = documentModel.layers.find(
          (layer) => layer.kind === "raster" && layer.bufferId === copy.sourceBufferId,
        );
        if (!source || !sourceLayer || sourceLayer.kind !== "raster") {
          throw new Error("The raster source could not be duplicated.");
        }
        sourceUpdates[copy.targetBufferId] = cloneRasterSource(
          source,
          sourceLayer.width,
          sourceLayer.height,
        );
      }
      setDocumentSources((current) => ({ ...(current ?? {}), ...sourceUpdates }));
      commitDocument(`Duplicate: ${getLayerById(documentModel, layerId).name}`, result.document);
    } catch (error) {
      announce(
        error instanceof Error ? error.message : "The layer could not be duplicated.",
        "warning",
      );
    }
  };

  const handleRasterEdit = useCallback(
    (edit: RasterEdit) => {
      if (!documentModel) return;
      const committed = recordDocumentCommit(edit.label, documentModel, documentModel, {
        rasterChanges: edit.changes.map((change) => ({
          bufferId: edit.bufferId,
          before: change.before,
          after: change.after,
        })),
      });
      if (committed) {
        setDocumentSources((current) =>
          current ? { ...current, [edit.bufferId]: edit.source } : current,
        );
      }
    },
    [documentModel, recordDocumentCommit],
  );

  const handleSelectionCommit = useCallback(
    (incoming: SelectionMask, mode: SelectionCombineMode) => {
      const next = combineSelectionMasks(selection, incoming, mode);
      const bounds = getSelectionBounds(next);
      setSelection(bounds ? next : null);
      announce(
        bounds
          ? `SELECTION / ${bounds.width} × ${bounds.height} / ${mode.toUpperCase()}`
          : "SELECTION / EMPTY",
      );
    },
    [announce, selection],
  );

  const handleAutoSelect = useCallback(
    async (request: { seed?: { x: number; y: number }; region?: SelectionBounds }) => {
      const controller = viewportControllerRef.current;
      if (!controller || !documentModel) return;
      if (autoSelectionKind === "object" && !request.region) {
        announce("OBJECT SELECT / DRAG A REGION", "warning");
        return;
      }
      setSelectionBusy(true);
      announce(`${autoSelectionKind.toUpperCase()} SELECT / WORKING`);
      try {
        const mask = await selectionServiceRef.current.run({
          image: controller.renderPixels(),
          mode: autoSelectionKind,
          seed: request.seed,
          region: request.region,
          tolerance: selectionTolerance,
          brushSize: selectionBrushSize,
        });
        if (mask) handleSelectionCommit(mask, selectionMode);
      } catch (error) {
        announce(
          error instanceof Error ? error.message : "The selection could not be created.",
          "warning",
        );
      } finally {
        setSelectionBusy(false);
      }
    },
    [
      announce,
      autoSelectionKind,
      documentModel,
      handleSelectionCommit,
      selectionMode,
      selectionBrushSize,
      selectionTolerance,
    ],
  );

  const handleShapeCreate = useCallback(
    (object: Parameters<typeof insertVectorLayer>[1]["object"]) => {
      if (!documentModel) return;
      try {
        const result = insertVectorLayer(documentModel, {
          name: `${String(object.properties.kind ?? "Shape")} Shape`,
          object,
        });
        commitDocument(`Add: ${result.layer.name}`, result.document);
      } catch (error) {
        announce(
          error instanceof Error ? error.message : "The shape could not be created.",
          "warning",
        );
      }
    },
    [announce, commitDocument, documentModel],
  );

  const handleShapeKindChange = useCallback(
    (kind: ShapeKind) => {
      setShapeKind(kind);
      if (!documentModel) return;
      const layer = getLayerById(documentModel, documentModel.activeLayerId);
      if (layer.kind !== "vector" || layer.locked) return;
      const next = setVectorObject(documentModel, layer.id, {
        ...layer.object,
        properties: { ...layer.object.properties, kind },
      });
      commitDocument(`Edit: ${layer.name}`, next, {
        coalesceKey: `vector-geometry:${layer.id}`,
        coalesceWindowMs: 500,
      });
    },
    [commitDocument, documentModel],
  );

  const handleShapeStyleChange = useCallback(
    (style: ShapeStyle) => {
      setShapeStyle(style);
      if (!documentModel) return;
      const layer = getLayerById(documentModel, documentModel.activeLayerId);
      if (layer.kind !== "vector" || layer.locked) return;
      const next = setVectorObject(documentModel, layer.id, {
        ...layer.object,
        properties: {
          ...layer.object.properties,
          fill: style.fill,
          stroke: style.stroke,
          strokeWidth: style.strokeWidth,
          sides: style.sides,
        },
      });
      commitDocument(`Edit: ${layer.name}`, next, {
        coalesceKey: `vector-style:${layer.id}`,
        coalesceWindowMs: 500,
      });
    },
    [commitDocument, documentModel],
  );

  const handleRasterizeVector = useCallback(
    (layerId: LayerId) => {
      if (!documentModel || !documentSources) return;
      try {
        const isolated = cloneDocumentModel(documentModel);
        isolated.layers = isolated.layers.map((layer) => ({
          ...layer,
          visible: layer.id === layerId,
        }));
        const source = renderDocumentCanvas(isolated, documentSources);
        const result = rasterizeRootVectorLayer(documentModel, layerId);
        setDocumentSources({
          ...documentSources,
          [result.layer.bufferId]: source,
        });
        commitDocument(`Rasterize: ${result.layer.name}`, result.document);
      } catch (error) {
        announce(
          error instanceof Error ? error.message : "The vector layer could not be rasterized.",
          "warning",
        );
      }
    },
    [announce, commitDocument, documentModel, documentSources],
  );

  const handleCommitCrop = useCallback(() => {
    if (!documentModel || !cropRectangle) return;
    try {
      const next = cropDocument(documentModel, cropRectangle);
      commitDocument(`Crop: ${next.width} × ${next.height}`, next);
      setCropRectangle(null);
      setSelection(null);
      setResizeWidth(next.width);
      setResizeHeight(next.height);
    } catch (error) {
      announce(
        error instanceof Error ? error.message : "The crop could not be committed.",
        "warning",
      );
    }
  }, [announce, commitDocument, cropRectangle, documentModel]);

  const handleCommitResize = useCallback(() => {
    if (!documentModel) return;
    try {
      const next = resizeDocument(documentModel, resizeWidth, resizeHeight, resampling);
      commitDocument(`Resize: ${next.width} × ${next.height}`, next);
      setSelection(null);
      setResizeDialogOpen(false);
    } catch (error) {
      announce(
        error instanceof Error ? error.message : "The resize could not be committed.",
        "warning",
      );
    }
  }, [announce, commitDocument, documentModel, resampling, resizeHeight, resizeWidth]);

  const handleExport = useCallback(async () => {
    const controller = viewportControllerRef.current;
    if (!controller || !documentModel) return;
    const generation = ++exportGenerationRef.current;
    setExportBusy(true);
    try {
      let exportCanvas = controller.renderCanvas();
      const selectedBounds = exportSelectionOnly ? getSelectionBounds(selection) : null;
      if (selectedBounds) {
        const croppedCanvas = document.createElement("canvas");
        croppedCanvas.width = selectedBounds.width;
        croppedCanvas.height = selectedBounds.height;
        croppedCanvas
          .getContext("2d")
          ?.drawImage(
            exportCanvas,
            selectedBounds.x,
            selectedBounds.y,
            selectedBounds.width,
            selectedBounds.height,
            0,
            0,
            selectedBounds.width,
            selectedBounds.height,
          );
        exportCanvas = croppedCanvas;
      }
      const result = await encodeExport(exportCanvas, {
        format: exportFormat,
        quality: exportQuality,
        matte: exportMatte,
        targetBytes:
          exportFormat === "jpeg" && exportTargetKilobytes > 0
            ? Math.round(exportTargetKilobytes * 1024)
            : undefined,
      });
      if (generation !== exportGenerationRef.current) return;
      downloadBlob(result.blob, normalizeExportFilename(documentModel.name, exportFormat));
      setExportDialogOpen(false);
      announce(
        `EXPORT / ${exportFormat.toUpperCase()} / ${Math.round(result.blob.size / 1024)} KB${result.targetMet ? "" : " / TARGET NOT MET"}`,
        result.targetMet ? "success" : "warning",
      );
    } catch (error) {
      if (generation !== exportGenerationRef.current) return;
      announce(
        error instanceof Error ? error.message : "The export could not be encoded.",
        "warning",
      );
    } finally {
      if (generation === exportGenerationRef.current) setExportBusy(false);
    }
  }, [
    announce,
    documentModel,
    exportFormat,
    exportMatte,
    exportQuality,
    exportSelectionOnly,
    exportTargetKilobytes,
    selection,
  ]);

  const handleRestoreRecovery = useCallback(async () => {
    if (!recoveryRecord) return;
    try {
      const restored = await restoreRecovery(recoveryRecord);
      historyRef.current.clear();
      setDocumentModel(restored.document);
      setDocumentSources(restored.sources);
      setRecoveryRecord(null);
      setSelection(null);
      setCropRectangle(null);
      refreshHistory();
      announce("RECOVERY / RESTORED", "success");
    } catch (error) {
      setRecoveryError(error instanceof Error ? error.message : "The recovery record is corrupt.");
      setRecoveryRecord(null);
      void clearRecovery();
      announce("RECOVERY / CORRUPT RECORD DISCARDED", "warning");
    }
  }, [announce, recoveryRecord, refreshHistory]);

  const handleDiscardRecovery = useCallback(() => {
    setRecoveryRecord(null);
    void clearRecovery();
    announce("RECOVERY / DISCARDED");
  }, [announce]);

  const handleDiagnosticExport = useCallback(() => {
    const diagnostic = {
      version: "1.0.0",
      generatedAt: new Date().toISOString(),
      document: documentModel
        ? {
            id: documentModel.id,
            dimensions: [documentModel.width, documentModel.height],
            layerCount: documentModel.layers.length,
            schemaVersion: documentModel.schemaVersion,
          }
        : null,
      history: historyRef.current.snapshot(),
      recoveryError,
      userAgent: navigator.userAgent,
    };
    downloadBlob(
      new Blob([JSON.stringify(diagnostic, null, 2)], { type: "application/json" }),
      "liteedit-diagnostic.json",
    );
    announce("DIAGNOSTIC / EXPORTED");
  }, [announce, documentModel, recoveryError]);

  const runLayerCommand = (
    label: string,
    operation: (model: DocumentModel) => DocumentModel,
    options: CommitHistoryOptions = {},
  ) => {
    if (!documentModel) {
      return;
    }
    try {
      commitDocument(label, operation(documentModel), options);
    } catch (error) {
      announce(error instanceof Error ? error.message : "The layer command failed.", "warning");
    }
  };

  const handleActiveLayerChange = useCallback(
    (layerId: LayerId) => {
      if (transformSession?.layerId === layerId) {
        return;
      }
      setDocumentModel((current) => {
        const base = transformSession?.before ?? current;
        return base ? setActiveLayer(base, layerId) : base;
      });
      if (transformSession || warpSession) {
        setTransformSession(null);
        setWarpSession(null);
        announce("EDIT / CANCELLED ON LAYER CHANGE");
      }
      if (documentModel) {
        const layer = getLayerById(documentModel, layerId);
        if (layer.kind === "vector") {
          const properties = layer.object.properties;
          setShapeKind((properties.kind as ShapeKind | undefined) ?? "rectangle");
          setShapeStyle({
            fill: typeof properties.fill === "string" ? properties.fill : null,
            stroke: typeof properties.stroke === "string" ? properties.stroke : null,
            strokeWidth: typeof properties.strokeWidth === "number" ? properties.strokeWidth : 0,
            sides: typeof properties.sides === "number" ? properties.sides : 5,
          });
        }
      }
    },
    [announce, documentModel, transformSession, warpSession],
  );

  const handleViewportStatus = useCallback((message: string) => announce(message), [announce]);

  const handleControllerReady = useCallback((controller: ViewportController | null) => {
    viewportControllerRef.current = controller;
    setExportReady(controller !== null);
  }, []);

  const handlePointerPosition = useCallback((point: Point | null) => {
    setPointerPosition(point);
  }, []);

  const openFilePicker = () => fileInputRef.current?.click();
  const hasValidBlankSize =
    Number.isInteger(newDocumentWidth) &&
    Number.isInteger(newDocumentHeight) &&
    newDocumentWidth > 0 &&
    newDocumentHeight > 0;
  const panelCount =
    activePanel === "LAYERS"
      ? (documentModel?.layers.length ?? 0)
      : activePanel === "HISTORY"
        ? historySnapshot.applied.length
        : activePanel === "PROPERTIES" && documentModel
          ? 1
          : activePanel === "SWATCHES"
            ? savedSwatches.length
            : 0;
  const interactionMode: RendererInteractionMode = warpSession
    ? "none"
    : transformSession
      ? "transform"
      : activeTool === "move"
        ? "move"
        : "none";
  const selectionBounds = getSelectionBounds(selection);

  if (import.meta.env.DEV && window.location.pathname === "/__gallery") {
    return <ComponentGallery />;
  }

  if (import.meta.env.DEV && window.location.pathname === "/__spikes/phase1") {
    return <Phase1SpikeGallery />;
  }

  return (
    <div className="app-shell">
      <header className="command-bar">
        <div className="brand-lockup" role="group" aria-label="LiteEdit">
          <span className="brand-mark" aria-hidden="true">
            LE
          </span>
          <span className="brand-name">LiteEdit</span>
          <span className="brand-version">V1.0 / LOCAL EDITOR</span>
          <a
            className="portfolio-link"
            href="https://charliepolito.com/"
            aria-label="Back to CharliePolito.com portfolio"
          >
            <img src="/charlie-monogram.svg" alt="" aria-hidden="true" />
            <span>CharliePolito.com</span>
          </a>
        </div>

        <div className="command-actions" role="group" aria-label="Document commands">
          <UiButton className="command-button" onClick={openFilePicker}>
            OPEN
          </UiButton>
          <UiButton
            className="command-button"
            disabled={!documentModel || !exportReady}
            onClick={() => setExportDialogOpen(true)}
          >
            EXPORT
          </UiButton>
          <UiButton
            className="command-button"
            disabled={!documentModel}
            onClick={() => {
              if (!documentModel) return;
              setResizeWidth(documentModel.width);
              setResizeHeight(documentModel.height);
              setResizeDialogOpen(true);
            }}
          >
            RESIZE
          </UiButton>
          <UiButton
            className="command-button"
            disabled={!historySnapshot.canUndo}
            onClick={handleUndo}
          >
            UNDO
          </UiButton>
          <UiButton
            className="command-button"
            disabled={!historySnapshot.canRedo}
            onClick={handleRedo}
          >
            REDO
          </UiButton>
          <UiButton
            className="command-button command-button-new"
            tone="accent"
            onClick={() => {
              cancelActiveEdit();
              setNewDialogOpen(true);
            }}
          >
            NEW
          </UiButton>
          <UiButton
            className="command-button"
            aria-label="Export local diagnostic report"
            onClick={handleDiagnosticExport}
          >
            DIAG
          </UiButton>
          <span className="system-status" role="status">
            <span className="status-led" aria-hidden="true" />
            LOCAL / READY
          </span>
        </div>
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label="Choose a local image"
          onChange={handleFileInputChange}
        />
      </header>

      <div className="workspace">
        <aside className="tool-rail" aria-label="Tools">
          <div className="rail-label">TOOLS</div>
          <div className="tool-list">
            {tools.map((tool) => (
              <Tooltip key={tool.id} label={`${tool.label} / ${tool.shortcut}`}>
                <button
                  className={`tool-button${activeTool === tool.id ? " is-active" : ""}`}
                  type="button"
                  aria-label={`${tool.label} tool, shortcut ${tool.shortcut}`}
                  aria-pressed={activeTool === tool.id}
                  onClick={() => activateTool(tool.id)}
                >
                  <span className="tool-glyph" aria-hidden="true">
                    {tool.glyph}
                  </span>
                  <span className="tool-name">{tool.label}</span>
                  <span className="tool-shortcut">{tool.shortcut}</span>
                </button>
              </Tooltip>
            ))}
          </div>
          <div className="rail-footer" role="group" aria-label="Foreground and background colors">
            <button
              className="color-chip color-chip-foreground"
              style={{ background: foregroundColor }}
              title={`Foreground color ${foregroundColor}`}
              aria-label={`Foreground color ${foregroundColor}`}
              onClick={() => setActivePanel("SWATCHES")}
            />
            <button
              className="color-chip color-chip-background"
              style={{ background: backgroundColor }}
              title={`Background color ${backgroundColor}`}
              aria-label={`Background color ${backgroundColor}`}
              onClick={() => setActivePanel("SWATCHES")}
            />
          </div>
        </aside>

        <main
          className="canvas-zone"
          aria-label="Editor viewport"
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes("Files")) {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }
          }}
          onDrop={handleDrop}
        >
          <div className="viewport-rulers" aria-hidden="true">
            <span>0</span>
            <span>500</span>
            <span>1000</span>
            <span>1500</span>
          </div>
          {documentModel && documentSources ? (
            <DocumentViewport
              model={documentModel}
              sources={documentSources}
              activeTool={activeTool}
              interactionMode={interactionMode}
              warpSession={
                warpSession ? { layerId: warpSession.layerId, nodes: warpSession.nodes } : null
              }
              zoomPercent={zoom}
              brushSettings={{ ...brushSettings, color: foregroundColor }}
              selection={selection}
              selectionMode={selectionMode}
              autoSelectionKind={autoSelectionKind}
              cropRectangle={cropRectangle}
              shapeKind={shapeKind}
              shapeStyle={shapeStyle}
              onZoomChange={setZoom}
              onPointerPosition={handlePointerPosition}
              onActiveLayerChange={handleActiveLayerChange}
              onTransformGesture={handleTransformGesture}
              onWarpNodesChange={(nodes) =>
                setWarpSession((current) => (current ? { ...current, nodes } : current))
              }
              onStatus={handleViewportStatus}
              onRasterEdit={handleRasterEdit}
              onSelectionCommit={handleSelectionCommit}
              onAutoSelect={(request) => void handleAutoSelect(request)}
              onShapeCreate={handleShapeCreate}
              onCropChange={setCropRectangle}
              onPickColor={(color) => {
                updateForegroundColor(color);
                announce(`PICKER / ${color}`, "success");
              }}
              onControllerReady={handleControllerReady}
            />
          ) : (
            <div className="empty-state" data-testid="empty-state">
              <div className="empty-state-marker" aria-hidden="true">
                +
              </div>
              <p className="eyebrow">NO DOCUMENT LOADED</p>
              <h1>LOCAL IMAGE WORKBENCH</h1>
              <p className="empty-state-copy">
                Open a PNG, JPEG, or WebP file to begin. Processing stays in this browser.
              </p>
              <UiButton className="primary-action" tone="accent" onClick={openFilePicker}>
                OPEN IMAGE // LOCAL
              </UiButton>
              {importError ? <p className="import-error">{importError}</p> : null}
              <p className="privacy-line">
                LOCAL PROCESSING / IMAGE DATA DOES NOT LEAVE THIS DEVICE
              </p>
            </div>
          )}
          <div className="viewport-corner viewport-corner-top" aria-hidden="true">
            {getDocumentPointerLabel(pointerPosition)}
          </div>
          <div className="viewport-corner viewport-corner-bottom" aria-hidden="true">
            ZOOM {zoom}% /{" "}
            {documentModel ? `${documentModel.width} × ${documentModel.height}` : "FIT 0"}
          </div>
        </main>

        <aside className="inspector" aria-label="Inspector">
          <Tabs
            options={panelOptions}
            value={activePanel}
            onChange={(id) => {
              if (id !== "PROPERTIES") {
                cancelActiveEdit();
              }
              setActivePanel(id as PanelId);
            }}
            ariaLabel="Inspector panels"
          />
          <div
            className="panel-body"
            id={`panel-${activePanel}`}
            role="tabpanel"
            aria-labelledby={`tab-${activePanel}`}
          >
            <div className="panel-heading">
              <span>{activePanel}</span>
              <span className="panel-count">{String(panelCount).padStart(2, "0")}</span>
            </div>
            {activePanel === "PROPERTIES" && documentModel ? (
              activeTool === "move" || activeTool === "hand" || activeTool === "picker" ? (
                <TransformPanel
                  model={documentModel}
                  zoom={zoom}
                  transformActive={transformSession !== null}
                  warpActive={warpSession !== null}
                  onZoomChange={setZoom}
                  onBeginTransform={beginTransform}
                  onTransformChange={handleTransformChange}
                  onBeginWarp={beginWarp}
                  onCommit={commitActiveEdit}
                  onCancel={cancelActiveEdit}
                />
              ) : (
                <ToolOptionsPanel
                  activeTool={activeTool}
                  brush={brushSettings}
                  onBrushChange={setBrushSettings}
                  selectionMode={selectionMode}
                  onSelectionModeChange={setSelectionMode}
                  autoSelectionKind={autoSelectionKind}
                  onAutoSelectionKindChange={setAutoSelectionKind}
                  tolerance={selectionTolerance}
                  onToleranceChange={setSelectionTolerance}
                  selectionBrushSize={selectionBrushSize}
                  onSelectionBrushSizeChange={setSelectionBrushSize}
                  onInvertSelection={() => {
                    if (!selection) return;
                    setSelection(invertSelection(selection));
                    announce("SELECTION / INVERTED");
                  }}
                  onClearSelection={() => {
                    setSelection(null);
                    announce("SELECTION / CLEARED");
                  }}
                  shapeKind={shapeKind}
                  onShapeKindChange={handleShapeKindChange}
                  shapeStyle={shapeStyle}
                  onShapeStyleChange={handleShapeStyleChange}
                  cropRectangle={cropRectangle}
                  onCropPreset={(ratio) => {
                    if (!documentModel || ratio === null) {
                      setCropRectangle(null);
                      return;
                    }
                    const width = Math.min(documentModel.width, documentModel.height * ratio);
                    const height = width / ratio;
                    setCropRectangle({
                      x: (documentModel.width - width) / 2,
                      y: (documentModel.height - height) / 2,
                      width,
                      height,
                    });
                  }}
                  onCommitCrop={handleCommitCrop}
                  onCropRectangleChange={setCropRectangle}
                  onCancelCrop={() => setCropRectangle(null)}
                />
              )
            ) : activePanel === "LAYERS" && documentModel ? (
              <LayersPanel
                model={documentModel}
                onActivate={handleActiveLayerChange}
                onAddRaster={handleAddRaster}
                onAddGroup={() => {
                  if (!documentModel) return;
                  const result = insertGroupLayer(documentModel);
                  commitDocument(`Add: ${result.layer.name}`, result.document);
                }}
                onDuplicate={handleDuplicate}
                onDelete={(layerId) =>
                  runLayerCommand(`Delete: ${getLayerById(documentModel, layerId).name}`, (model) =>
                    deleteLayerSubtree(model, layerId),
                  )
                }
                onGroup={(layerId) =>
                  runLayerCommand("Group layers", (model) => wrapLayerInGroup(model, layerId))
                }
                onUngroup={(layerId) =>
                  runLayerCommand("Ungroup layers", (model) => ungroupLayer(model, layerId))
                }
                onRename={(layerId, name) =>
                  runLayerCommand(`Rename: ${name.trim()}`, (model) =>
                    renameLayer(model, layerId, name),
                  )
                }
                onToggleVisibility={(layerId, visible) =>
                  runLayerCommand(
                    `${visible ? "Show" : "Hide"}: ${getLayerById(documentModel, layerId).name}`,
                    (model) => setLayerVisibility(model, layerId, visible),
                  )
                }
                onToggleLock={(layerId, locked) =>
                  runLayerCommand(
                    `${locked ? "Lock" : "Unlock"}: ${getLayerById(documentModel, layerId).name}`,
                    (model) => setLayerLocked(model, layerId, locked),
                  )
                }
                onOpacityChange={(layerId, opacity) =>
                  runLayerCommand(
                    `Opacity: ${Math.round(opacity * 100)}%`,
                    (model) => setLayerOpacity(model, layerId, opacity),
                    { coalesceKey: `opacity:${layerId}` },
                  )
                }
                onMoveWithinParent={(layerId, direction) =>
                  runLayerCommand(
                    `Reorder: ${getLayerById(documentModel, layerId).name}`,
                    (model) => moveLayerWithinParent(model, layerId, direction),
                  )
                }
                onMove={(layerId, parentId, index) =>
                  runLayerCommand(`Move: ${getLayerById(documentModel, layerId).name}`, (model) =>
                    moveLayer(model, layerId, parentId, index),
                  )
                }
                onOutdent={(layerId) =>
                  runLayerCommand(
                    `Outdent: ${getLayerById(documentModel, layerId).name}`,
                    (model) => outdentLayer(model, layerId),
                  )
                }
                onRasterize={handleRasterizeVector}
              />
            ) : activePanel === "HISTORY" && documentModel ? (
              <HistoryPanel snapshot={historySnapshot} onUndo={handleUndo} onRedo={handleRedo} />
            ) : activePanel === "SWATCHES" ? (
              <SwatchesPanel
                foreground={foregroundColor}
                background={backgroundColor}
                recent={recentColors}
                saved={savedSwatches}
                onForegroundChange={updateForegroundColor}
                onBackgroundChange={(color) => setBackgroundColor(normalizeHexColor(color))}
                onSwap={() => {
                  const foreground = foregroundColor;
                  updateForegroundColor(backgroundColor);
                  setBackgroundColor(foreground);
                }}
                onReset={() => {
                  updateForegroundColor("#101719");
                  setBackgroundColor("#FFFFFF");
                }}
                onSave={() => {
                  const next = [
                    foregroundColor,
                    ...savedSwatches.filter((color) => color !== foregroundColor),
                  ].slice(0, 24);
                  setSavedSwatches(next);
                  saveSwatches(next);
                }}
                onRemove={(color) => {
                  const next = savedSwatches.filter((value) => value !== color);
                  setSavedSwatches(next);
                  saveSwatches(next);
                }}
              />
            ) : (
              <div className="panel-empty">
                <span className="panel-empty-code">// WAITING FOR DOCUMENT</span>
                <span>{panelCopy[activePanel]}</span>
              </div>
            )}
          </div>
        </aside>
      </div>

      <footer className="status-bar">
        <span>DOCUMENT / {documentModel?.name.toUpperCase() ?? "NONE"}</span>
        <span>
          SIZE /{" "}
          {documentModel ? `${documentModel.width} × ${documentModel.height} PX` : "— × — PX"}
        </span>
        <span>POINTER / {getDocumentPointerLabel(pointerPosition)}</span>
        <span>
          ACTIVE /{" "}
          {warpSession ? "WARP" : transformSession ? "TRANSFORM" : activeTool.toUpperCase()}
        </span>
        <span>HISTORY / {historySnapshot.applied.length}</span>
        <span>MEMORY / {heapMegabytes === null ? "N/A" : `${heapMegabytes} MIB`}</span>
        <span>
          SELECT /{" "}
          {selectionBusy
            ? "WORKING"
            : selectionBounds
              ? `${selectionBounds.width} × ${selectionBounds.height} / ${selectionMode.toUpperCase()}`
              : "NONE"}
        </span>
        <span className="status-bar-right">BUILD / V1 RELEASE</span>
      </footer>

      {toastMessage ? <Toast message={toastMessage} tone={toastTone} /> : null}

      <Dialog
        open={newDialogOpen}
        title="NEW DOCUMENT"
        onClose={() => setNewDialogOpen(false)}
        footer={
          <>
            <UiButton onClick={() => setNewDialogOpen(false)}>CANCEL</UiButton>
            <UiButton tone="accent" disabled={!hasValidBlankSize} onClick={handleCreateBlank}>
              CREATE BLANK
            </UiButton>
          </>
        }
      >
        <p className="dialog-copy">
          Start a local raster document. The canvas stays in this browser until you choose to
          export.
        </p>
        <div className="new-document-fields">
          <NumericField
            label="WIDTH"
            value={newDocumentWidth}
            min={1}
            max={8192}
            suffix="PX"
            onChange={setNewDocumentWidth}
          />
          <NumericField
            label="HEIGHT"
            value={newDocumentHeight}
            min={1}
            max={8192}
            suffix="PX"
            onChange={setNewDocumentHeight}
          />
        </div>
        <label className="new-document-background">
          <span className="field-label">BACKGROUND</span>
          <select
            value={newDocumentBackground}
            onChange={(event) => setNewDocumentBackground(event.target.value as DocumentBackground)}
          >
            <option value="transparent">TRANSPARENT</option>
            <option value="white">WHITE</option>
            <option value="black">BLACK</option>
          </select>
        </label>
        <div className="dialog-spec">
          <span>MODE</span>
          <strong>LOCAL / LOSSLESS</strong>
        </div>
      </Dialog>

      <Dialog
        open={exportDialogOpen}
        title="EXPORT AS"
        onClose={() => {
          if (exportBusy) cancelExport();
          else setExportDialogOpen(false);
        }}
        footer={
          <>
            <UiButton onClick={exportBusy ? cancelExport : () => setExportDialogOpen(false)}>
              CANCEL
            </UiButton>
            <UiButton tone="accent" disabled={exportBusy} onClick={() => void handleExport()}>
              {exportBusy ? "ENCODING…" : "EXPORT FILE"}
            </UiButton>
          </>
        }
      >
        <p className="dialog-copy">
          Export the isolated document at full resolution. Selection guides and editor controls are
          excluded.
        </p>
        <label className="select-field">
          <span>FORMAT</span>
          <select
            value={exportFormat}
            onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
          >
            <option value="png">PNG / LOSSLESS + ALPHA</option>
            <option value="jpeg">JPEG / COMPACT</option>
          </select>
        </label>
        {exportFormat === "jpeg" ? (
          <div className="dialog-control-stack">
            <NumericField
              label="QUALITY"
              value={Math.round(exportQuality * 100)}
              min={10}
              max={100}
              suffix="%"
              onChange={(value) => setExportQuality(value / 100)}
            />
            <NumericField
              label="TARGET SIZE"
              value={exportTargetKilobytes}
              min={0}
              max={102400}
              suffix="KB"
              onChange={setExportTargetKilobytes}
            />
            <label className="color-field">
              <span>ALPHA MATTE</span>
              <input
                type="color"
                value={exportMatte}
                onChange={(event) => setExportMatte(event.target.value)}
              />
              <code>{exportMatte}</code>
            </label>
          </div>
        ) : (
          <p className="tool-options-help">PNG PRESERVES ALPHA. QUALITY DOES NOT APPLY.</p>
        )}
        <label className="option-row">
          <span>EXPORT SELECTION BOUNDS</span>
          <input
            type="checkbox"
            checked={exportSelectionOnly}
            disabled={!selection}
            onChange={(event) => setExportSelectionOnly(event.target.checked)}
          />
        </label>
      </Dialog>

      <Dialog
        open={resizeDialogOpen}
        title="RESIZE DOCUMENT"
        onClose={() => setResizeDialogOpen(false)}
        footer={
          <>
            <UiButton onClick={() => setResizeDialogOpen(false)}>CANCEL</UiButton>
            <UiButton tone="accent" onClick={handleCommitResize}>
              RESIZE
            </UiButton>
          </>
        }
      >
        <p className="dialog-copy">Change output dimensions. This operation is undoable.</p>
        <div className="new-document-fields">
          <NumericField
            label="WIDTH"
            value={resizeWidth}
            min={1}
            max={8192}
            suffix="PX"
            onChange={(width) => {
              setResizeWidth(width);
              if (resizeLinked && documentModel) {
                setResizeHeight(
                  Math.max(1, Math.round((width * documentModel.height) / documentModel.width)),
                );
              }
            }}
          />
          <NumericField
            label="HEIGHT"
            value={resizeHeight}
            min={1}
            max={8192}
            suffix="PX"
            onChange={(height) => {
              setResizeHeight(height);
              if (resizeLinked && documentModel) {
                setResizeWidth(
                  Math.max(1, Math.round((height * documentModel.width) / documentModel.height)),
                );
              }
            }}
          />
        </div>
        <label className="option-row">
          <span>LINK ASPECT</span>
          <input
            type="checkbox"
            checked={resizeLinked}
            onChange={(event) => setResizeLinked(event.target.checked)}
          />
        </label>
        <label className="select-field">
          <span>RESAMPLING</span>
          <select
            value={resampling}
            onChange={(event) => setResampling(event.target.value as ResamplingMode)}
          >
            <option value="nearest">NEAREST / HARD PIXELS</option>
            <option value="bilinear">BILINEAR / FAST</option>
            <option value="high">HIGH QUALITY</option>
          </select>
        </label>
      </Dialog>

      <Dialog
        open={recoveryRecord !== null}
        title="RESTORE LOCAL RECOVERY?"
        onClose={handleDiscardRecovery}
        footer={
          <>
            <UiButton onClick={handleDiscardRecovery}>DISCARD</UiButton>
            <UiButton tone="accent" onClick={() => void handleRestoreRecovery()}>
              RESTORE
            </UiButton>
          </>
        }
      >
        <p className="dialog-copy">
          LiteEdit found a local document recovery from{" "}
          {recoveryRecord
            ? new Date(recoveryRecord.savedAt).toLocaleString()
            : "an earlier session"}
          . No image data leaves this device.
        </p>
      </Dialog>
    </div>
  );
}

export default App;
