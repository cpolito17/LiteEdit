import { expect, test } from "@playwright/test";

test("moves, commits or cancels transforms, and round-trips a raster warp", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "NEW" }).click();
  await page.getByRole("spinbutton", { name: "WIDTH" }).fill("64");
  await page.getByRole("spinbutton", { name: "HEIGHT" }).fill("64");
  await page.getByRole("combobox", { name: "BACKGROUND" }).selectOption("white");
  await page.getByRole("button", { name: "CREATE BLANK" }).click();

  const interactionCanvas = page.locator("canvas.upper-canvas");
  await expect(interactionCanvas).toBeVisible();
  await page.getByRole("button", { name: "Fit document" }).click();
  const canvasBounds = await interactionCanvas.boundingBox();
  if (!canvasBounds) throw new Error("Expected an interactive canvas.");
  const center = {
    x: canvasBounds.x + canvasBounds.width / 2,
    y: canvasBounds.y + canvasBounds.height / 2,
  };
  await page.mouse.move(center.x, center.y);
  await expect(page.getByText("POINTER / X 0032 / Y 0032", { exact: true })).toBeVisible();
  await page.mouse.click(center.x, center.y);
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  await page.mouse.move(center.x + 24, center.y + 12, { steps: 4 });
  await page.mouse.up();

  await page.getByRole("tab", { name: "HISTORY" }).click();
  const history = page.getByRole("list", { name: "Document history" });
  await expect(history.getByText("Move: Background", { exact: true })).toBeVisible();
  await expect(history.locator(".history-row:not(.is-base):not(.is-redo)")).toHaveCount(1);

  await page.getByRole("tab", { name: "PROPERTIES" }).click();
  const rotation = page.getByRole("spinbutton", { name: "ROTATION" });
  await page.getByRole("button", { name: "TRANSFORM" }).click();
  await rotation.fill("31");
  await expect(rotation).toHaveValue("31");
  await rotation.press("Escape");
  await expect(rotation).toHaveValue("0");
  await expect(page.getByText("HISTORY / 1")).toBeVisible();

  await page.getByRole("button", { name: "TRANSFORM" }).click();
  await rotation.fill("31");
  await rotation.press("Enter");
  await expect(rotation).toHaveValue("31");
  await expect(page.getByText("HISTORY / 2")).toBeVisible();

  await page.getByRole("button", { name: "WARP 3 × 3" }).click();
  const centerNode = page.getByRole("slider", { name: "Warp node 5" });
  await expect(centerNode).toBeVisible();
  await centerNode.press("Shift+ArrowRight");
  await centerNode.press("Escape");
  await expect(centerNode).not.toBeVisible();
  await expect(page.getByText("HISTORY / 2")).toBeVisible();

  await page.getByRole("button", { name: "WARP 3 × 3" }).click();
  await page.getByRole("slider", { name: "Warp node 5" }).press("ArrowRight");
  await page.getByRole("button", { name: "COMMIT" }).click();
  await expect(page.getByText("HISTORY / 3")).toBeVisible();

  await page.getByRole("tab", { name: "HISTORY" }).click();
  await expect(history.getByText("Transform: Background", { exact: true })).toBeVisible();
  await expect(history.getByText("Warp: Background", { exact: true })).toBeVisible();
  await page
    .getByRole("toolbar", { name: "History commands" })
    .getByRole("button", { name: "UNDO" })
    .click();
  await expect(page.locator(".history-row.is-redo", { hasText: "Warp: Background" })).toBeVisible();
  await page
    .getByRole("toolbar", { name: "History commands" })
    .getByRole("button", { name: "REDO" })
    .click();
  await expect(page.getByText("BUILD / PHASE 5")).toBeVisible();
});
