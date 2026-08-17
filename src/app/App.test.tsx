import { render, screen } from "@testing-library/react";
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
  });
});
