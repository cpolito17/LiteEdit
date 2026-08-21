import type { ToolId } from "../../app/tool-model";
import type { BrushSettings } from "../../editor/raster/brush-engine";
import type { SelectionBounds, SelectionCombineMode } from "../../editor/selection/selection-mask";
import type { ShapeKind, ShapeStyle } from "../../editor/vector/shape-geometry";
import { NumericField, UiButton } from "../primitives/Ui";

type ToolOptionsPanelProps = {
  activeTool: ToolId;
  brush: BrushSettings;
  onBrushChange: (settings: BrushSettings) => void;
  selectionMode: SelectionCombineMode;
  onSelectionModeChange: (mode: SelectionCombineMode) => void;
  autoSelectionKind: "quick" | "object";
  onAutoSelectionKindChange: (kind: "quick" | "object") => void;
  tolerance: number;
  onToleranceChange: (value: number) => void;
  selectionBrushSize: number;
  onSelectionBrushSizeChange: (value: number) => void;
  onInvertSelection: () => void;
  onClearSelection: () => void;
  shapeKind: ShapeKind;
  onShapeKindChange: (kind: ShapeKind) => void;
  shapeStyle: ShapeStyle;
  onShapeStyleChange: (style: ShapeStyle) => void;
  cropRectangle: SelectionBounds | null;
  onCropPreset: (ratio: number | null) => void;
  onCropRectangleChange: (rectangle: SelectionBounds) => void;
  onCommitCrop: () => void;
  onCancelCrop: () => void;
};

const selectionModes: SelectionCombineMode[] = ["replace", "add", "subtract", "intersect"];
const shapeKinds: ShapeKind[] = [
  "rectangle",
  "ellipse",
  "triangle",
  "polygon",
  "star",
  "line",
  "arrow",
];

export function ToolOptionsPanel(props: ToolOptionsPanelProps) {
  const {
    activeTool,
    brush,
    onBrushChange,
    selectionMode,
    onSelectionModeChange,
    autoSelectionKind,
    onAutoSelectionKindChange,
    tolerance,
    onToleranceChange,
    selectionBrushSize,
    onSelectionBrushSizeChange,
    onInvertSelection,
    onClearSelection,
    shapeKind,
    onShapeKindChange,
    shapeStyle,
    onShapeStyleChange,
    cropRectangle,
    onCropPreset,
    onCropRectangleChange,
    onCommitCrop,
    onCancelCrop,
  } = props;

  if (activeTool === "brush" || activeTool === "eraser") {
    return (
      <div className="tool-options-panel">
        <p className="tool-options-title">{activeTool.toUpperCase()} ENGINE</p>
        <NumericField
          label="DIAMETER"
          value={brush.diameter}
          min={1}
          max={500}
          suffix="PX"
          onChange={(diameter) => onBrushChange({ ...brush, diameter })}
        />
        <NumericField
          label="HARDNESS"
          value={brush.hardness}
          min={0}
          max={100}
          suffix="%"
          onChange={(hardness) => onBrushChange({ ...brush, hardness })}
        />
        <NumericField
          label="OPACITY"
          value={brush.opacity}
          min={1}
          max={100}
          suffix="%"
          onChange={(opacity) => onBrushChange({ ...brush, opacity })}
        />
        <NumericField
          label="SPACING"
          value={brush.spacing}
          min={1}
          max={100}
          suffix="%"
          onChange={(spacing) => onBrushChange({ ...brush, spacing })}
        />
        <label className="option-row">
          <span>PRESSURE SIZE</span>
          <input
            type="checkbox"
            checked={brush.pressure}
            onChange={(event) => onBrushChange({ ...brush, pressure: event.target.checked })}
          />
        </label>
        <label className="color-field">
          <span>COLOR</span>
          <input
            type="color"
            value={brush.color}
            disabled={activeTool === "eraser"}
            onChange={(event) => onBrushChange({ ...brush, color: event.target.value })}
          />
          <code>{brush.color.toUpperCase()}</code>
        </label>
      </div>
    );
  }

  if (activeTool === "marquee" || activeTool === "lasso" || activeTool === "select") {
    return (
      <div className="tool-options-panel">
        <p className="tool-options-title">SELECTION MASK</p>
        <label className="select-field">
          <span>COMBINE</span>
          <select
            value={selectionMode}
            onChange={(event) => onSelectionModeChange(event.target.value as SelectionCombineMode)}
          >
            {selectionModes.map((mode) => (
              <option key={mode} value={mode}>
                {mode.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        {activeTool === "select" ? (
          <>
            <label className="select-field">
              <span>ENGINE</span>
              <select
                value={autoSelectionKind}
                onChange={(event) =>
                  onAutoSelectionKindChange(event.target.value as "quick" | "object")
                }
              >
                <option value="quick">QUICK / SEED</option>
                <option value="object">OBJECT / REGION</option>
              </select>
            </label>
            <NumericField
              label="TOLERANCE"
              value={tolerance}
              min={0}
              max={441}
              suffix="Δ"
              onChange={onToleranceChange}
            />
            <NumericField
              label="BRUSH SIZE"
              value={selectionBrushSize}
              min={1}
              max={500}
              suffix="PX"
              onChange={onSelectionBrushSizeChange}
            />
          </>
        ) : null}
        <div className="tool-option-actions">
          <UiButton onClick={onInvertSelection}>INVERT</UiButton>
          <UiButton onClick={onClearSelection}>CLEAR</UiButton>
        </div>
      </div>
    );
  }

  if (activeTool === "shape") {
    return (
      <div className="tool-options-panel">
        <p className="tool-options-title">VECTOR SHAPE</p>
        <label className="select-field">
          <span>SHAPE</span>
          <select
            value={shapeKind}
            onChange={(event) => onShapeKindChange(event.target.value as ShapeKind)}
          >
            {shapeKinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="color-field">
          <span>FILL</span>
          <input
            type="color"
            value={shapeStyle.fill ?? "#70ffd2"}
            onChange={(event) => onShapeStyleChange({ ...shapeStyle, fill: event.target.value })}
          />
          <input
            aria-label="Enable shape fill"
            type="checkbox"
            checked={shapeStyle.fill !== null}
            onChange={(event) =>
              onShapeStyleChange({ ...shapeStyle, fill: event.target.checked ? "#70ffd2" : null })
            }
          />
        </label>
        <label className="color-field">
          <span>STROKE</span>
          <input
            type="color"
            value={shapeStyle.stroke ?? "#101719"}
            onChange={(event) => onShapeStyleChange({ ...shapeStyle, stroke: event.target.value })}
          />
          <input
            aria-label="Enable shape stroke"
            type="checkbox"
            checked={shapeStyle.stroke !== null}
            onChange={(event) =>
              onShapeStyleChange({ ...shapeStyle, stroke: event.target.checked ? "#101719" : null })
            }
          />
        </label>
        <NumericField
          label="STROKE WIDTH"
          value={shapeStyle.strokeWidth}
          min={0}
          max={100}
          suffix="PX"
          onChange={(strokeWidth) => onShapeStyleChange({ ...shapeStyle, strokeWidth })}
        />
        {shapeKind === "polygon" || shapeKind === "star" ? (
          <NumericField
            label="SIDES"
            value={shapeStyle.sides}
            min={3}
            max={12}
            suffix=""
            onChange={(sides) => onShapeStyleChange({ ...shapeStyle, sides })}
          />
        ) : null}
        <p className="tool-options-help">SHIFT CONSTRAINS / ALT DRAWS FROM CENTER</p>
      </div>
    );
  }

  if (activeTool === "crop") {
    return (
      <div className="tool-options-panel">
        <p className="tool-options-title">DOCUMENT CROP</p>
        <div className="crop-presets">
          <UiButton onClick={() => onCropPreset(null)}>FREE</UiButton>
          <UiButton onClick={() => onCropPreset(1)}>1:1</UiButton>
          <UiButton onClick={() => onCropPreset(4 / 3)}>4:3</UiButton>
          <UiButton onClick={() => onCropPreset(3 / 2)}>3:2</UiButton>
          <UiButton onClick={() => onCropPreset(16 / 9)}>16:9</UiButton>
        </div>
        <p className="tool-options-help">
          {cropRectangle
            ? `${Math.round(cropRectangle.width)} × ${Math.round(cropRectangle.height)} PX`
            : "DRAG ON THE DOCUMENT TO SET CROP"}
        </p>
        {cropRectangle ? (
          <div className="crop-dimension-fields">
            <NumericField
              label="X"
              value={Math.round(cropRectangle.x)}
              min={0}
              max={8191}
              suffix="PX"
              onChange={(x) => onCropRectangleChange({ ...cropRectangle, x })}
            />
            <NumericField
              label="Y"
              value={Math.round(cropRectangle.y)}
              min={0}
              max={8191}
              suffix="PX"
              onChange={(y) => onCropRectangleChange({ ...cropRectangle, y })}
            />
            <NumericField
              label="OUTPUT WIDTH"
              value={Math.round(cropRectangle.width)}
              min={1}
              max={8192}
              suffix="PX"
              onChange={(width) => onCropRectangleChange({ ...cropRectangle, width })}
            />
            <NumericField
              label="OUTPUT HEIGHT"
              value={Math.round(cropRectangle.height)}
              min={1}
              max={8192}
              suffix="PX"
              onChange={(height) => onCropRectangleChange({ ...cropRectangle, height })}
            />
          </div>
        ) : null}
        <div className="tool-option-actions">
          <UiButton tone="accent" disabled={!cropRectangle} onClick={onCommitCrop}>
            COMMIT
          </UiButton>
          <UiButton onClick={onCancelCrop}>CANCEL</UiButton>
        </div>
      </div>
    );
  }

  return null;
}
