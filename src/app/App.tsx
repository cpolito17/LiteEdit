import { useState } from "react";

const tools = [
  { id: "move", label: "MOVE", shortcut: "V", glyph: "↔" },
  { id: "marquee", label: "MARQUEE", shortcut: "M", glyph: "□" },
  { id: "lasso", label: "LASSO", shortcut: "L", glyph: "⌁" },
  { id: "select", label: "SELECT", shortcut: "W", glyph: "✦" },
  { id: "brush", label: "BRUSH", shortcut: "B", glyph: "╱" },
  { id: "shape", label: "SHAPE", shortcut: "U", glyph: "△" },
  { id: "eraser", label: "ERASER", shortcut: "E", glyph: "⌫" },
  { id: "crop", label: "CROP", shortcut: "C", glyph: "▣" },
  { id: "picker", label: "PICKER", shortcut: "I", glyph: "⊙" },
] as const;

const panels = ["LAYERS", "HISTORY", "PROPERTIES", "SWATCHES"] as const;

type ToolId = (typeof tools)[number]["id"];
type PanelId = (typeof panels)[number];

function App() {
  const [activeTool, setActiveTool] = useState<ToolId>("move");
  const [activePanel, setActivePanel] = useState<PanelId>("LAYERS");

  return (
    <div className="app-shell">
      <header className="command-bar">
        <div className="brand-lockup" aria-label="LiteEdit">
          <span className="brand-mark" aria-hidden="true">
            LE
          </span>
          <span className="brand-name">LITEEDIT</span>
          <span className="brand-version">V0.1 / BOOTSTRAP</span>
        </div>

        <div className="command-actions" aria-label="Document commands">
          <button className="command-button" type="button" disabled>
            OPEN
          </button>
          <button className="command-button" type="button" disabled>
            EXPORT
          </button>
          <button className="command-button" type="button" disabled>
            UNDO
          </button>
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
              <button
                key={tool.id}
                className={`tool-button${activeTool === tool.id ? " is-active" : ""}`}
                type="button"
                aria-label={`${tool.label} tool, shortcut ${tool.shortcut}`}
                aria-pressed={activeTool === tool.id}
                onClick={() => setActiveTool(tool.id)}
              >
                <span className="tool-glyph" aria-hidden="true">
                  {tool.glyph}
                </span>
                <span className="tool-name">{tool.label}</span>
                <span className="tool-shortcut">{tool.shortcut}</span>
              </button>
            ))}
          </div>
          <div className="rail-footer" aria-label="Foreground and background colors">
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
            <button className="primary-action" type="button" disabled>
              OPEN IMAGE // PHASE 3
            </button>
            <p className="privacy-line">LOCAL PROCESSING / IMAGE DATA DOES NOT LEAVE THIS DEVICE</p>
          </div>
          <div className="viewport-corner viewport-corner-top" aria-hidden="true">
            X 0000 / Y 0000
          </div>
          <div className="viewport-corner viewport-corner-bottom" aria-hidden="true">
            ZOOM 100% / FIT 0
          </div>
        </main>

        <aside className="inspector" aria-label="Inspector">
          <div className="panel-tabs" role="tablist" aria-label="Inspector panels">
            {panels.map((panel) => (
              <button
                key={panel}
                className={`panel-tab${activePanel === panel ? " is-active" : ""}`}
                type="button"
                role="tab"
                aria-selected={activePanel === panel}
                onClick={() => setActivePanel(panel)}
              >
                {panel}
              </button>
            ))}
          </div>
          <div className="panel-body" role="tabpanel" aria-label={`${activePanel} panel`}>
            <div className="panel-heading">
              <span>{activePanel}</span>
              <span className="panel-count">00</span>
            </div>
            <div className="panel-empty">
              <span className="panel-empty-code">// WAITING FOR DOCUMENT</span>
              <span>Phase {activePanel === "LAYERS" ? "4" : "2+"} integration pending.</span>
            </div>
          </div>
        </aside>
      </div>

      <footer className="status-bar">
        <span>DOCUMENT / NONE</span>
        <span>SIZE / — × — PX</span>
        <span>ACTIVE / {activeTool.toUpperCase()}</span>
        <span className="status-bar-right">BUILD / BOOTSTRAP</span>
      </footer>
    </div>
  );
}

export default App;
