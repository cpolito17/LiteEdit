import { Canvas, FabricImage, Group, StaticCanvas, type FabricObject, type TMat2D } from "fabric";

import { getLayerById, type DocumentModel, type LayerId, type LayerNode } from "../document-model";
import type { RasterSource, RasterSourceMap } from "../raster/raster-sources";
import type { ViewportTransform } from "../viewport";

export type DocumentSource = RasterSource;
export type DocumentSources = RasterSourceMap;

type BuildOptions = {
  interactive: boolean;
  register?: (layerId: LayerId, object: FabricObject) => void;
};

function getSourceSize(source: RasterSource): { width: number; height: number } {
  if ("naturalWidth" in source && source.naturalWidth > 0 && source.naturalHeight > 0) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

function applyInteractionState(object: FabricObject, interactive: boolean, locked: boolean): void {
  object.set({
    evented: interactive,
    hasBorders: interactive,
    hasControls: false,
    hoverCursor: locked ? "not-allowed" : "pointer",
    lockMovementX: true,
    lockMovementY: true,
    lockRotation: true,
    lockScalingX: true,
    lockScalingY: true,
    lockSkewingX: true,
    lockSkewingY: true,
    selectable: interactive,
  });
}

function buildRasterObject(
  layer: Extract<LayerNode, { kind: "raster" }>,
  sources: DocumentSources,
  options: BuildOptions,
): FabricImage {
  const source = sources[layer.bufferId];
  if (!source) {
    throw new Error(`Raster buffer ${layer.bufferId} is not available.`);
  }
  const sourceSize = getSourceSize(source);
  const image = new FabricImage(source, {
    angle: 0,
    left: layer.transform[4],
    objectCaching: false,
    opacity: layer.opacity,
    originX: "left",
    originY: "top",
    scaleX: (layer.width / sourceSize.width) * layer.transform[0],
    scaleY: (layer.height / sourceSize.height) * layer.transform[3],
    top: layer.transform[5],
    visible: layer.visible,
  });
  applyInteractionState(image, options.interactive, layer.locked);
  options.register?.(layer.id, image);
  return image;
}

function buildLayerObject(
  layerId: LayerId,
  documentModel: DocumentModel,
  sources: DocumentSources,
  options: BuildOptions,
): FabricObject | null {
  const layer = getLayerById(documentModel, layerId);
  if (layer.kind === "raster") {
    return buildRasterObject(layer, sources, options);
  }
  if (layer.kind === "vector") {
    return null;
  }

  const children = layer.childIds
    .map((childId) => buildLayerObject(childId, documentModel, sources, options))
    .filter((object): object is FabricObject => object !== null);
  const group = new Group(children, {
    interactive: options.interactive,
    left: layer.transform[4],
    objectCaching: true,
    opacity: layer.opacity,
    originX: "left",
    originY: "top",
    subTargetCheck: options.interactive,
    top: layer.transform[5],
    visible: layer.visible,
  });
  applyInteractionState(group, options.interactive, layer.locked);
  options.register?.(layer.id, group);
  return group;
}

function buildRootObjects(
  documentModel: DocumentModel,
  sources: DocumentSources,
  options: BuildOptions,
): FabricObject[] {
  return documentModel.rootLayerIds
    .map((layerId) => buildLayerObject(layerId, documentModel, sources, options))
    .filter((object): object is FabricObject => object !== null);
}

export class FabricRendererAdapter {
  readonly canvas: Canvas;
  private objectByLayerId = new Map<LayerId, FabricObject>();
  private layerIdByObject = new WeakMap<FabricObject, LayerId>();
  private activeLayerHandler: ((layerId: LayerId) => void) | null = null;
  private interactionEnabled = true;
  private settingActiveLayer = false;

  constructor(element: HTMLCanvasElement) {
    this.canvas = new Canvas(element, {
      enableRetinaScaling: false,
      preserveObjectStacking: true,
      renderOnAddRemove: false,
      selection: false,
    });

    this.canvas.on("mouse:down", (event) => {
      if (!this.interactionEnabled || this.settingActiveLayer) {
        return;
      }
      const candidates = [event.target, ...(event.subTargets ?? [])].filter(
        (candidate): candidate is FabricObject => candidate !== undefined,
      );
      for (let index = candidates.length - 1; index >= 0; index -= 1) {
        const candidate = candidates[index];
        if (!candidate) {
          continue;
        }
        const layerId = this.layerIdByObject.get(candidate);
        if (layerId) {
          this.activeLayerHandler?.(layerId);
          return;
        }
      }
    });
  }

  setActiveLayerHandler(handler: ((layerId: LayerId) => void) | null): void {
    this.activeLayerHandler = handler;
  }

  setViewportSize(width: number, height: number): void {
    this.canvas.setDimensions({
      width: Math.max(1, Math.floor(width)),
      height: Math.max(1, Math.floor(height)),
    });
    this.canvas.calcOffset();
  }

  setDocument(documentModel: DocumentModel, sources: DocumentSources): void {
    this.canvas.discardActiveObject();
    this.canvas.clear();
    this.objectByLayerId = new Map();
    this.layerIdByObject = new WeakMap();

    const objects = buildRootObjects(documentModel, sources, {
      interactive: this.interactionEnabled,
      register: (layerId, object) => {
        this.objectByLayerId.set(layerId, object);
        this.layerIdByObject.set(object, layerId);
      },
    });
    this.canvas.add(...objects);
    this.setActiveLayer(documentModel.activeLayerId);
    this.canvas.requestRenderAll();
  }

  setInteractionEnabled(enabled: boolean): void {
    this.interactionEnabled = enabled;
    this.canvas.skipTargetFind = !enabled;
    if (!enabled) {
      this.canvas.discardActiveObject();
    }
    for (const object of this.objectByLayerId.values()) {
      object.set({ evented: enabled, selectable: enabled });
    }
    this.canvas.requestRenderAll();
  }

  setActiveLayer(layerId: LayerId): void {
    if (!this.interactionEnabled) {
      return;
    }
    let object = this.objectByLayerId.get(layerId);
    if (!object || !object.visible) {
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
      return;
    }
    while (object.group) {
      object = object.group;
    }
    this.settingActiveLayer = true;
    this.canvas.setActiveObject(object);
    this.settingActiveLayer = false;
    this.canvas.requestRenderAll();
  }

  setViewportTransform(transform: ViewportTransform): void {
    this.canvas.setViewportTransform(transform as TMat2D);
    this.canvas.requestRenderAll();
  }

  getViewportTransform(): ViewportTransform {
    return [...this.canvas.viewportTransform] as ViewportTransform;
  }

  exportPng(documentModel: DocumentModel, sources: DocumentSources): string {
    const element = document.createElement("canvas");
    const exportCanvas = new StaticCanvas(element, {
      enableRetinaScaling: false,
      height: documentModel.height,
      renderOnAddRemove: false,
      width: documentModel.width,
    });
    try {
      exportCanvas.add(
        ...buildRootObjects(documentModel, sources, {
          interactive: false,
        }),
      );
      exportCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      exportCanvas.renderAll();
      return exportCanvas.toDataURL({
        format: "png",
        height: documentModel.height,
        left: 0,
        multiplier: 1,
        top: 0,
        width: documentModel.width,
      });
    } finally {
      void exportCanvas.dispose();
    }
  }

  dispose(): Promise<boolean> {
    this.activeLayerHandler = null;
    this.objectByLayerId.clear();
    return this.canvas.dispose();
  }
}
