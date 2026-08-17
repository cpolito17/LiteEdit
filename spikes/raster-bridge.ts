export interface RasterSurface {
  readonly canvas: HTMLCanvasElement;
  readonly revision: number;
}

export interface RasterImageAdapter {
  set(property: string, value: unknown): void;
  setCoords(): void;
  setElement(element: HTMLCanvasElement): void;
}

export interface RasterSyncResult {
  readonly revision: number;
  readonly invalidated: true;
}

export function syncRasterSurface(
  adapter: RasterImageAdapter,
  surface: RasterSurface,
): RasterSyncResult {
  adapter.setElement(surface.canvas);
  adapter.set("dirty", true);
  adapter.setCoords();

  return {
    invalidated: true,
    revision: surface.revision,
  };
}
