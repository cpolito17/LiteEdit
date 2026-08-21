export type RgbColor = { red: number; green: number; blue: number };

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function rgbToHex(color: RgbColor): string {
  return `#${[color.red, color.green, color.blue]
    .map((value) => clampChannel(value).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

export function hexToRgb(hex: string): RgbColor {
  const normalized = hex.trim().replace(/^#/, "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((value) => value + value)
          .join("")
      : normalized;
  if (!/^[0-9a-f]{6}$/i.test(expanded))
    throw new Error("Color must use 3 or 6 hexadecimal digits.");
  return {
    red: Number.parseInt(expanded.slice(0, 2), 16),
    green: Number.parseInt(expanded.slice(2, 4), 16),
    blue: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

export function normalizeHexColor(hex: string): string {
  return rgbToHex(hexToRgb(hex));
}

export function sampleImageColor(image: ImageData, x: number, y: number): string {
  const pixelX = Math.max(0, Math.min(image.width - 1, Math.floor(x)));
  const pixelY = Math.max(0, Math.min(image.height - 1, Math.floor(y)));
  const offset = (pixelY * image.width + pixelX) * 4;
  return rgbToHex({
    red: image.data[offset] ?? 0,
    green: image.data[offset + 1] ?? 0,
    blue: image.data[offset + 2] ?? 0,
  });
}

export function loadSavedSwatches(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const values = JSON.parse(localStorage.getItem("liteedit.swatches.v1") ?? "[]") as unknown;
    return Array.isArray(values)
      ? values
          .filter((value): value is string => typeof value === "string")
          .map(normalizeHexColor)
          .slice(0, 24)
      : [];
  } catch {
    return [];
  }
}

export function saveSwatches(swatches: readonly string[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    "liteedit.swatches.v1",
    JSON.stringify([...new Set(swatches.map(normalizeHexColor))].slice(0, 24)),
  );
}
