import { expect, test } from "@playwright/test";

async function openDemo(page: import("@playwright/test").Page, plan?: "premium") {
  if (plan) await page.addInitScript(() => localStorage.setItem("lakshly.plan", "premium"));
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with demo data" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
}

test("free: freedom date, story and subscription audit work; Premium parts stay locked", async ({ page }) => {
  await openDemo(page);
  await expect(page.getByTestId("wow-freedomDate-overview")).toContainText("Debt-free by");
  await page.goto("/debt/");
  await expect(page.getByTestId("wow-freedomDate-card")).toContainText("days to go");
  await expect(page.getByTestId("wow-freedomWhatIf-card")).toContainText("Payments aren’t live yet.");
  await page.goto("/story/");
  await expect(page.getByTestId("wow-story-pager")).toBeVisible();
  await expect(page.getByRole("button", { name: /\(Premium\)$/ }).first()).toBeDisabled();
  await expect(page.getByTestId("wow-storyShare-card")).toContainText("Share your story");
  await page.goto("/spend/");
  await expect(page.getByText("Subscription audit")).toBeVisible();
  const auditRows = await page.locator(".wow-audit-row").count();
  await expect(page.getByTestId("wow-subscription-audit-headline")).toContainText(`on ${auditRows} subscription`);
  await page.goto("/budget/");
  await expect(page.getByTestId("wow-feeRunway-card")).toContainText("Yearly fees, sorted.");
});

test("premium: what-if slider, past months, share image and fee runway; amounts hide in privacy mode", async ({ page }) => {
  await openDemo(page, "premium");
  await page.goto("/budget/");
  await expect(page.getByTestId("wow-feeRunway-headline")).toContainText("Set aside");
  await page.goto("/story/");
  await expect(page.getByRole("button", { name: "Download image" })).toBeVisible();
  await page.goto("/debt/");
  await expect(page.getByTestId("wow-freedomWhatIf-card")).toContainText("Roll cleared EMIs into the next loan");
  await page.getByRole("button", { name: "Hide amounts" }).first().click();
  await expect(page.getByTestId("wow-freedomWhatIf-card")).not.toContainText(/₹\s?[\d,]/);
});
