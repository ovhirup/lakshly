import { expect, test } from "@playwright/test";

test("a sample import lists the food row on Spend, then Demo data hides that account", async ({ page }) => {
  await page.goto("/import/");
  await page.getByTestId("try-sample").click();
  await expect(page.getByRole("heading", { name: /Review bank\.synthetic\.csv/ })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /Confirm import/ }).click();
  await expect(page.getByRole("heading", { name: "Saved on this device" })).toBeVisible();

  await page.goto("/spend/");
  await expect(page.getByRole("heading", { name: "Spend" })).toBeVisible();
  const food = page.locator("#transaction-list .transaction-row").filter({ hasText: "Swiggy" });
  await expect(food).toBeVisible();
  await expect(food).toContainText("Dining");

  await page.goto("/import/");
  const demo = page.getByRole("button", { name: "Demo data", exact: true });
  await demo.click();
  await expect(demo).toHaveAttribute("aria-pressed", "true");

  await page.goto("/");
  const overview = page.locator("#main-content");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(overview.getByText("Synthetic demo data · as of")).toBeVisible();
  await expect(overview.getByText("Everyday Savings")).toBeVisible();
  await expect(overview.getByText("Bank Savings")).toHaveCount(0);
});
