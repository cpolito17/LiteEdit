import { expect, test } from "@playwright/test";

test("loads the local-only editor shell", async ({ page }) => {
  const response = await page.goto("/");

  expect(response).not.toBeNull();
  expect(response?.headers()["content-security-policy"]).toContain("default-src 'self'");
  await expect(page).toHaveTitle("LiteEdit // Local Image Instrument");
  await expect(page.getByText("LiteEdit", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "LOCAL IMAGE WORKBENCH" })).toBeVisible();
  await expect(
    page.getByText("LOCAL PROCESSING / IMAGE DATA DOES NOT LEAVE THIS DEVICE"),
  ).toBeVisible();
});
