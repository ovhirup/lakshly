import { expect, test } from "@playwright/test";

test("demo overview loads and amounts can be hidden", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with demo data" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  const open = page.locator("#main-content");
  await expect(open.getByText("Synthetic demo data · as of")).toBeVisible();
  await expect(open).not.toContainText("NaN");
  await expect(open).not.toContainText("undefined");
  expect(await open.innerText()).not.toMatch(/[A-Z]{5}\d{4}[A-Z]/);

  await page.getByRole("button", { name: "Hide amounts" }).first().click();
  await expect(page.getByRole("button", { name: "Show amounts" }).first()).toBeVisible();
  await expect(open).not.toContainText(/₹\s?[\d,]/);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show amounts" }).first()).toBeVisible();
  await expect(open).not.toContainText(/₹\s?[\d,]/);
});
