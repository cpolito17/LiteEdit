import { getActiveLayer, type DocumentModel } from "../../editor/document-model";
import { getTransformFields, type TransformFields } from "../../editor/transform";
import { NumericField, SliderField, UiButton } from "../primitives/Ui";

type TransformPanelProps = {
  model: DocumentModel;
  zoom: number;
  transformActive: boolean;
  warpActive: boolean;
  onZoomChange: (zoom: number) => void;
  onBeginTransform: () => void;
  onTransformChange: (fields: TransformFields) => void;
  onBeginWarp: () => void;
  onCommit: () => void;
  onCancel: () => void;
};

function displayNumber(value: number): number {
  return Math.round(value * 100) / 100;
}

export function TransformPanel({
  model,
  zoom,
  transformActive,
  warpActive,
  onZoomChange,
  onBeginTransform,
  onTransformChange,
  onBeginWarp,
  onCommit,
  onCancel,
}: TransformPanelProps) {
  const layer = getActiveLayer(model);
  const fields = getTransformFields(model, layer.id);
  const numericEnabled = transformActive && !warpActive && !layer.locked;
  const update = (key: keyof TransformFields, value: number) => {
    onTransformChange({ ...fields, [key]: value });
  };

  return (
    <div className="transform-panel">
      <div className="transform-summary">
        <span>ACTIVE LAYER</span>
        <strong>{layer.name}</strong>
        <span>{layer.kind.toUpperCase()}</span>
      </div>

      <div className="transform-toolbar" role="toolbar" aria-label="Transform commands">
        {!transformActive && !warpActive ? (
          <>
            <UiButton disabled={layer.locked} onClick={onBeginTransform}>
              TRANSFORM
            </UiButton>
            <UiButton disabled={layer.kind !== "raster" || layer.locked} onClick={onBeginWarp}>
              WARP 3 × 3
            </UiButton>
          </>
        ) : (
          <>
            <UiButton tone="accent" onClick={onCommit}>
              COMMIT
            </UiButton>
            <UiButton onClick={onCancel}>CANCEL</UiButton>
          </>
        )}
      </div>

      <div className={`transform-state${transformActive || warpActive ? " is-active" : ""}`}>
        {warpActive
          ? "WARP / DRAG NINE NODES / ENTER COMMITS / ESC CANCELS"
          : transformActive
            ? "TRANSFORM / ENTER COMMITS / ESC CANCELS"
            : layer.locked
              ? "LOCKED / UNLOCK THE LAYER TO EDIT"
              : "READY / CTRL OR CMD + T TO TRANSFORM"}
      </div>

      <div className="transform-fields">
        <NumericField
          label="CENTER X"
          value={displayNumber(fields.x)}
          step={0.1}
          suffix="PX"
          disabled={!numericEnabled}
          onChange={(value) => update("x", value)}
        />
        <NumericField
          label="CENTER Y"
          value={displayNumber(fields.y)}
          step={0.1}
          suffix="PX"
          disabled={!numericEnabled}
          onChange={(value) => update("y", value)}
        />
        <NumericField
          label="SCALE X"
          value={displayNumber(fields.scaleX)}
          min={1}
          max={10000}
          step={0.1}
          suffix="%"
          disabled={!numericEnabled}
          onChange={(value) => update("scaleX", value)}
        />
        <NumericField
          label="SCALE Y"
          value={displayNumber(fields.scaleY)}
          min={1}
          max={10000}
          step={0.1}
          suffix="%"
          disabled={!numericEnabled}
          onChange={(value) => update("scaleY", value)}
        />
        <NumericField
          label="ROTATION"
          value={displayNumber(fields.rotation)}
          min={-360}
          max={360}
          step={0.1}
          suffix="°"
          disabled={!numericEnabled}
          onChange={(value) => update("rotation", value)}
        />
        <NumericField
          label="SKEW"
          value={displayNumber(fields.skew)}
          min={-85}
          max={85}
          step={0.1}
          suffix="°"
          disabled={!numericEnabled}
          onChange={(value) => update("skew", value)}
        />
      </div>

      <div className="transform-zoom">
        <SliderField
          label="VIEW ZOOM"
          value={zoom}
          min={5}
          max={3200}
          suffix="%"
          onChange={onZoomChange}
        />
      </div>
    </div>
  );
}
