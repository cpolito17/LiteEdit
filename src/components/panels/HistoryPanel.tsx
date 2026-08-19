import type { StructuralHistorySnapshot } from "../../editor/history/structural-history";
import { UiButton } from "../primitives/Ui";

type HistoryPanelProps = {
  snapshot: StructuralHistorySnapshot;
  onUndo: () => void;
  onRedo: () => void;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function HistoryPanel({ snapshot, onUndo, onRedo }: HistoryPanelProps) {
  const newestAppliedId = snapshot.applied[snapshot.applied.length - 1]?.id;
  return (
    <div className="history-panel">
      <div className="history-toolbar" role="toolbar" aria-label="History commands">
        <UiButton disabled={!snapshot.canUndo} onClick={onUndo}>
          UNDO
        </UiButton>
        <UiButton disabled={!snapshot.canRedo} onClick={onRedo}>
          REDO
        </UiButton>
      </div>
      <div className="history-list" role="list" aria-label="Document history">
        {[...snapshot.redo].reverse().map((entry) => (
          <div key={`redo-${entry.id}`} className="history-row is-redo" role="listitem">
            <span className="history-index">↻</span>
            <span>{entry.label}</span>
          </div>
        ))}
        {[...snapshot.applied].reverse().map((entry) => (
          <div
            key={entry.id}
            className={`history-row${entry.id === newestAppliedId ? " is-current" : ""}`}
            role="listitem"
          >
            <span className="history-index">{String(entry.id).padStart(2, "0")}</span>
            <span>{entry.label}</span>
          </div>
        ))}
        <div
          className={`history-row is-base${newestAppliedId ? "" : " is-current"}`}
          role="listitem"
        >
          <span className="history-index">00</span>
          <span>Document opened</span>
        </div>
      </div>
      <div className="history-meter">
        <span>
          {snapshot.applied.length} / {snapshot.stepLimit} STEPS
        </span>
        <span>{formatBytes(snapshot.estimatedBytes)} USED</span>
      </div>
    </div>
  );
}
