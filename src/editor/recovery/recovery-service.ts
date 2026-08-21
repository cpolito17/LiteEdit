import { assertDocumentInvariant, type DocumentModel } from "../document-model";
import {
  createTransparentRasterSource,
  type RasterSource,
  type RasterSourceMap,
} from "../raster/raster-sources";

const DATABASE_NAME = "liteedit-recovery";
const STORE_NAME = "documents";
const RECORD_KEY = "active";
export const RECOVERY_SCHEMA_VERSION = 1;

export type RecoveryRecord = {
  schemaVersion: typeof RECOVERY_SCHEMA_VERSION;
  savedAt: number;
  document: DocumentModel;
  rasters: Array<{ bufferId: string; blob: Blob; width: number; height: number }>;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Recovery database could not open."));
  });
}

function sourceToBlob(source: RasterSource, width: number, height: number): Promise<Blob> {
  const canvas = createTransparentRasterSource(width, height);
  canvas.getContext("2d")?.drawImage(source, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Recovery image could not encode."))),
      "image/png",
    );
  });
}

async function blobToCanvas(blob: Blob, width: number, height: number): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = createTransparentRasterSource(width, height);
    canvas.getContext("2d")?.drawImage(image, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function saveRecovery(
  document: DocumentModel,
  sources: RasterSourceMap,
): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  assertDocumentInvariant(document);
  const rasters = await Promise.all(
    document.layers
      .filter((layer) => layer.kind === "raster")
      .map(async (layer) => {
        const source = sources[layer.bufferId];
        if (!source) throw new Error(`Recovery source ${layer.bufferId} is missing.`);
        return {
          bufferId: layer.bufferId,
          blob: await sourceToBlob(source, layer.width, layer.height),
          width: layer.width,
          height: layer.height,
        };
      }),
  );
  const record: RecoveryRecord = {
    schemaVersion: RECOVERY_SCHEMA_VERSION,
    savedAt: Date.now(),
    document,
    rasters,
  };
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put(record, RECORD_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Recovery write failed."));
    });
  } finally {
    database.close();
  }
}

export async function loadRecovery(): Promise<RecoveryRecord | null> {
  if (typeof indexedDB === "undefined") return null;
  const database = await openDatabase();
  try {
    return await new Promise<RecoveryRecord | null>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(RECORD_KEY);
      request.onsuccess = () => resolve((request.result as RecoveryRecord | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Recovery read failed."));
    });
  } finally {
    database.close();
  }
}

export async function restoreRecovery(
  record: RecoveryRecord,
): Promise<{ document: DocumentModel; sources: RasterSourceMap }> {
  if (record.schemaVersion !== RECOVERY_SCHEMA_VERSION) {
    throw new Error("The recovery record uses an unsupported version.");
  }
  assertDocumentInvariant(record.document);
  const sources: Record<string, RasterSource> = {};
  for (const raster of record.rasters) {
    sources[raster.bufferId] = await blobToCanvas(raster.blob, raster.width, raster.height);
  }
  for (const layer of record.document.layers) {
    if (layer.kind === "raster" && !sources[layer.bufferId]) {
      throw new Error("The recovery record is incomplete.");
    }
  }
  return { document: record.document, sources };
}

export async function clearRecovery(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).delete(RECORD_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Recovery clear failed."));
    });
  } finally {
    database.close();
  }
}
