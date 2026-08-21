import {
  quickSelectionFromSeed,
  type SelectionBounds,
  type SelectionPoint,
} from "./selection-mask";

type Request = {
  id: number;
  image: ImageData;
  mode: "quick" | "object";
  seed?: SelectionPoint;
  region?: SelectionBounds;
  tolerance: number;
  brushSize?: number;
};

self.onmessage = async (event: MessageEvent<Request>) => {
  const request = event.data;
  try {
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
    self.postMessage({ id: request.id, mask }, { transfer: [mask.data.buffer] });
  } catch (error) {
    self.postMessage({
      id: request.id,
      error: error instanceof Error ? error.message : "Selection failed.",
    });
  }
};
