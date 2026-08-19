import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  createBlankDocument,
  insertRasterLayer,
  wrapLayerInGroup,
} from "../../editor/document-model";
import { LayersPanel } from "./LayersPanel";

describe("LayersPanel", () => {
  it("shows topmost-first hierarchy and exposes accessible structural commands", () => {
    let model = createBlankDocument({ width: 32, height: 32, background: "transparent" });
    const paint = insertRasterLayer(model, { name: "Paint" });
    model = wrapLayerInGroup(paint.document, paint.layer.id, "Subject");

    const onActivate = vi.fn();
    const onRename = vi.fn();
    const onToggleVisibility = vi.fn();
    const onOpacityChange = vi.fn();
    render(
      <LayersPanel
        model={model}
        onActivate={onActivate}
        onAddRaster={vi.fn()}
        onAddGroup={vi.fn()}
        onDuplicate={vi.fn()}
        onDelete={vi.fn()}
        onGroup={vi.fn()}
        onUngroup={vi.fn()}
        onRename={onRename}
        onToggleVisibility={onToggleVisibility}
        onToggleLock={vi.fn()}
        onOpacityChange={onOpacityChange}
        onMoveWithinParent={vi.fn()}
        onMove={vi.fn()}
        onOutdent={vi.fn()}
      />,
    );

    const rows = screen.getAllByRole("treeitem");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Subject");
    expect(rows[1]).toHaveTextContent("Paint");
    expect(rows[2]).toHaveTextContent("Background");
    expect(rows[0]).toHaveAttribute("aria-level", "1");
    expect(rows[1]).toHaveAttribute("aria-level", "2");

    fireEvent.click(screen.getByRole("button", { name: "Hide Subject" }));
    expect(onToggleVisibility).toHaveBeenCalledWith(model.activeLayerId, false);

    fireEvent.click(screen.getByRole("button", { name: "Rename active layer" }));
    const nameInput = screen.getByRole("textbox", { name: "Rename Subject" });
    fireEvent.change(nameInput, { target: { value: "Foreground" } });
    fireEvent.keyDown(nameInput, { key: "Enter" });
    expect(onRename).toHaveBeenCalledWith(model.activeLayerId, "Foreground");

    fireEvent.change(screen.getByRole("slider", { name: "GROUP OPACITY" }), {
      target: { value: "55" },
    });
    expect(onOpacityChange).toHaveBeenCalledWith(model.activeLayerId, 0.55);

    fireEvent.click(screen.getByRole("button", { name: "Collapse Subject" }));
    expect(screen.queryByText("Paint")).not.toBeInTheDocument();
  });
});
