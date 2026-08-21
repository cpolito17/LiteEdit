import { tools, type ToolId } from "./tool-model";

export type ShortcutAction =
  | { type: "tool"; tool: ToolId }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "clear-selection" }
  | { type: "transform" }
  | { type: "commit" }
  | { type: "nudge"; x: number; y: number }
  | { type: "clear-pixels" }
  | { type: "cancel" };

const toolByShortcut = new Map(tools.map((tool) => [tool.shortcut.toLowerCase(), tool.id]));

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.tagName === "BUTTON"
  );
}

function shouldCommitFromTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return true;
  }
  return (
    !target.isContentEditable &&
    target.tagName !== "BUTTON" &&
    target.tagName !== "TEXTAREA" &&
    target.tagName !== "SELECT"
  );
}

export function getShortcutAction(event: KeyboardEvent): ShortcutAction | null {
  if (event.altKey) {
    return null;
  }

  const key = event.key.toLowerCase();
  const modifier = event.ctrlKey || event.metaKey;

  if (key === "escape") {
    return { type: "cancel" };
  }
  if (key === "enter") {
    return shouldCommitFromTarget(event.target) ? { type: "commit" } : null;
  }

  if (isEditableTarget(event.target)) {
    return null;
  }

  if (modifier) {
    if (key === "z" && event.shiftKey) {
      return { type: "redo" };
    }
    if (key === "z") {
      return { type: "undo" };
    }
    if (key === "d") {
      return { type: "clear-selection" };
    }
    if (key === "t") {
      return { type: "transform" };
    }
    return null;
  }

  if (key === "delete" || key === "backspace") {
    return { type: "clear-pixels" };
  }

  const distance = event.shiftKey ? 10 : 1;
  if (key === "arrowleft") {
    return { type: "nudge", x: -distance, y: 0 };
  }
  if (key === "arrowright") {
    return { type: "nudge", x: distance, y: 0 };
  }
  if (key === "arrowup") {
    return { type: "nudge", x: 0, y: -distance };
  }
  if (key === "arrowdown") {
    return { type: "nudge", x: 0, y: distance };
  }

  const tool = toolByShortcut.get(key);
  return tool ? { type: "tool", tool } : null;
}
