import { FabricImage, Group, Rect, StaticCanvas } from "fabric";

export type FabricSceneSnapshot = ReturnType<StaticCanvas["toJSON"]>;

export function createSpikeCanvas(element: HTMLCanvasElement): StaticCanvas {
  return new StaticCanvas(element, {
    enableRetinaScaling: false,
    height: 120,
    renderOnAddRemove: false,
    width: 160,
  });
}

export function buildFabricScene(canvas: StaticCanvas): Group {
  const rasterPlaceholder = new Rect({
    fill: "#273239",
    height: 72,
    left: 0,
    top: 0,
    width: 96,
  });
  const vectorShape = new Rect({
    fill: "#ff9137",
    height: 28,
    left: 18,
    top: 22,
    width: 60,
  });
  const group = new Group([rasterPlaceholder, vectorShape], {
    angle: 12,
    left: 80,
    opacity: 0.5,
    originX: "center",
    originY: "center",
    top: 60,
  });

  canvas.add(group);
  return group;
}

export function serializeFabricScene(canvas: StaticCanvas): FabricSceneSnapshot {
  return canvas.toJSON();
}

export async function restoreFabricScene(
  element: HTMLCanvasElement,
  snapshot: FabricSceneSnapshot,
): Promise<StaticCanvas> {
  const canvas = createSpikeCanvas(element);
  await canvas.loadFromJSON(snapshot);
  return canvas;
}

export function createRasterFabricImage(element: HTMLCanvasElement): FabricImage {
  return new FabricImage(element, { objectCaching: false });
}
