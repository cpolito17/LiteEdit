import { FabricImage, StaticCanvas, type ImageSource, type TMat2D } from "fabric";

import type { DocumentDimensions } from "../document-model";
import type { ViewportTransform } from "../viewport";

export type DocumentSource = Extract<ImageSource, HTMLImageElement | HTMLCanvasElement>;

export class FabricRendererAdapter {
  readonly canvas: StaticCanvas;
  private documentSize: DocumentDimensions | null = null;
  private imageObject: FabricImage | null = null;

  constructor(element: HTMLCanvasElement) {
    this.canvas = new StaticCanvas(element, {
      enableRetinaScaling: false,
      renderOnAddRemove: false,
      selection: false,
    });
  }

  setViewportSize(width: number, height: number): void {
    this.canvas.setDimensions({
      width: Math.max(1, Math.floor(width)),
      height: Math.max(1, Math.floor(height)),
    });
    this.canvas.calcOffset();
  }

  setDocumentSource(source: DocumentSource, documentSize: DocumentDimensions): void {
    this.canvas.clear();
    this.documentSize = documentSize;
    this.imageObject = new FabricImage(source, {
      evented: false,
      left: 0,
      objectCaching: false,
      originX: "left",
      originY: "top",
      selectable: false,
    });
    this.canvas.add(this.imageObject);
    this.canvas.requestRenderAll();
  }

  setViewportTransform(transform: ViewportTransform): void {
    this.canvas.setViewportTransform(transform as TMat2D);
    this.canvas.requestRenderAll();
  }

  getViewportTransform(): ViewportTransform {
    return [...this.canvas.viewportTransform] as ViewportTransform;
  }

  exportPng(): string {
    if (!this.documentSize) {
      throw new Error("Cannot export without a document.");
    }

    const originalWidth = this.canvas.getWidth();
    const originalHeight = this.canvas.getHeight();
    const originalTransform = this.getViewportTransform();
    try {
      this.canvas.setDimensions({
        width: this.documentSize.width,
        height: this.documentSize.height,
      });
      this.canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      this.canvas.requestRenderAll();
      return this.canvas.toDataURL({
        format: "png",
        height: this.documentSize.height,
        left: 0,
        multiplier: 1,
        top: 0,
        width: this.documentSize.width,
      });
    } finally {
      this.canvas.setDimensions({ width: originalWidth, height: originalHeight });
      this.canvas.setViewportTransform(originalTransform as TMat2D);
      this.canvas.requestRenderAll();
    }
  }

  dispose(): Promise<boolean> {
    this.imageObject = null;
    this.documentSize = null;
    return this.canvas.dispose();
  }
}
