import fs from "node:fs";
import { expect, test } from "@playwright/test";

test("an imported sample can be downloaded, and Keep leaves it on the device", async ({ page }) => {
  await page.goto("/import/");
  await page.getByTestId("try-sample").click();
  await expect(page.getByRole("heading", { name: /Review bank\.synthetic\.csv/ })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /Confirm import/ }).click();
  await expect(page.getByRole("heading", { name: "Saved on this device" })).toBeVisible();

  await page.goto("/profile/");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download transactions CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^lakshly-\d{4}-\d{2}-\d{2}\.csv$/);
  const csv = fs.readFileSync(await download.path(), "utf8");
  expect(csv).toMatch(/swiggy/i);
  expect(csv).not.toMatch(/[A-Z]{5}\d{4}[A-Z]/);

  await page.getByRole("button", { name: "Delete all my data" }).click();
  await page.getByRole("button", { name: "Keep" }).click();
  await expect(page.getByRole("button", { name: "Delete everything" })).toHaveCount(0);

  await page.goto("/import/");
  await expect(page.getByText(/\d+ accounts · \d+ transactions · \d+ imports/)).toBeVisible();
  await expect(page.getByText("No imported data yet.")).toHaveCount(0);
});
