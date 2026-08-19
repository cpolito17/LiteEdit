import { cloneDocumentModel, serializeDocumentModel, type DocumentModel } from "../document-model";

export const DEFAULT_HISTORY_STEP_LIMIT = 50;
export const DEFAULT_HISTORY_BYTE_LIMIT = 256 * 1024 * 1024;
export const DEFAULT_COALESCE_WINDOW_MS = 250;

type StoredHistoryEntry = {
  id: number;
  label: string;
  before: DocumentModel;
  after: DocumentModel;
  estimatedBytes: number;
  committedAt: number;
  coalesceKey?: string;
};

export type HistoryEntrySummary = Pick<
  StoredHistoryEntry,
  "id" | "label" | "estimatedBytes" | "committedAt"
>;

export type StructuralHistorySnapshot = {
  applied: HistoryEntrySummary[];
  redo: HistoryEntrySummary[];
  canUndo: boolean;
  canRedo: boolean;
  estimatedBytes: number;
  stepLimit: number;
  byteLimit: number;
};

export type CommitHistoryOptions = {
  coalesceKey?: string;
  committedAt?: number;
  coalesceWindowMs?: number;
};

function estimateModelBytes(model: DocumentModel): number {
  const serialized = serializeDocumentModel(model);
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(serialized).byteLength;
  }
  return serialized.length * 2;
}

function summarize(entry: StoredHistoryEntry): HistoryEntrySummary {
  return {
    id: entry.id,
    label: entry.label,
    estimatedBytes: entry.estimatedBytes,
    committedAt: entry.committedAt,
  };
}

export class StructuralHistory {
  private applied: StoredHistoryEntry[] = [];
  private redoEntries: StoredHistoryEntry[] = [];
  private nextId = 1;

  constructor(
    private readonly stepLimit = DEFAULT_HISTORY_STEP_LIMIT,
    private readonly byteLimit = DEFAULT_HISTORY_BYTE_LIMIT,
  ) {
    if (!Number.isInteger(stepLimit) || stepLimit < 1 || byteLimit < 1) {
      throw new Error("History limits must be positive.");
    }
  }

  clear(): void {
    this.applied = [];
    this.redoEntries = [];
    this.nextId = 1;
  }

  commit(
    label: string,
    before: DocumentModel,
    after: DocumentModel,
    options: CommitHistoryOptions = {},
  ): boolean {
    const normalizedLabel = label.trim();
    if (!normalizedLabel) {
      throw new Error("History labels cannot be empty.");
    }

    const beforeSerialized = serializeDocumentModel(before);
    const afterSerialized = serializeDocumentModel(after);
    if (beforeSerialized === afterSerialized) {
      return false;
    }

    const committedAt = options.committedAt ?? Date.now();
    const coalesceWindowMs = options.coalesceWindowMs ?? DEFAULT_COALESCE_WINDOW_MS;
    const previous = this.applied[this.applied.length - 1];
    if (
      options.coalesceKey &&
      previous?.coalesceKey === options.coalesceKey &&
      committedAt - previous.committedAt <= coalesceWindowMs
    ) {
      previous.after = cloneDocumentModel(after);
      previous.label = normalizedLabel;
      previous.committedAt = committedAt;
      previous.estimatedBytes = estimateModelBytes(previous.before) + estimateModelBytes(after);
    } else {
      this.applied.push({
        id: this.nextId,
        label: normalizedLabel,
        before: cloneDocumentModel(before),
        after: cloneDocumentModel(after),
        estimatedBytes: estimateModelBytes(before) + estimateModelBytes(after),
        committedAt,
        coalesceKey: options.coalesceKey,
      });
      this.nextId += 1;
    }

    this.redoEntries = [];
    this.evictOldestEntries();
    return true;
  }

  undo(): DocumentModel | null {
    const entry = this.applied.pop();
    if (!entry) {
      return null;
    }
    this.redoEntries.push(entry);
    return cloneDocumentModel(entry.before);
  }

  redo(): DocumentModel | null {
    const entry = this.redoEntries.pop();
    if (!entry) {
      return null;
    }
    this.applied.push(entry);
    return cloneDocumentModel(entry.after);
  }

  snapshot(): StructuralHistorySnapshot {
    return {
      applied: this.applied.map(summarize),
      redo: [...this.redoEntries].reverse().map(summarize),
      canUndo: this.applied.length > 0,
      canRedo: this.redoEntries.length > 0,
      estimatedBytes: this.totalBytes(),
      stepLimit: this.stepLimit,
      byteLimit: this.byteLimit,
    };
  }

  private totalBytes(): number {
    return [...this.applied, ...this.redoEntries].reduce(
      (total, entry) => total + entry.estimatedBytes,
      0,
    );
  }

  private evictOldestEntries(): void {
    while (
      this.applied.length > 1 &&
      (this.applied.length > this.stepLimit || this.totalBytes() > this.byteLimit)
    ) {
      this.applied.shift();
    }
  }
}
