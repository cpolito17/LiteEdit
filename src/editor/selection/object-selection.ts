import {
  combineSelectionMasks,
  createEmptySelection,
  quickSelectionFromSeed,
  selectionFromRectangle,
  type SelectionBounds,
  type SelectionMask,
} from "./selection-mask";

/**
 * A compact local foreground extractor. It removes border-connected pixels
 * that resemble the supplied region border. This module is lazy-loaded.
 */
export function extractDominantForeground(
  image: ImageData,
  region: SelectionBounds,
  tolerance = 52,
): SelectionMask {
  const x = Math.max(0, Math.min(image.width - 1, Math.floor(region.x)));
  const y = Math.max(0, Math.min(image.height - 1, Math.floor(region.y)));
  const clipped = {
    x,
    y,
    width: Math.max(1, Math.min(image.width - x, Math.ceil(region.width))),
    height: Math.max(1, Math.min(image.height - y, Math.ceil(region.height))),
  };
  const regionMask = selectionFromRectangle(
    image.width,
    image.height,
    { x: clipped.x, y: clipped.y },
    { x: clipped.x + clipped.width, y: clipped.y + clipped.height },
  );
  let background = createEmptySelection(image.width, image.height);
  const seeds = [
    { x: clipped.x, y: clipped.y },
    { x: clipped.x + clipped.width - 1, y: clipped.y },
    { x: clipped.x, y: clipped.y + clipped.height - 1 },
    { x: clipped.x + clipped.width - 1, y: clipped.y + clipped.height - 1 },
  ];
  for (const seed of seeds) {
    background = combineSelectionMasks(
      background,
      quickSelectionFromSeed(image, seed, tolerance),
      "add",
    );
  }
  const foreground = createEmptySelection(image.width, image.height);
  for (let index = 0; index < foreground.data.length; index += 1) {
    foreground.data[index] =
      (regionMask.data[index] ?? 0) > 0 && (background.data[index] ?? 0) === 0 ? 255 : 0;
  }
  return foreground;
}
