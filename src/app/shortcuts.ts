import { tools, type ToolId } from "./tool-model";

export type ShortcutAction =
  | { type: "tool"; tool: ToolId }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "clear-selection" }
  | { type: "transform" }
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
    target.tagName === "SELECT"
  );
}

export function getShortcutAction(event: KeyboardEvent): ShortcutAction | null {
  if (isEditableTarget(event.target) || event.altKey) {
    return null;
  }

  const key = event.key.toLowerCase();
  const modifier = event.ctrlKey || event.metaKey;

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

  if (key === "escape") {
    return { type: "cancel" };
  }

  const tool = toolByShortcut.get(key);
  return tool ? { type: "tool", tool } : null;
}
