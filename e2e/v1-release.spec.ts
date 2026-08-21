import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function createDocument(page: Page, width = 80, height = 60) {
  await page.goto("/");
  const recovery = page.getByRole("dialog", { name: "RESTORE LOCAL RECOVERY?" });
  if (await recovery.isVisible().catch(() => false)) {
    await recovery.getByRole("button", { name: "DISCARD" }).click();
  }
  await page.getByRole("button", { name: "NEW" }).click();
  await page.getByRole("spinbutton", { name: "WIDTH" }).fill(String(width));
  await page.getByRole("spinbutton", { name: "HEIGHT" }).fill(String(height));
  await page.getByRole("button", { name: "CREATE BLANK" }).click();
  await page.getByRole("button", { name: "Fit document" }).click();
}

test("paints one dirty-tile history transaction and creates a vector shape", async ({ page }) => {
  await createDocument(page);
  await page.getByRole("button", { name: /BRUSH tool/ }).click();
  await expect(page.getByRole("spinbutton", { name: "DIAMETER" })).toBeVisible();
  await page.getByRole("spinbutton", { name: "DIAMETER" }).fill("8");

  const viewport = page.getByTestId("document-viewport");
  const bounds = await viewport.boundingBox();
  if (!bounds) throw new Error("Expected a document viewport.");
  await page.mouse.move(bounds.x + bounds.width / 2 - 20, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 20, bounds.y + bounds.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await expect(page.getByText("HISTORY / 1")).toBeVisible();

  await page.getByRole("button", { name: /SHAPE tool/ }).click();
  await page.getByRole("combobox", { name: "SHAPE" }).selectOption("star");
  await page.mouse.move(bounds.x + bounds.width / 2 - 15, bounds.y + bounds.height / 2 - 15);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 15, bounds.y + bounds.height / 2 + 15);
  await page.mouse.up();
  await page.getByRole("tab", { name: "LAYERS" }).click();
  await expect(page.getByRole("treeitem", { name: /star Shape/ })).toBeVisible();
  await expect(page.getByText("HISTORY / 2")).toBeVisible();
});

test("selects, crops, resizes, exports JPEG, and restores local recovery", async ({ page }) => {
  await createDocument(page, 80, 60);
  await page.getByRole("button", { name: /MARQUEE tool/ }).click();
  const viewport = page.getByTestId("document-viewport");
  const bounds = await viewport.boundingBox();
  if (!bounds) throw new Error("Expected a document viewport.");
  await page.mouse.move(bounds.x + bounds.width / 2 - 30, bounds.y + bounds.height / 2 - 20);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 30, bounds.y + bounds.height / 2 + 20);
  await page.mouse.up();
  await expect(page.getByText(/SELECT \/ \d+ × \d+ \/ REPLACE/)).toBeVisible();

  await page.getByRole("button", { name: /CROP tool/ }).click();
  await page.getByRole("button", { name: "16:9" }).click();
  await page.getByRole("button", { name: "COMMIT" }).click();
  await expect(page.getByText("SIZE / 80 × 45 PX")).toBeVisible();

  await page.getByRole("button", { name: "RESIZE" }).click();
  await page.getByRole("checkbox", { name: "LINK ASPECT" }).uncheck();
  await page.getByRole("spinbutton", { name: "WIDTH" }).fill("40");
  await page.getByRole("spinbutton", { name: "HEIGHT" }).fill("30");
  await page.getByRole("button", { name: "RESIZE", exact: true }).last().click();
  await expect(page.getByText("SIZE / 40 × 30 PX")).toBeVisible();

  await page.getByRole("button", { name: "EXPORT" }).click();
  await page.getByRole("combobox", { name: "FORMAT" }).selectOption("jpeg");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "EXPORT FILE" }).click();
  await expect((await download).suggestedFilename()).toBe("Untitled-edited.jpg");

  await page.waitForTimeout(900);
  await page.reload();
  await expect(page.getByRole("dialog", { name: "RESTORE LOCAL RECOVERY?" })).toBeVisible();
  await page.getByRole("button", { name: "RESTORE" }).click();
  await expect(page.getByText("SIZE / 40 × 30 PX")).toBeVisible();
});
