import { expect, test, type Page } from "@playwright/test";

// Synthetic CSV only. The repo ignores *.csv so real statements cannot be committed, and a
// statement PDF would pull in the pdf.js worker. This small export stays in the spec.
const syntheticCsv = [
  "Date,Description,Debit,Credit,Balance",
  "01/09/2026,\"NEFT CR-DEMO EMPLOYER, SALARY\",,\"1,25,000.00\",\"1,85,000.00\"",
  "03/09/2026,UPI-SWIGGY-swiggy@demo-Food,450.00,,\"1,84,550.00\"",
  "05/09/2026,POS DEMO BIGBASKET,\"2,345.50\",,\"1,82,204.50\"",
].join("\n");

async function skipWizard(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Finish later" })).toBeVisible();
  await page.getByRole("button", { name: "Finish later" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
}

test("wizard can be skipped onto the synthetic overview", async ({ page }) => {
  await skipWizard(page);
  const open = page.locator("#main-content");
  await expect(open.getByText("Synthetic demo data · as of")).toBeVisible();
  await expect(open).not.toContainText("NaN");
  await expect(open).not.toContainText("undefined");
});

test("a synthetic CSV imports and the overview shows that data", async ({ page }) => {
  await skipWizard(page);
  await page.goto("/import/");
  await expect(page.getByRole("heading", { name: "Import" })).toBeVisible();
  await expect(page.getByText("No imported data yet.")).toBeVisible();

  await page.getByTestId("file-input").setInputFiles({
    name: "synthetic-bank.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(syntheticCsv),
  });
  await expect(page.getByRole("heading", { name: "Review synthetic-bank.csv" })).toBeVisible();
  const open = page.locator("#main-content");
  await expect(open.getByText("Swiggy", { exact: true })).toBeVisible();
  await expect(open.getByText("Demo Bigbasket", { exact: true })).toBeVisible();
  await expect(open).toContainText("₹1,25,000");
  await expect(open).not.toContainText("NaN");

  await page.getByRole("button", { name: "Confirm import (3 transactions)" }).click();
  await expect(page.getByText("Imported 3 new transactions, 1 account")).toBeVisible();
  await expect(page.getByText("1 accounts · 3 transactions · 1 imports")).toBeVisible();

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  const overview = page.locator("#main-content");
  await expect(overview.getByText("Your data · as of")).toBeVisible();
  await expect(overview.getByText("Bank Savings")).toBeVisible();
  await expect(overview).not.toContainText("NaN");
  await expect(overview).not.toContainText("Synthetic demo data · as of");
});

test("a CSV without statement columns shows a clear error", async ({ page }) => {
  await page.goto("/import/");
  await expect(page.getByRole("heading", { name: "Import" })).toBeVisible();
  await page.getByTestId("file-input").setInputFiles({
    name: "notes.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Note,Value\nhello,1\n"),
  });
  await expect(page.locator("#main-content").getByRole("alert")).toHaveText(
    "Couldn't find Date / Description / Amount columns in this CSV.",
  );
});
