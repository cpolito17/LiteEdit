import { describe, expect, it } from "vitest";

import { getShortcutAction } from "./shortcuts";

describe("editor keyboard shortcuts", () => {
  it("maps tool keys and cancellation", () => {
    expect(getShortcutAction(new KeyboardEvent("keydown", { key: "b" }))).toEqual({
      type: "tool",
      tool: "brush",
    });
    expect(getShortcutAction(new KeyboardEvent("keydown", { key: "h" }))).toEqual({
      type: "tool",
      tool: "hand",
    });
    expect(getShortcutAction(new KeyboardEvent("keydown", { key: "Escape" }))).toEqual({
      type: "cancel",
    });
  });

  it("maps command shortcuts for history and selection", () => {
    expect(getShortcutAction(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }))).toEqual({
      type: "undo",
    });
    expect(
      getShortcutAction(new KeyboardEvent("keydown", { key: "z", metaKey: true, shiftKey: true })),
    ).toEqual({ type: "redo" });
    expect(getShortcutAction(new KeyboardEvent("keydown", { key: "d", ctrlKey: true }))).toEqual({
      type: "clear-selection",
    });
    expect(getShortcutAction(new KeyboardEvent("keydown", { key: "t", ctrlKey: true }))).toEqual({
      type: "transform",
    });
  });

  it("does not claim browser or text-entry shortcuts", () => {
    expect(getShortcutAction(new KeyboardEvent("keydown", { key: "s", ctrlKey: true }))).toBeNull();
    expect(getShortcutAction(new KeyboardEvent("keydown", { key: "b", altKey: true }))).toBeNull();
  });
});
