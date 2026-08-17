import { useCallback, useEffect, useRef, useState } from "react";

import { ComponentGallery } from "./ComponentGallery";
import { DocumentViewport, getDocumentPointerLabel } from "./DocumentViewport";
import { Phase1SpikeGallery } from "./Phase1SpikeGallery";
import { getShortcutAction } from "./shortcuts";
import { panels, tools, type PanelId, type ToolId } from "./tool-model";
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
  type DocumentBackground,
  type DocumentModel,
} from "../editor/document-model";
import {
  createBlankSource,
  createDocumentFromDecodedImage,
  decodeLocalImage,
  ImageImportError,
} from "../editor/import-validation";
import type { DocumentSource } from "../editor/renderer/fabric-adapter";
import type { Point } from "../editor/viewport";

const panelOptions = panels.map((panel) => ({ id: panel, label: panel }));

const panelCopy: Record<PanelId, string> = {
  LAYERS: "Layer visibility and ordering stay local to this document.",
  HISTORY: "Tile-level history will expose reversible local operations.",
  PROPERTIES: "Viewport and document controls are ready for local raster work.",
  SWATCHES: "Color tokens stay local until the raster editing surface lands.",
};

function App() {
  const [activeTool, setActiveTool] = useState<ToolId>("move");
  const [activePanel, setActivePanel] = useState<PanelId>("LAYERS");
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastTone, setToastTone] = useState<"info" | "success" | "warning">("info");
  const [documentModel, setDocumentModel] = useState<DocumentModel | null>(null);
  const [documentSource, setDocumentSource] = useState<DocumentSource | null>(null);
  const [pointerPosition, setPointerPosition] = useState<Point | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [newDocumentWidth, setNewDocumentWidth] = useState(1920);
  const [newDocumentHeight, setNewDocumentHeight] = useState(1080);
  const [newDocumentBackground, setNewDocumentBackground] =
    useState<DocumentBackground>("transparent");
  const [exportReady, setExportReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportHandlerRef = useRef<(() => void) | null>(null);

  const announce = useCallback((message: string, tone: "info" | "success" | "warning" = "info") => {
    setToastMessage(message);
    setToastTone(tone);
    window.setTimeout(() => setToastMessage(null), 2400);
  }, []);

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
          announce(documentModel ? "UNDO / HISTORY NOT READY" : "UNDO / NO DOCUMENT LOADED");
          break;
        case "redo":
          announce(documentModel ? "REDO / HISTORY NOT READY" : "REDO / NO DOCUMENT LOADED");
          break;
        case "clear-selection":
          announce("SELECTION / CLEARED");
          break;
        case "transform":
          announce(
            documentModel ? "TRANSFORM / EDITOR NOT READY" : "TRANSFORM / WAITING FOR DOCUMENT",
          );
          break;
        case "cancel":
          setNewDialogOpen(false);
          announce("ACTION / CANCELLED");
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [announce, documentModel]);

  const setDocument = useCallback(
    (model: DocumentModel, source: DocumentSource, message: string) => {
      setDocumentModel(model);
      setDocumentSource(source);
      setPointerPosition(null);
      setImportError(null);
      setExportReady(false);
      setZoom(100);
      setRotation(0);
      announce(message, "success");
    },
    [announce],
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
          <span className="brand-version">V0.2 / TECHNICAL SHELL</span>
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
          <UiButton className="command-button" disabled>
            UNDO
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
                    setToastMessage(`ACTIVE TOOL / ${tool.label}`);
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
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDrop={handleDrop}
        >
          <div className="viewport-rulers" aria-hidden="true">
            <span>0</span>
            <span>500</span>
            <span>1000</span>
            <span>1500</span>
          </div>
          {documentModel && documentSource ? (
            <DocumentViewport
              model={documentModel}
              source={documentSource}
              activeTool={activeTool}
              zoomPercent={zoom}
              onZoomChange={setZoom}
              onPointerPosition={handlePointerPosition}
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
                OPEN IMAGE // PHASE 3
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
              <span className="panel-count">00</span>
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
              <div className="document-layer-summary">
                <div className="layer-row is-active">
                  <span className="layer-visibility" aria-hidden="true">
                    ●
                  </span>
                  <span className="layer-name">{documentModel.layers[0]?.name}</span>
                  <span className="layer-type">RASTER</span>
                </div>
                <span className="panel-empty-code">
                  {documentModel.layers.length} LAYER / LOCAL DOCUMENT
                </span>
              </div>
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
        <span className="status-bar-right">BUILD / PHASE 3</span>
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
