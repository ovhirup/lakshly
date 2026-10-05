import { expect, test } from "@playwright/test";

test("a free theme stays selected after a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with demo data" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();

  await page.getByRole("button", { name: "Theme and appearance" }).click();
  const graphite = page.getByRole("button", { name: /^Graphite\./ });
  await graphite.click();
  await expect(graphite).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "graphite");

  await page.reload();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "graphite");
});
