import {
  Canvas,
  FabricImage,
  Group,
  StaticCanvas,
  util,
  type FabricObject,
  type TMat2D,
} from "fabric";

import {
  getLayerById,
  type DocumentModel,
  type LayerId,
  type LayerNode,
  type Matrix2D,
} from "../document-model";
import type { RasterSource, RasterSourceMap } from "../raster/raster-sources";
import { invertMatrix, multiplyMatrices } from "../transform";
import type { ViewportTransform } from "../viewport";

export type DocumentSource = RasterSource;
export type DocumentSources = RasterSourceMap;
export type RendererInteractionMode = "none" | "move" | "transform";

export type TransformGesture = {
  layerId: LayerId;
  matrix: Matrix2D;
  action: "move" | "scale" | "rotate" | "transform";
};

type BuildOptions = {
  interactionMode: RendererInteractionMode;
  register?: (layerId: LayerId, object: FabricObject, baseMatrix: Matrix2D) => void;
};

function getSourceSize(source: RasterSource): { width: number; height: number } {
  if ("naturalWidth" in source && source.naturalWidth > 0 && source.naturalHeight > 0) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: source.width, height: source.height };
}

function toMatrix(matrix: TMat2D): Matrix2D {
  return [...matrix] as Matrix2D;
}

function applyInteractionState(
  object: FabricObject,
  interactionMode: RendererInteractionMode,
  locked: boolean,
): void {
  const enabled = interactionMode !== "none";
  const transformEnabled = interactionMode === "transform" && !locked;
  const moveEnabled = enabled && !locked;
  object.set({
    borderColor: "#70ffd2",
    cornerColor: "#fffc8c",
    cornerStrokeColor: "#151918",
    evented: enabled,
    hasBorders: enabled,
    hasControls: transformEnabled,
    hoverCursor: locked ? "not-allowed" : moveEnabled ? "move" : "pointer",
    lockMovementX: !moveEnabled,
    lockMovementY: !moveEnabled,
    lockRotation: !transformEnabled,
    lockScalingFlip: true,
    lockScalingX: !transformEnabled,
    lockScalingY: !transformEnabled,
    lockSkewingX: true,
    lockSkewingY: true,
    selectable: enabled,
    transparentCorners: false,
  });
}

function applyModelTransform(object: FabricObject, layer: LayerNode, baseMatrix: Matrix2D): void {
  const finalMatrix = multiplyMatrices(layer.transform, baseMatrix);
  util.applyTransformToObject(object, finalMatrix as TMat2D);
  object.setCoords();
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
    left: 0,
    objectCaching: false,
    opacity: layer.opacity,
    originX: "left",
    originY: "top",
    scaleX: layer.width / sourceSize.width,
    scaleY: layer.height / sourceSize.height,
    top: 0,
    visible: layer.visible,
  });
  const baseMatrix = toMatrix(image.calcOwnMatrix());
  applyModelTransform(image, layer, baseMatrix);
  applyInteractionState(image, options.interactionMode, layer.locked);
  options.register?.(layer.id, image, baseMatrix);
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
    interactive: options.interactionMode !== "none",
    objectCaching: true,
    opacity: layer.opacity,
    subTargetCheck: options.interactionMode !== "none",
    visible: layer.visible,
  });
  const baseMatrix = toMatrix(group.calcOwnMatrix());
  applyModelTransform(group, layer, baseMatrix);
  applyInteractionState(group, options.interactionMode, layer.locked);
  options.register?.(layer.id, group, baseMatrix);
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

function normalizeGestureAction(action: string | undefined): TransformGesture["action"] {
  if (action === "drag") return "move";
  if (action === "scale" || action === "scaleX" || action === "scaleY") return "scale";
  if (action === "rotate") return "rotate";
  return "transform";
}

function renderDocumentCanvas(
  documentModel: DocumentModel,
  sources: DocumentSources,
): HTMLCanvasElement {
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
        interactionMode: "none",
      }),
    );
    exportCanvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    exportCanvas.renderAll();
    const output = document.createElement("canvas");
    output.width = documentModel.width;
    output.height = documentModel.height;
    const context = output.getContext("2d");
    if (!context) {
      throw new Error("The browser did not provide a 2D canvas context.");
    }
    context.drawImage(exportCanvas.getElement(), 0, 0);
    return output;
  } finally {
    void exportCanvas.dispose();
  }
}

export class FabricRendererAdapter {
  readonly canvas: Canvas;
  private objectByLayerId = new Map<LayerId, FabricObject>();
  private layerIdByObject = new WeakMap<FabricObject, LayerId>();
  private baseMatrixByLayerId = new Map<LayerId, Matrix2D>();
  private lockedByLayerId = new Map<LayerId, boolean>();
  private activeLayerHandler: ((layerId: LayerId) => void) | null = null;
  private transformGestureHandler: ((gesture: TransformGesture) => void) | null = null;
  private interactionMode: RendererInteractionMode = "move";
  private settingActiveLayer = false;

  constructor(element: HTMLCanvasElement) {
    this.canvas = new Canvas(element, {
      enableRetinaScaling: false,
      preserveObjectStacking: true,
      renderOnAddRemove: false,
      selection: false,
    });

    this.canvas.on("mouse:down", (event) => {
      if (this.interactionMode === "none" || this.settingActiveLayer) {
        return;
      }
      const candidates = (
        this.interactionMode === "transform"
          ? [event.target]
          : [event.target, ...(event.subTargets ?? [])]
      ).filter((candidate): candidate is FabricObject => candidate !== undefined);
      for (let index = candidates.length - 1; index >= 0; index -= 1) {
        const candidate = candidates[index];
        if (!candidate) continue;
        const layerId = this.layerIdByObject.get(candidate);
        if (layerId) {
          this.activeLayerHandler?.(layerId);
          return;
        }
      }
    });

    this.canvas.on("object:modified", (event) => {
      const target = event.target;
      if (!target) return;
      const layerId = this.layerIdByObject.get(target);
      if (!layerId || this.lockedByLayerId.get(layerId)) return;
      const baseMatrix = this.baseMatrixByLayerId.get(layerId);
      if (!baseMatrix) return;
      const matrix = multiplyMatrices(toMatrix(target.calcOwnMatrix()), invertMatrix(baseMatrix));
      this.transformGestureHandler?.({
        layerId,
        matrix,
        action: normalizeGestureAction(event.transform?.action),
      });
    });
  }

  setActiveLayerHandler(handler: ((layerId: LayerId) => void) | null): void {
    this.activeLayerHandler = handler;
  }

  setTransformGestureHandler(handler: ((gesture: TransformGesture) => void) | null): void {
    this.transformGestureHandler = handler;
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
    this.baseMatrixByLayerId = new Map();
    this.lockedByLayerId = new Map();

    const objects = buildRootObjects(documentModel, sources, {
      interactionMode: this.interactionMode,
      register: (layerId, object, baseMatrix) => {
        this.objectByLayerId.set(layerId, object);
        this.layerIdByObject.set(object, layerId);
        this.baseMatrixByLayerId.set(layerId, baseMatrix);
        this.lockedByLayerId.set(layerId, getLayerById(documentModel, layerId).locked);
      },
    });
    this.canvas.add(...objects);
    this.setActiveLayer(documentModel.activeLayerId);
    this.canvas.requestRenderAll();
  }

  setInteractionMode(mode: RendererInteractionMode): void {
    this.interactionMode = mode;
    this.canvas.skipTargetFind = mode === "none";
    if (mode === "none") {
      this.canvas.discardActiveObject();
    }
    for (const [layerId, object] of this.objectByLayerId) {
      applyInteractionState(object, mode, this.lockedByLayerId.get(layerId) ?? false);
    }
    this.canvas.requestRenderAll();
  }

  setActiveLayer(layerId: LayerId): void {
    if (this.interactionMode === "none") return;
    let object = this.objectByLayerId.get(layerId);
    if (!object || !object.visible) {
      this.canvas.discardActiveObject();
      this.canvas.requestRenderAll();
      return;
    }
    while (object.group) object = object.group;
    this.settingActiveLayer = true;
    this.canvas.setActiveObject(object);
    this.settingActiveLayer = false;
    this.canvas.requestRenderAll();
  }

  readLayerTransform(layerId: LayerId): Matrix2D {
    const object = this.objectByLayerId.get(layerId);
    const base = this.baseMatrixByLayerId.get(layerId);
    if (!object || !base) {
      throw new Error(`Layer ${layerId} is not rendered.`);
    }
    return multiplyMatrices(toMatrix(object.calcOwnMatrix()), invertMatrix(base));
  }

  setViewportTransform(transform: ViewportTransform): void {
    this.canvas.setViewportTransform(transform as TMat2D);
    this.canvas.requestRenderAll();
  }

  getViewportTransform(): ViewportTransform {
    return [...this.canvas.viewportTransform] as ViewportTransform;
  }

  exportPng(documentModel: DocumentModel, sources: DocumentSources): string {
    return renderDocumentCanvas(documentModel, sources).toDataURL("image/png");
  }

  renderDocumentPixels(documentModel: DocumentModel, sources: DocumentSources): ImageData {
    const canvas = renderDocumentCanvas(documentModel, sources);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      throw new Error("The browser did not provide a 2D canvas context.");
    }
    return context.getImageData(0, 0, canvas.width, canvas.height);
  }

  dispose(): Promise<boolean> {
    this.activeLayerHandler = null;
    this.transformGestureHandler = null;
    this.objectByLayerId.clear();
    this.baseMatrixByLayerId.clear();
    this.lockedByLayerId.clear();
    return this.canvas.dispose();
  }
}
