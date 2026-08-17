import { useState } from "react";

import {
  Dialog,
  NumericField,
  Popover,
  SliderField,
  Tabs,
  Toast,
  Tooltip,
  UiButton,
} from "../components/primitives/Ui";

const galleryTabs = [
  { id: "controls", label: "CONTROLS" },
  { id: "feedback", label: "FEEDBACK" },
] as const;

export function ComponentGallery() {
  const [activeTab, setActiveTab] = useState<string>("controls");
  const [numericValue, setNumericValue] = useState(24);
  const [sliderValue, setSliderValue] = useState(65);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(true);

  return (
    <main className="gallery-page">
      <header className="gallery-header">
        <p className="eyebrow">DEV ONLY / __GALLERY</p>
        <h1>INDUSTRIAL UI PRIMITIVES</h1>
        <p>Keyboard-ready controls for the LiteEdit editor shell.</p>
      </header>

      <Tabs
        options={galleryTabs}
        value={activeTab}
        onChange={setActiveTab}
        ariaLabel="Gallery sections"
      />

      <section
        className="gallery-panel"
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-label={`${activeTab} gallery panel`}
      >
        {activeTab === "controls" ? (
          <div className="gallery-grid">
            <div className="gallery-card">
              <p className="gallery-label">BUTTONS</p>
              <div className="gallery-row">
                <UiButton>NEUTRAL</UiButton>
                <UiButton tone="accent">ACCENT</UiButton>
                <UiButton tone="danger">DANGER</UiButton>
              </div>
              <div className="gallery-row">
                <Tooltip label="A tooltip with keyboard-safe hover behavior">
                  <UiButton>TOOLTIP TARGET</UiButton>
                </Tooltip>
              </div>
            </div>
            <div className="gallery-card">
              <p className="gallery-label">INPUTS</p>
              <NumericField
                label="OFFSET"
                value={numericValue}
                suffix="PX"
                onChange={setNumericValue}
              />
              <SliderField
                label="OPACITY"
                value={sliderValue}
                min={0}
                max={100}
                suffix="%"
                onChange={setSliderValue}
              />
            </div>
          </div>
        ) : (
          <div className="gallery-grid">
            <div className="gallery-card">
              <p className="gallery-label">DIALOG</p>
              <p className="gallery-copy">Dialogs close with Escape or the close control.</p>
              <UiButton tone="accent" onClick={() => setDialogOpen(true)}>
                OPEN DIALOG
              </UiButton>
            </div>
            <div className="gallery-card">
              <p className="gallery-label">TOAST</p>
              <p className="gallery-copy">Use status feedback for local, non-blocking actions.</p>
              <UiButton onClick={() => setToastVisible((visible) => !visible)}>
                {toastVisible ? "HIDE TOAST" : "SHOW TOAST"}
              </UiButton>
              <Popover
                label="VIEW STATUS"
                content={
                  <span className="popover-copy">
                    Popover content is local and closes with Escape.
                  </span>
                }
              />
              {toastVisible ? <Toast message="LOCAL STATE / READY" tone="success" /> : null}
            </div>
          </div>
        )}
      </section>

      <Dialog
        open={dialogOpen}
        title="GALLERY DIALOG"
        onClose={() => setDialogOpen(false)}
        footer={
          <UiButton tone="accent" onClick={() => setDialogOpen(false)}>
            CLOSE
          </UiButton>
        }
      >
        <p className="gallery-copy">
          This is a deliberately small modal primitive for shell-level confirmations.
        </p>
      </Dialog>
    </main>
  );
}
