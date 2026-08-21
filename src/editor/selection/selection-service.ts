import {
  quickSelectionFromSeed,
  type SelectionBounds,
  type SelectionMask,
  type SelectionPoint,
} from "./selection-mask";

export type SelectionRequest = {
  image: ImageData;
  mode: "quick" | "object";
  seed?: SelectionPoint;
  region?: SelectionBounds;
  tolerance: number;
  brushSize?: number;
};

let nextRequestId = 1;

export class SelectionService {
  private worker: Worker | null = null;
  private generation = 0;
  private pending = new Set<(mask: SelectionMask | null) => void>();

  cancel(): void {
    this.generation += 1;
    this.worker?.terminate();
    this.worker = null;
    for (const resolve of this.pending) resolve(null);
    this.pending.clear();
  }

  async run(request: SelectionRequest): Promise<SelectionMask | null> {
    const generation = ++this.generation;
    if (typeof Worker === "undefined") {
      const mask =
        request.mode === "quick"
          ? quickSelectionFromSeed(
              request.image,
              request.seed ?? { x: 0, y: 0 },
              request.tolerance,
              request.brushSize,
            )
          : (await import("./object-selection")).extractDominantForeground(
              request.image,
              request.region ?? {
                x: 0,
                y: 0,
                width: request.image.width,
                height: request.image.height,
              },
              request.tolerance,
            );
      return generation === this.generation ? mask : null;
    }

    this.worker ??= new Worker(new URL("./selection-worker.ts", import.meta.url), {
      type: "module",
    });
    const worker = this.worker;
    const id = nextRequestId++;
    return new Promise<SelectionMask | null>((resolve, reject) => {
      const settle = (mask: SelectionMask | null) => {
        this.pending.delete(settle);
        resolve(mask);
      };
      this.pending.add(settle);
      const handleMessage = (
        event: MessageEvent<{ id: number; mask?: SelectionMask; error?: string }>,
      ) => {
        if (event.data.id !== id) return;
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
        this.pending.delete(settle);
        if (event.data.error) reject(new Error(event.data.error));
        else settle(generation === this.generation ? (event.data.mask ?? null) : null);
      };
      const handleError = (event: ErrorEvent) => {
        worker.removeEventListener("message", handleMessage);
        worker.removeEventListener("error", handleError);
        this.pending.delete(settle);
        reject(new Error(event.message || "Selection worker failed."));
      };
      worker.addEventListener("message", handleMessage);
      worker.addEventListener("error", handleError);
      worker.postMessage({ id, ...request });
    });
  }
}
