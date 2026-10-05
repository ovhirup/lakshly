import { expect, test } from "@playwright/test";

test("setup can be skipped through to an empty Overview", async ({ page }) => {
  await page.goto("/setup/");
  await expect(page.getByRole("heading", { name: /Welcome to Lakshly/ })).toBeVisible();

  const name = page.getByTestId("welcome-name");
  await name.fill("A".repeat(50));
  await expect(name).toHaveValue("A".repeat(40));
  await name.fill("");

  await page.getByRole("button", { name: "Graphite", exact: true }).click();
  await expect(page.getByRole("button", { name: "Graphite", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: /Set up with my data/ }).first().click();
  await expect(page.getByRole("heading", { name: "Where do your statements arrive?" })).toBeVisible();
  await page.getByRole("button", { name: "Skip", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Which banks, cards and investments do you use?" })).toBeVisible();
  await page.getByRole("searchbox", { name: "Search banks, cards and apps" }).fill("HDFC Bank");
  await page.getByRole("button", { name: "HDFC Bank", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Bring in your statements" })).toBeVisible();
  await page.getByRole("button", { name: "Skip", exact: true }).click();

  await expect(page.getByRole("heading", { name: "A plan that fits" })).toBeVisible();
  await page.getByRole("button", { name: "Skip", exact: true }).click();

  await expect(page.getByRole("heading", { name: /Nearly there|All the essentials are done/ })).toBeVisible();
  await page.getByRole("link", { name: "Go to Overview" }).click();

  const open = page.locator("#main-content");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(open.getByRole("heading", { name: "Nothing here yet" })).toBeVisible();
  await expect(open).not.toContainText("NaN");
  await expect(open).not.toContainText("undefined");
  await expect(open).not.toContainText("Abhirup");
  expect(await open.innerText()).not.toMatch(/[A-Z]{5}\d{4}[A-Z]/);
});
