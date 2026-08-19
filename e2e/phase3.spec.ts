import { expect, test } from "@playwright/test";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test("opens and exports a local PNG without an image request", async ({ page }) => {
  const remoteImageRequests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "image" && !request.url().startsWith("data:")) {
      remoteImageRequests.push(request.url());
    }
  });

  await page.goto("/");
  await page.getByLabel("Choose a local image").setInputFiles({
    name: "pixel.png",
    mimeType: "image/png",
    buffer: onePixelPng,
  });

  await expect(page.getByTestId("document-viewport")).toBeVisible();
  await expect(page.getByText("DOCUMENT / PIXEL")).toBeVisible();
  await expect(page.getByText("SIZE / 1 × 1 PX")).toBeVisible();
  await expect(page.getByRole("button", { name: "EXPORT" })).toBeEnabled();
  await expect(page.getByText("BUILD / PHASE 4")).toBeVisible();
  expect(remoteImageRequests).toEqual([]);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "EXPORT" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("pixel-edited.png");
});
