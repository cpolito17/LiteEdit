import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { StaticCanvas } from "fabric";

import { applyTilePatch, createTilePatch, hashPixels } from "../../spikes/tile-history";
import type { TilePatch } from "../../spikes/tile-history";
import { findJpegQualityAsync } from "../../spikes/export-search";
import type { JpegQualitySearchResult } from "../../spikes/export-search";
import {
  buildFabricScene,
  createRasterFabricImage,
  createSpikeCanvas,
  restoreFabricScene,
  serializeFabricScene,
} from "../../spikes/fabric-scene";
import { syncRasterSurface, type RasterImageAdapter } from "../../spikes/raster-bridge";
import { buildMeshTriangles, type Point } from "../../spikes/warp-mesh";
import { UiButton } from "../components/primitives/Ui";

type SpikeStatus = "READY" | "PASS" | "BLOCKED";

type SpikeCardProps = {
  title: string;
  description: string;
  status: SpikeStatus;
  children: ReactNode;
};

function SpikeCard({ title, description, status, children }: SpikeCardProps) {
  return (
    <section className="spike-card">
      <div className="spike-card-header">
        <div>
          <p className="spike-label">PHASE 1 SPIKE</p>
          <h2>{title}</h2>
        </div>
        <span className={`spike-status spike-status-${status.toLowerCase()}`}>{status}</span>
      </div>
      <p className="spike-description">{description}</p>
      {children}
    </section>
  );
}

function createCheckerboard(): HTMLCanvasElement {
  const checker = document.createElement("canvas");
  checker.width = 100;
  checker.height = 100;
  const context = checker.getContext("2d");

  if (!context) {
    throw new Error("The browser did not provide a 2D canvas context.");
  }

  const cellSize = 10;
  for (let row = 0; row < 10; row += 1) {
    for (let column = 0; column < 10; column += 1) {
      context.fillStyle = (row + column) % 2 === 0 ? "#f1f5f2" : "#273239";
      context.fillRect(column * cellSize, row * cellSize, cellSize, cellSize);
    }
  }

  return checker;
}

function affineTransform(
  source: readonly [Point, Point, Point],
  destination: readonly [Point, Point, Point],
): [number, number, number, number, number, number] {
  const [sourceA, sourceB, sourceC] = source;
  const [destinationA, destinationB, destinationC] = destination;
  const sourceBDeltaX = sourceB.x - sourceA.x;
  const sourceBDeltaY = sourceB.y - sourceA.y;
  const sourceCDeltaX = sourceC.x - sourceA.x;
  const sourceCDeltaY = sourceC.y - sourceA.y;
  const destinationBDeltaX = destinationB.x - destinationA.x;
  const destinationBDeltaY = destinationB.y - destinationA.y;
  const destinationCDeltaX = destinationC.x - destinationA.x;
  const destinationCDeltaY = destinationC.y - destinationA.y;
  const determinant = sourceBDeltaX * sourceCDeltaY - sourceCDeltaX * sourceBDeltaY;

  if (Math.abs(determinant) < Number.EPSILON) {
    throw new Error("Cannot render a degenerate warp triangle.");
  }

  const a = (destinationBDeltaX * sourceCDeltaY - destinationCDeltaX * sourceBDeltaY) / determinant;
  const c = (destinationCDeltaX * sourceBDeltaX - destinationBDeltaX * sourceCDeltaX) / determinant;
  const b = (destinationBDeltaY * sourceCDeltaY - destinationCDeltaY * sourceBDeltaY) / determinant;
  const d = (destinationCDeltaY * sourceBDeltaX - destinationBDeltaY * sourceCDeltaX) / determinant;
  const e = destinationA.x - a * sourceA.x - c * sourceA.y;
  const f = destinationA.y - b * sourceA.x - d * sourceA.y;

  return [a, b, c, d, e, f];
}

function renderWarp(canvas: HTMLCanvasElement): void {
  canvas.width = 220;
  canvas.height = 220;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("The browser did not provide a 2D canvas context.");
  }

  const source = createCheckerboard();
  const nodes: Point[] = [
    { x: 55, y: 55 },
    { x: 105, y: 47 },
    { x: 155, y: 55 },
    { x: 47, y: 105 },
    { x: 105, y: 111 },
    { x: 163, y: 103 },
    { x: 55, y: 155 },
    { x: 104, y: 164 },
    { x: 155, y: 155 },
  ];
  const triangles = buildMeshTriangles(100, 100, nodes);

  context.fillStyle = "#11181c";
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (const triangle of triangles) {
    context.save();
    context.beginPath();
    context.moveTo(triangle.destination[0].x, triangle.destination[0].y);
    context.lineTo(triangle.destination[1].x, triangle.destination[1].y);
    context.lineTo(triangle.destination[2].x, triangle.destination[2].y);
    context.closePath();
    context.clip();
    context.setTransform(...affineTransform(triangle.source, triangle.destination));
    context.drawImage(source, 0, 0);
    context.restore();
  }

  context.setTransform(1, 0, 0, 1, 0, 0);
  context.strokeStyle = "#70ffd2";
  context.lineWidth = 1;
  for (const triangle of triangles) {
    context.beginPath();
    context.moveTo(triangle.destination[0].x, triangle.destination[0].y);
    context.lineTo(triangle.destination[1].x, triangle.destination[1].y);
    context.lineTo(triangle.destination[2].x, triangle.destination[2].y);
    context.closePath();
    context.stroke();
  }
}

function pointFromPointer(event: ReactPointerEvent<HTMLCanvasElement>): Point {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.max(
      0,
      Math.min(
        event.currentTarget.width,
        Math.round(((event.clientX - bounds.left) * event.currentTarget.width) / bounds.width),
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        event.currentTarget.height,
        Math.round(((event.clientY - bounds.top) * event.currentTarget.height) / bounds.height),
      ),
    ),
  };
}

function putPixels(canvas: HTMLCanvasElement, pixels: Uint8ClampedArray): void {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  const imageData = context.createImageData(canvas.width, canvas.height);
  imageData.data.set(pixels);
  context.putImageData(imageData, 0, 0);
}

function drawHistorySurface(canvas: HTMLCanvasElement): Uint8ClampedArray {
  canvas.width = 300;
  canvas.height = 280;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("The browser did not provide a 2D canvas context.");
  }

  context.fillStyle = "#11181c";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = "#344149";
  context.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 32) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 32) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }

  return context.getImageData(0, 0, canvas.width, canvas.height).data;
}

async function encodeJpegBytes(canvas: HTMLCanvasElement, quality: number): Promise<number> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });
  return blob?.size ?? 0;
}

function createJpegWorkload(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 4096;
  canvas.height = 4096;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("The browser did not provide a 2D canvas context.");
  }

  context.fillStyle = "#192329";
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let row = 0; row < 32; row += 1) {
    for (let column = 0; column < 32; column += 1) {
      context.fillStyle = (row + column) % 2 === 0 ? "#ff9137" : "#273239";
      context.fillRect(column * 128, row * 128, 128, 128);
    }
  }

  return canvas;
}

export function Phase1SpikeGallery() {
  const fabricBeforeRef = useRef<HTMLCanvasElement>(null);
  const fabricAfterRef = useRef<HTMLCanvasElement>(null);
  const rasterDisplayRef = useRef<HTMLCanvasElement>(null);
  const rasterDemoRef = useRef<{
    backing: HTMLCanvasElement;
    display: StaticCanvas;
    image: ReturnType<typeof createRasterFabricImage>;
    revision: number;
  } | null>(null);
  const warpCanvasRef = useRef<HTMLCanvasElement>(null);
  const historyCanvasRef = useRef<HTMLCanvasElement>(null);
  const historyDemoRef = useRef<{
    after: Uint8ClampedArray | null;
    before: Uint8ClampedArray | null;
    current: Uint8ClampedArray;
    drawing: boolean;
    patch: TilePatch | null;
  } | null>(null);

  const [fabricStatus, setFabricStatus] = useState<SpikeStatus>("READY");
  const [fabricDetails, setFabricDetails] = useState("Rendering scene...");
  const [rasterStatus, setRasterStatus] = useState<SpikeStatus>("READY");
  const [rasterDetails, setRasterDetails] = useState(
    "Paint the backing surface to invalidate the renderer.",
  );
  const [warpStatus, setWarpStatus] = useState<SpikeStatus>("READY");
  const [warpZoom, setWarpZoom] = useState(1);
  const [historyStatus, setHistoryStatus] = useState<SpikeStatus>("READY");
  const [historyDetails, setHistoryDetails] = useState(
    "Draw one pointer stroke inside the canvas.",
  );
  const [jpegStatus, setJpegStatus] = useState<SpikeStatus>("READY");
  const [jpegDetails, setJpegDetails] = useState(
    "Run the real browser JPEG encoder against a 4096 × 4096 canvas.",
  );
  const [jpegRunning, setJpegRunning] = useState(false);

  useEffect(() => {
    const beforeElement = fabricBeforeRef.current;
    const afterElement = fabricAfterRef.current;
    if (!beforeElement || !afterElement) {
      return;
    }

    const original = createSpikeCanvas(beforeElement);
    buildFabricScene(original);
    original.renderAll();
    const snapshot = serializeFabricScene(original);
    let restored: StaticCanvas | null = null;
    let cancelled = false;

    void restoreFabricScene(afterElement, snapshot)
      .then((canvas) => {
        if (cancelled) {
          void canvas.dispose();
          return;
        }
        restored = canvas;
        canvas.renderAll();
        setFabricDetails("SERIALIZED / 1 GROUP / OPACITY 0.5 / RESTORED");
      })
      .catch(() => setFabricDetails("RESTORE ERROR / INSPECT CONSOLE"));

    return () => {
      cancelled = true;
      void original.dispose();
      if (restored) {
        void restored.dispose();
      }
    };
  }, []);

  useEffect(() => {
    const displayElement = rasterDisplayRef.current;
    if (!displayElement) {
      return;
    }

    const display = createSpikeCanvas(displayElement);
    const backing = document.createElement("canvas");
    backing.width = 160;
    backing.height = 120;
    const context = backing.getContext("2d");
    if (!context) {
      return;
    }
    context.fillStyle = "#273239";
    context.fillRect(0, 0, backing.width, backing.height);
    context.fillStyle = "#ff9137";
    context.fillRect(24, 24, 64, 48);
    const image = createRasterFabricImage(backing);
    display.add(image);
    display.renderAll();
    rasterDemoRef.current = { backing, display, image, revision: 0 };

    return () => {
      rasterDemoRef.current = null;
      void display.dispose();
    };
  }, []);

  useEffect(() => {
    if (warpCanvasRef.current) {
      renderWarp(warpCanvasRef.current);
    }
  }, [warpZoom]);

  useEffect(() => {
    if (historyCanvasRef.current) {
      const current = drawHistorySurface(historyCanvasRef.current);
      historyDemoRef.current = {
        after: null,
        before: null,
        current,
        drawing: false,
        patch: null,
      };
    }
  }, []);

  function confirmFabricVisual() {
    setFabricStatus("PASS");
  }

  function paintRasterSurface() {
    const demo = rasterDemoRef.current;
    const context = demo?.backing.getContext("2d");
    if (!demo || !context) {
      return;
    }

    context.fillStyle = "#70ffd2";
    context.fillRect(96, 32, 42, 64);
    demo.revision += 1;
    const result = syncRasterSurface(demo.image as unknown as RasterImageAdapter, {
      canvas: demo.backing,
      revision: demo.revision,
    });
    demo.display.renderAll();
    setRasterDetails(
      `REVISION ${result.revision} / INVALIDATED ${String(result.invalidated).toUpperCase()}`,
    );
  }

  function confirmRasterVisual() {
    setRasterStatus("PASS");
  }

  function confirmWarpVisual() {
    setWarpStatus("PASS");
  }

  function handleHistoryPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const demo = historyDemoRef.current;
    const canvas = historyCanvasRef.current;
    if (!demo || !canvas) {
      return;
    }

    const point = pointFromPointer(event);
    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    demo.before = demo.current.slice();
    demo.after = null;
    demo.patch = null;
    demo.drawing = true;
    context.strokeStyle = "#70ffd2";
    context.lineWidth = 8;
    context.lineCap = "square";
    context.beginPath();
    context.moveTo(point.x, point.y);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleHistoryPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const demo = historyDemoRef.current;
    const canvas = historyCanvasRef.current;
    if (!demo?.drawing || !canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }
    const point = pointFromPointer(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function handleHistoryPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    const demo = historyDemoRef.current;
    const canvas = historyCanvasRef.current;
    if (!demo?.drawing || !canvas || !demo.before) {
      return;
    }

    demo.drawing = false;
    const after = canvas.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data;
    if (!after) {
      return;
    }
    demo.after = after;
    demo.current = after;
    demo.patch = createTilePatch(demo.before, after, canvas.width, canvas.height, 0, 0);
    setHistoryDetails(
      `ONE TRANSACTION / TILE ${demo.patch.bounds.width} × ${demo.patch.bounds.height} / BEFORE ${hashPixels(demo.before)} / AFTER ${hashPixels(after)}`,
    );
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function applyHistorySide(side: "before" | "after") {
    const demo = historyDemoRef.current;
    const canvas = historyCanvasRef.current;
    if (!demo?.patch || !canvas) {
      return;
    }
    applyTilePatch(demo.current, canvas.width, demo.patch, side);
    putPixels(canvas, demo.current);
    setHistoryDetails(`${side.toUpperCase()} / ${hashPixels(demo.current)}`);
  }

  function confirmHistoryRoundTrip() {
    const demo = historyDemoRef.current;
    const canvas = historyCanvasRef.current;
    if (!demo?.patch || !demo.before || !demo.after || !canvas) {
      return;
    }
    applyHistorySide("before");
    const undoHash = hashPixels(demo.current);
    applyHistorySide("after");
    const redoHash = hashPixels(demo.current);
    setHistoryStatus(
      undoHash === hashPixels(demo.before) && redoHash === hashPixels(demo.after)
        ? "PASS"
        : "BLOCKED",
    );
  }

  async function runJpegSearch() {
    setJpegRunning(true);
    setJpegStatus("READY");
    setJpegDetails("ENCODING 4096 × 4096 / UI SHOULD REMAIN RESPONSIVE...");
    const canvas = createJpegWorkload();
    const minimumBytes = await encodeJpegBytes(canvas, 0.1);
    const targetBytes = Math.ceil(minimumBytes * 1.6);
    const result: JpegQualitySearchResult = await findJpegQualityAsync({
      encodeBytes: (quality) => encodeJpegBytes(canvas, quality),
      targetBytes,
      toleranceBytes: Math.ceil(targetBytes * 0.05),
    });
    setJpegDetails(
      `TARGET ${targetBytes} BYTES / RESULT ${result.bytes} BYTES / QUALITY ${result.quality.toFixed(3)} / ITERATIONS ${result.iterations}`,
    );
    setJpegStatus(result.withinTarget ? "PASS" : "BLOCKED");
    setJpegRunning(false);
  }

  return (
    <main className="spike-page">
      <header className="spike-page-header">
        <p className="eyebrow">DEV ONLY / __SPIKES / PHASE 1</p>
        <h1>RISK SPIKE BROWSER HARNESS</h1>
        <p>
          These demos provide real canvas, pointer, serialization, and encoder evidence. A PASS
          still requires a human visual check where marked.
        </p>
      </header>

      <div className="spike-grid">
        <SpikeCard
          title="Fabric scene"
          description="Create a grouped raster placeholder and vector shape, serialize the scene, and restore it into a second canvas."
          status={fabricStatus}
        >
          <div className="spike-canvas-pair">
            <div>
              <span className="spike-canvas-label">ORIGINAL</span>
              <canvas ref={fabricBeforeRef} data-testid="fabric-original-canvas" />
            </div>
            <div>
              <span className="spike-canvas-label">RESTORED</span>
              <canvas ref={fabricAfterRef} data-testid="fabric-restored-canvas" />
            </div>
          </div>
          <p className="spike-result" data-testid="fabric-result">
            {fabricDetails}
          </p>
          <UiButton onClick={confirmFabricVisual}>CONFIRM VISUAL MATCH</UiButton>
        </SpikeCard>

        <SpikeCard
          title="Raster bridge"
          description="Paint the backing canvas and invalidate one Fabric image object without rebuilding the scene."
          status={rasterStatus}
        >
          <canvas ref={rasterDisplayRef} data-testid="raster-bridge-canvas" />
          <p className="spike-result" data-testid="raster-result">
            {rasterDetails}
          </p>
          <div className="spike-actions">
            <UiButton onClick={paintRasterSurface}>PAINT BACKING TILE</UiButton>
            <UiButton onClick={confirmRasterVisual}>CONFIRM VISIBLE UPDATE</UiButton>
          </div>
        </SpikeCard>

        <SpikeCard
          title="Warp mesh"
          description="Render a checkerboard through eight triangles from a 3 × 3 mesh. Inspect the result at both zoom levels."
          status={warpStatus}
        >
          <div className="warp-viewport">
            <canvas
              ref={warpCanvasRef}
              className="warp-canvas"
              data-testid="warp-canvas"
              style={{ width: `${220 * warpZoom}px`, height: `${220 * warpZoom}px` }}
            />
          </div>
          <div className="spike-actions">
            <UiButton onClick={() => setWarpZoom(1)}>100%</UiButton>
            <UiButton onClick={() => setWarpZoom(4)}>400%</UiButton>
            <UiButton onClick={confirmWarpVisual}>CONFIRM NO SEAMS</UiButton>
          </div>
        </SpikeCard>

        <SpikeCard
          title="Tile history"
          description="Draw one pointer stroke, capture a 256 × 256 dirty tile, and prove exact undo/redo hashes."
          status={historyStatus}
        >
          <canvas
            ref={historyCanvasRef}
            className="history-canvas"
            data-testid="history-canvas"
            onPointerDown={handleHistoryPointerDown}
            onPointerMove={handleHistoryPointerMove}
            onPointerUp={handleHistoryPointerUp}
            onPointerCancel={handleHistoryPointerUp}
          />
          <p className="spike-result" data-testid="history-result">
            {historyDetails}
          </p>
          <div className="spike-actions">
            <UiButton onClick={() => applyHistorySide("before")}>UNDO TILE</UiButton>
            <UiButton onClick={() => applyHistorySide("after")}>REDO TILE</UiButton>
            <UiButton onClick={confirmHistoryRoundTrip}>CONFIRM HASH ROUND-TRIP</UiButton>
          </div>
        </SpikeCard>

        <SpikeCard
          title="JPEG export search"
          description="Run the real browser JPEG encoder against a 4096 × 4096 canvas with asynchronous bounded quality search."
          status={jpegStatus}
        >
          <p className="spike-result" data-testid="jpeg-result">
            {jpegDetails}
          </p>
          <UiButton disabled={jpegRunning} onClick={() => void runJpegSearch()}>
            {jpegRunning ? "ENCODING..." : "RUN 4096 JPEG SEARCH"}
          </UiButton>
        </SpikeCard>

        <SpikeCard
          title="Object Selection gate"
          description="The required five-photo comparison is intentionally not auto-passed. The quantized lazy-loaded segmentation candidate and owner-provided fixtures are still missing."
          status="BLOCKED"
        >
          <p className="spike-result" data-testid="selection-gate-result">
            BLOCKED / DO NOT SELECT AN ENGINE FROM SYNTHETIC FIXTURES
          </p>
          <p className="spike-note">
            Add five approved local photos and a second candidate with the required lazy-loaded
            model before recording a Phase 1 PASS.
          </p>
        </SpikeCard>
      </div>
    </main>
  );
}
