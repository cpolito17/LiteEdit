import { hexToRgb } from "../../editor/color/color";
import { UiButton } from "../primitives/Ui";

type SwatchesPanelProps = {
  foreground: string;
  background: string;
  recent: string[];
  saved: string[];
  onForegroundChange: (color: string) => void;
  onBackgroundChange: (color: string) => void;
  onSwap: () => void;
  onReset: () => void;
  onSave: () => void;
  onRemove: (color: string) => void;
};

export function SwatchesPanel(props: SwatchesPanelProps) {
  const rgb = hexToRgb(props.foreground);
  return (
    <div className="swatches-panel">
      <div className="swatch-primary">
        <label>
          <span>FOREGROUND</span>
          <input
            type="color"
            value={props.foreground}
            onChange={(event) => props.onForegroundChange(event.target.value)}
          />
        </label>
        <code>
          {props.foreground} / RGB {rgb.red} {rgb.green} {rgb.blue}
        </code>
        <label>
          <span>BACKGROUND</span>
          <input
            type="color"
            value={props.background}
            onChange={(event) => props.onBackgroundChange(event.target.value)}
          />
        </label>
      </div>
      <div className="swatch-actions">
        <UiButton onClick={props.onSwap}>SWAP</UiButton>
        <UiButton onClick={props.onReset}>RESET</UiButton>
        <UiButton tone="accent" onClick={props.onSave}>
          SAVE
        </UiButton>
      </div>
      <p className="tool-options-title">RECENT</p>
      <div className="swatch-grid">
        {props.recent.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Use recent color ${color}`}
            style={{ background: color }}
            onClick={() => props.onForegroundChange(color)}
          />
        ))}
      </div>
      <p className="tool-options-title">SAVED</p>
      <div className="swatch-grid">
        {props.saved.map((color) => (
          <div className="saved-swatch" key={color}>
            <button
              type="button"
              aria-label={`Use saved color ${color}`}
              style={{ background: color }}
              onClick={() => props.onForegroundChange(color)}
            />
            <button
              className="saved-swatch-remove"
              type="button"
              aria-label={`Remove saved color ${color}`}
              onClick={() => props.onRemove(color)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
