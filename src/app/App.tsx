import { useEffect, useState } from "react";

import { ComponentGallery } from "./ComponentGallery";
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

const panelOptions = panels.map((panel) => ({ id: panel, label: panel }));

const panelCopy: Record<PanelId, string> = {
  LAYERS: "Layer stack and visibility controls arrive with the document model.",
  HISTORY: "Tile-level history will expose reversible local operations.",
  PROPERTIES: "Numeric controls are wired as shell primitives for Phase 3.",
  SWATCHES: "Color tokens stay local until the raster editing surface lands.",
};

function App() {
  const [activeTool, setActiveTool] = useState<ToolId>("move");
  const [activePanel, setActivePanel] = useState<PanelId>("LAYERS");
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

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
          setToastMessage(`ACTIVE TOOL / ${action.tool.toUpperCase()}`);
          break;
        case "undo":
          setToastMessage("UNDO / NO DOCUMENT LOADED");
          break;
        case "redo":
          setToastMessage("REDO / NO DOCUMENT LOADED");
          break;
        case "clear-selection":
          setToastMessage("SELECTION / CLEARED");
          break;
        case "transform":
          setToastMessage("TRANSFORM / WAITING FOR DOCUMENT");
          break;
        case "cancel":
          setNewDialogOpen(false);
          setToastMessage("ACTION / CANCELLED");
          break;
      }

      window.setTimeout(() => setToastMessage(null), 2400);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
          <UiButton className="command-button" disabled>
            OPEN
          </UiButton>
          <UiButton className="command-button" disabled>
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

        <main className="canvas-zone" aria-label="Editor viewport">
          <div className="viewport-rulers" aria-hidden="true">
            <span>0</span>
            <span>500</span>
            <span>1000</span>
            <span>1500</span>
          </div>
          <div className="empty-state" data-testid="empty-state">
            <div className="empty-state-marker" aria-hidden="true">
              +
            </div>
            <p className="eyebrow">NO DOCUMENT LOADED</p>
            <h1>LOCAL IMAGE WORKBENCH</h1>
            <p className="empty-state-copy">
              Open a PNG, JPEG, or WebP file to begin. Processing stays in this browser.
            </p>
            <UiButton className="primary-action" tone="accent" disabled>
              OPEN IMAGE // PHASE 3
            </UiButton>
            <p className="privacy-line">LOCAL PROCESSING / IMAGE DATA DOES NOT LEAVE THIS DEVICE</p>
          </div>
          <div className="viewport-corner viewport-corner-top" aria-hidden="true">
            X 0000 / Y 0000
          </div>
          <div className="viewport-corner viewport-corner-bottom" aria-hidden="true">
            ZOOM {zoom}% / FIT 0
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
                  min={25}
                  max={400}
                  suffix="%"
                  onChange={setZoom}
                />
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
        <span>DOCUMENT / NONE</span>
        <span>SIZE / — × — PX</span>
        <span>ACTIVE / {activeTool.toUpperCase()}</span>
        <span className="status-bar-right">BUILD / PHASE 2</span>
      </footer>

      {toastMessage ? <Toast message={toastMessage} /> : null}

      <Dialog
        open={newDialogOpen}
        title="NEW DOCUMENT"
        onClose={() => setNewDialogOpen(false)}
        footer={
          <>
            <UiButton onClick={() => setNewDialogOpen(false)}>CANCEL</UiButton>
            <UiButton tone="accent" disabled>
              CREATE BLANK // PHASE 3
            </UiButton>
          </>
        }
      >
        <p className="dialog-copy">
          Document creation is reserved for the local raster pipeline in Phase 3.
        </p>
        <div className="dialog-spec">
          <span>MODE</span>
          <strong>LOCAL / LOSSLESS</strong>
        </div>
      </Dialog>
    </div>
  );
}

export default App;
