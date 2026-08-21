export type BrushMode = "paint" | "erase";

export type BrushPoint = {
  x: number;
  y: number;
  pressure: number;
};

export type BrushSettings = {
  diameter: number;
  hardness: number;
  opacity: number;
  spacing: number;
  color: string;
  pressure: boolean;
  mode: BrushMode;
};

export type DirtyRectangle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const DEFAULT_BRUSH_SETTINGS: BrushSettings = {
  diameter: 32,
  hardness: 80,
  opacity: 100,
  spacing: 18,
  color: "#101719",
  pressure: true,
  mode: "paint",
};

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function mapPressure(pressure: number, enabled: boolean): number {
  if (!enabled || pressure <= 0) return 1;
  return 0.15 + clamp(pressure, 0, 1) * 0.85;
}

export function getStampSpacing(settings: BrushSettings): number {
  return Math.max(0.5, settings.diameter * clamp(settings.spacing, 1, 100) * 0.01);
}

export function interpolateBrushPoints(
  from: BrushPoint,
  to: BrushPoint,
  spacing: number,
): BrushPoint[] {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance === 0) return [to];
  const steps = Math.max(1, Math.ceil(distance / Math.max(0.5, spacing)));
  return Array.from({ length: steps }, (_, index) => {
    const progress = (index + 1) / steps;
    return {
      x: from.x + deltaX * progress,
      y: from.y + deltaY * progress,
      pressure: from.pressure + (to.pressure - from.pressure) * progress,
    };
  });
}

function stampBounds(point: BrushPoint, diameter: number): DirtyRectangle {
  const radius = diameter / 2 + 2;
  const left = Math.floor(point.x - radius);
  const top = Math.floor(point.y - radius);
  return {
    x: left,
    y: top,
    width: Math.ceil(point.x + radius) - left,
    height: Math.ceil(point.y + radius) - top,
  };
}

export function unionDirtyRectangles(
  left: DirtyRectangle | null,
  right: DirtyRectangle,
): DirtyRectangle {
  if (!left) return { ...right };
  const x = Math.min(left.x, right.x);
  const y = Math.min(left.y, right.y);
  const rightEdge = Math.max(left.x + left.width, right.x + right.width);
  const bottomEdge = Math.max(left.y + left.height, right.y + right.height);
  return { x, y, width: rightEdge - x, height: bottomEdge - y };
}

function drawStamp(
  context: CanvasRenderingContext2D,
  point: BrushPoint,
  settings: BrushSettings,
): DirtyRectangle {
  const pressure = mapPressure(point.pressure, settings.pressure);
  const diameter = clamp(settings.diameter, 1, 500) * pressure;
  const radius = diameter / 2;
  const hardness = clamp(settings.hardness, 0, 100) / 100;
  const innerRadius = Math.max(0, radius * hardness);
  const gradient = context.createRadialGradient(
    point.x,
    point.y,
    innerRadius,
    point.x,
    point.y,
    Math.max(radius, innerRadius + 0.01),
  );
  const opacity = clamp(settings.opacity, 1, 100) / 100;
  gradient.addColorStop(0, settings.mode === "erase" ? `rgb(0 0 0 / ${opacity})` : settings.color);
  gradient.addColorStop(1, settings.mode === "erase" ? "rgb(0 0 0 / 0)" : `${settings.color}00`);
  context.save();
  context.globalAlpha = settings.mode === "paint" ? opacity : 1;
  context.globalCompositeOperation = settings.mode === "erase" ? "destination-out" : "source-over";
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
  return stampBounds(point, diameter);
}

export function paintBrushSegment(
  context: CanvasRenderingContext2D,
  from: BrushPoint | null,
  to: BrushPoint,
  settings: BrushSettings,
): DirtyRectangle {
  const points = from ? interpolateBrushPoints(from, to, getStampSpacing(settings)) : [to];
  let dirty: DirtyRectangle | null = null;
  for (const point of points) {
    dirty = unionDirtyRectangles(dirty, drawStamp(context, point, settings));
  }
  return dirty ?? stampBounds(to, settings.diameter);
}

export function clipDirtyRectangle(
  dirty: DirtyRectangle,
  width: number,
  height: number,
): DirtyRectangle | null {
  const x = Math.max(0, Math.floor(dirty.x));
  const y = Math.max(0, Math.floor(dirty.y));
  const right = Math.min(width, Math.ceil(dirty.x + dirty.width));
  const bottom = Math.min(height, Math.ceil(dirty.y + dirty.height));
  return right <= x || bottom <= y ? null : { x, y, width: right - x, height: bottom - y };
}
