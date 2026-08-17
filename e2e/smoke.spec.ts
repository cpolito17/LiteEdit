import { expect, test } from "@playwright/test";

test("loads the local-only editor shell", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("LiteEdit // Local Image Instrument");
  await expect(page.getByRole("heading", { name: "LOCAL IMAGE WORKBENCH" })).toBeVisible();
  await expect(
    page.getByText("LOCAL PROCESSING / IMAGE DATA DOES NOT LEAVE THIS DEVICE"),
  ).toBeVisible();
});
