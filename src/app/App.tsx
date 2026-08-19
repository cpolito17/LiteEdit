import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ComponentGallery } from "./ComponentGallery";
import { DocumentViewport, getDocumentPointerLabel } from "./DocumentViewport";
import { Phase1SpikeGallery } from "./Phase1SpikeGallery";
import { getShortcutAction } from "./shortcuts";
import { panels, tools, type PanelId, type ToolId } from "./tool-model";
import { HistoryPanel } from "../components/panels/HistoryPanel";
import { LayersPanel } from "../components/panels/LayersPanel";
import {
  Dialog,
  NumericField,
  SliderField,
  Tabs,
  Toast,
  Tooltip,
  UiButton,
} from "../components/primitives/Ui";
import {
  createBlankDocument,
  deleteLayerSubtree,
  duplicateLayerSubtree,
  getLayerById,
  insertGroupLayer,
  insertRasterLayer,
  moveLayer,
  moveLayerWithinParent,
  outdentLayer,
  renameLayer,
  setActiveLayer,
  setLayerLocked,
  setLayerOpacity,
  setLayerVisibility,
  ungroupLayer,
  wrapLayerInGroup,
  type DocumentBackground,
  type DocumentModel,
  type LayerId,
} from "../editor/document-model";
import { StructuralHistory, type CommitHistoryOptions } from "../editor/history/structural-history";
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
import type { Point } from "../editor/viewport";

const panelOptions = panels.map((panel) => ({ id: panel, label: panel }));

const panelCopy: Record<PanelId, string> = {
  LAYERS: "Create or open a document to manage its layer tree.",
  HISTORY: "Structural edits appear here as reversible transactions.",
  PROPERTIES: "Viewport and document controls are ready for local raster work.",
  SWATCHES: "Color tokens stay local until the raster editing surface lands.",
};

type ToastTone = "info" | "success" | "warning";

function App() {
  const [activeTool, setActiveTool] = useState<ToolId>("move");
  const [activePanel, setActivePanel] = useState<PanelId>("LAYERS");
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
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
  const [historyVersion, setHistoryVersion] = useState(0);
  const historyRef = useRef(new StructuralHistory());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportHandlerRef = useRef<(() => void) | null>(null);
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

  const refreshHistory = useCallback(() => {
    setHistoryVersion((version) => version + 1);
  }, []);

  const commitDocument = useCallback(
    (
      label: string,
      next: DocumentModel,
      options: CommitHistoryOptions = {},
      tone: ToastTone = "success",
    ) => {
      if (!documentModel) {
        return false;
      }
      const committed = historyRef.current.commit(label, documentModel, next, options);
      if (!committed) {
        return false;
      }
      setDocumentModel(next);
      refreshHistory();
      announce(label.toUpperCase(), tone);
      return true;
    },
    [announce, documentModel, refreshHistory],
  );

  const handleUndo = useCallback(() => {
    const label = historyRef.current.snapshot().applied.at(-1)?.label;
    const restored = historyRef.current.undo();
    if (!restored) {
      announce(documentModel ? "UNDO / AT DOCUMENT START" : "UNDO / NO DOCUMENT LOADED");
      return;
    }
    setDocumentModel(restored);
    refreshHistory();
    announce(`UNDO / ${label ?? "EDIT"}`);
  }, [announce, documentModel, refreshHistory]);

  const handleRedo = useCallback(() => {
    const label = historyRef.current.snapshot().redo[0]?.label;
    const restored = historyRef.current.redo();
    if (!restored) {
      announce(documentModel ? "REDO / NO PENDING EDIT" : "REDO / NO DOCUMENT LOADED");
      return;
    }
    setDocumentModel(restored);
    refreshHistory();
    announce(`REDO / ${label ?? "EDIT"}`);
  }, [announce, documentModel, refreshHistory]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const action = getShortcutAction(event);
      if (!action) {
        return;
      }

      event.preventDefault();
      switch (action.type) {
        case "tool":
          setActiveTool(action.tool);
          announce(`ACTIVE TOOL / ${action.tool.toUpperCase()}`);
          break;
        case "undo":
          handleUndo();
          break;
        case "redo":
          handleRedo();
          break;
        case "clear-selection":
          announce("SELECTION / CLEARED");
          break;
        case "transform":
          announce(documentModel ? "TRANSFORM / PHASE 5" : "TRANSFORM / WAITING FOR DOCUMENT");
          break;
        case "cancel":
          setNewDialogOpen(false);
          announce("ACTION / CANCELLED");
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [announce, documentModel, handleRedo, handleUndo]);

  const setDocument = useCallback(
    (model: DocumentModel, source: RasterSource, message: string) => {
      historyRef.current.clear();
      setDocumentModel(model);
      setDocumentSources(createRasterSourceMap(model, source));
      setPointerPosition(null);
      setImportError(null);
      setExportReady(false);
      setZoom(100);
      setRotation(0);
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

  const handleActiveLayerChange = useCallback((layerId: LayerId) => {
    setDocumentModel((current) => (current ? setActiveLayer(current, layerId) : current));
  }, []);

  const handleViewportStatus = useCallback((message: string) => announce(message), [announce]);

  const handleExportReady = useCallback((handler: (() => void) | null) => {
    exportHandlerRef.current = handler;
    setExportReady(handler !== null);
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
        : 0;

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
          <span className="brand-version">V0.3 / LAYERS + HISTORY</span>
        </div>

        <div className="command-actions" role="group" aria-label="Document commands">
          <UiButton className="command-button" onClick={openFilePicker}>
            OPEN
          </UiButton>
          <UiButton
            className="command-button"
            disabled={!documentModel || !exportReady}
            onClick={() => exportHandlerRef.current?.()}
          >
            EXPORT
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
            onClick={() => setNewDialogOpen(true)}
          >
            NEW
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
                  onClick={() => {
                    setActiveTool(tool.id);
                    announce(`ACTIVE TOOL / ${tool.label}`);
                  }}
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
            <span className="color-chip color-chip-foreground" title="Foreground color" />
            <span className="color-chip color-chip-background" title="Background color" />
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
              zoomPercent={zoom}
              onZoomChange={setZoom}
              onPointerPosition={handlePointerPosition}
              onActiveLayerChange={handleActiveLayerChange}
              onStatus={handleViewportStatus}
              onExportReady={handleExportReady}
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
            onChange={(id) => setActivePanel(id as PanelId)}
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
            {activePanel === "PROPERTIES" ? (
              <div className="property-controls">
                <NumericField
                  label="ROTATION"
                  value={rotation}
                  min={-180}
                  max={180}
                  suffix="°"
                  onChange={setRotation}
                />
                <SliderField
                  label="ZOOM"
                  value={zoom}
                  min={5}
                  max={3200}
                  suffix="%"
                  onChange={setZoom}
                />
              </div>
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
              />
            ) : activePanel === "HISTORY" && documentModel ? (
              <HistoryPanel snapshot={historySnapshot} onUndo={handleUndo} onRedo={handleRedo} />
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
        <span>ACTIVE / {activeTool.toUpperCase()}</span>
        <span>HISTORY / {historySnapshot.applied.length}</span>
        <span className="status-bar-right">BUILD / PHASE 4</span>
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
    </div>
  );
}

export default App;
