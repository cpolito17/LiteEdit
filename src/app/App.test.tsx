import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("LiteEdit bootstrap shell", () => {
  it("shows the local-only empty state and accessible tool rail", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "LOCAL IMAGE WORKBENCH" })).toBeVisible();
    expect(
      screen.getByText("LOCAL PROCESSING / IMAGE DATA DOES NOT LEAVE THIS DEVICE"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /BRUSH tool/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: /MOVE tool/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const moveButton = screen.getByRole("button", { name: /MOVE tool/i });
    const tooltipId = moveButton.getAttribute("aria-describedby");
    expect(tooltipId).toBeTruthy();
    expect(document.getElementById(tooltipId ?? "")).toHaveAttribute("role", "tooltip");
    expect(screen.getByRole("group", { name: "LiteEdit" })).toBeVisible();
  });

  it("opens the new-document dialog and exposes property controls", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "NEW" }));
    expect(screen.getByRole("dialog", { name: "NEW DOCUMENT" })).toBeVisible();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "NEW DOCUMENT" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "PROPERTIES" }));
    expect(screen.getByRole("spinbutton", { name: "ROTATION" })).toHaveValue(0);
    expect(screen.getByRole("slider", { name: "ZOOM" })).toHaveValue("100");
  });
});
