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
    expect(getShortcutAction(new KeyboardEvent("keydown", { key: "Enter" }))).toEqual({
      type: "commit",
    });
    expect(getShortcutAction(new KeyboardEvent("keydown", { key: "Delete" }))).toEqual({
      type: "clear-pixels",
    });
    expect(getShortcutAction(new KeyboardEvent("keydown", { key: "ArrowRight" }))).toEqual({
      type: "nudge",
      x: 1,
      y: 0,
    });
    expect(
      getShortcutAction(new KeyboardEvent("keydown", { key: "ArrowUp", shiftKey: true })),
    ).toEqual({ type: "nudge", x: 0, y: -10 });
  });

  it("does not claim browser or text-entry shortcuts", () => {
    expect(getShortcutAction(new KeyboardEvent("keydown", { key: "s", ctrlKey: true }))).toBeNull();
    expect(getShortcutAction(new KeyboardEvent("keydown", { key: "b", altKey: true }))).toBeNull();

    const button = document.createElement("button");
    const buttonEnter = new KeyboardEvent("keydown", { key: "Enter" });
    Object.defineProperty(buttonEnter, "target", { value: button });
    expect(getShortcutAction(buttonEnter)).toBeNull();

    const input = document.createElement("input");
    const inputEnter = new KeyboardEvent("keydown", { key: "Enter" });
    Object.defineProperty(inputEnter, "target", { value: input });
    expect(getShortcutAction(inputEnter)).toEqual({ type: "commit" });

    const inputArrow = new KeyboardEvent("keydown", { key: "ArrowLeft" });
    Object.defineProperty(inputArrow, "target", { value: input });
    expect(getShortcutAction(inputArrow)).toBeNull();
  });
});
