export const tools = [
  { id: "move", label: "MOVE", shortcut: "V", glyph: "↔" },
  { id: "marquee", label: "MARQUEE", shortcut: "M", glyph: "□" },
  { id: "lasso", label: "LASSO", shortcut: "L", glyph: "⌁" },
  { id: "select", label: "SELECT", shortcut: "W", glyph: "✦" },
  { id: "brush", label: "BRUSH", shortcut: "B", glyph: "╱" },
  { id: "shape", label: "SHAPE", shortcut: "U", glyph: "△" },
  { id: "eraser", label: "ERASER", shortcut: "E", glyph: "⌫" },
  { id: "crop", label: "CROP", shortcut: "C", glyph: "▣" },
  { id: "picker", label: "PICKER", shortcut: "I", glyph: "⊙" },
  { id: "hand", label: "HAND", shortcut: "H", glyph: "✋" },
] as const;

export type ToolId = (typeof tools)[number]["id"];

export const panels = ["LAYERS", "HISTORY", "PROPERTIES", "SWATCHES"] as const;

export type PanelId = (typeof panels)[number];
