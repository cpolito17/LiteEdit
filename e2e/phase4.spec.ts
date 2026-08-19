import { expect, test } from "@playwright/test";

test("manages layers, groups, and structural history", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "NEW" }).click();
  await page.getByRole("spinbutton", { name: "WIDTH" }).fill("64");
  await page.getByRole("spinbutton", { name: "HEIGHT" }).fill("64");
  await page.getByRole("button", { name: "CREATE BLANK" }).click();

  await expect(page.getByRole("treeitem", { name: /Background/ })).toBeVisible();
  await page.getByRole("button", { name: "Add paint layer" }).click();
  await expect(page.getByText("2 NODES / TOPMOST FIRST")).toBeVisible();

  await page.getByRole("button", { name: "Rename active layer" }).click();
  const renameInput = page.getByRole("textbox", { name: /Rename Paint Layer/ });
  await renameInput.fill("Ink");
  await renameInput.press("Enter");
  await expect(page.getByRole("treeitem", { name: /Ink/ })).toBeVisible();

  await page.getByRole("button", { name: "Group active layer" }).click();
  await expect(page.getByRole("treeitem", { name: /Layer Group/ })).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.getByRole("slider", { name: "GROUP OPACITY" }).fill("50");

  await page.getByRole("tab", { name: "HISTORY" }).click();
  await expect(page.getByText("Group layers")).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Document history" }).getByText("Opacity: 50%", { exact: true }),
  ).toBeVisible();
  const historyCommands = page.getByRole("toolbar", { name: "History commands" });
  await historyCommands.getByRole("button", { name: "UNDO" }).click();
  await expect(page.locator(".history-row.is-redo", { hasText: "Opacity: 50%" })).toBeVisible();
  await historyCommands.getByRole("button", { name: "REDO" }).click();
  await expect(page.getByText("BUILD / PHASE 4")).toBeVisible();
});
