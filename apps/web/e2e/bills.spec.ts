import { expect, test } from "@playwright/test";

async function demo(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with demo data" }).click();
  await expect(page.getByRole("heading", { name: "Overview", exact: true })).toBeVisible();
}

test("bill radar links from Overview, groups bills, supports paid undo and privacy", async ({ page }) => {
  await demo(page);
  await page.getByTestId("bills-overview").getByRole("link", { name: "Open bill radar" }).click();
  await expect(page.getByTestId("bills-page")).toBeVisible();
  await expect(page.getByTestId("bills-summary")).toContainText("due this week");
  const row = page.getByTestId("bills-row").first();
  await expect(row).toBeVisible();
  await row.getByTestId("bills-mark-paid").click();
  await expect(row).toContainText("Paid ✓");
  await expect(row.getByTestId("bills-mark-paid")).toHaveText("Undo");
  await row.getByTestId("bills-mark-paid").click();
  await expect(row).not.toContainText("Paid ✓");
  await row.getByTestId("bills-mute").click();
  await expect(row.getByTestId("bills-mute")).toContainText("Alerts off");
  await row.getByTestId("bills-mute").click();
  await page.getByRole("tab", { name: "7 days before" }).click();
  await expect(page.getByRole("tab", { name: "7 days before" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Hide amounts" }).first().click();
  await expect(page.getByTestId("bills-page")).not.toContainText(/₹\s?[\d,]/);
  await expect(page.getByTestId("bills-ics")).toBeVisible();
});

test("bill alerts requests permission and keeps amounts off by default", async ({ page }) => {
  await page.addInitScript(() => {
    class DemoNotification {
      static permission = "granted";
      static async requestPermission() { return "granted"; }
    }
    Object.defineProperty(window, "Notification", { value: DemoNotification, configurable: true });
  });
  await demo(page);
  await page.goto("/bills/");
  const alerts = page.getByTestId("bills-alerts");
  await expect(alerts.getByLabel("Show amounts in alerts")).not.toBeChecked();
  await alerts.getByLabel("Bill alerts", { exact: true }).check();
  await expect(alerts.getByLabel("Bill alerts", { exact: true })).toBeChecked();
  await alerts.getByLabel("Bill alerts", { exact: true }).uncheck();
});

test("blocked browser permission leaves the radar available", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "Notification", { value: class { static permission = "denied"; static async requestPermission() { return "denied"; } }, configurable: true });
  });
  await demo(page);
  await page.goto("/bills/");
  await page.getByTestId("bills-alerts").getByLabel("Bill alerts", { exact: true }).click();
  await expect(page.getByTestId("bills-alerts")).toContainText("Your browser blocked notifications.");
  await expect(page.getByTestId("bills-row").first()).toBeVisible();
});
