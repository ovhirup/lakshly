import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";

const statement = path.join(os.tmpdir(), "lakshly-bank.synthetic.csv");
fs.writeFileSync(
  statement,
  [
    "Date,Description,Debit,Credit,Balance",
    '01/09/2026,"NEFT CR-DEMO EMPLOYER, SALARY",,"1,25,000.00","1,85,000.00"',
    '03/09/2026,UPI-SWIGGY-swiggy@demo-123456789012-Food,450.00,,"1,84,550.00"',
    '05/09/2026,POS DEMO BIGBASKET,"2,345.50",,"1,82,204.50"',
    "",
  ].join("\n"),
);

test("a sample statement can be reviewed without a bank file", async ({ page }) => {
  await page.goto("/import/");
  await page.getByTestId("try-sample").click();
  await expect(page.getByRole("heading", { name: /Review bank\.synthetic\.csv/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Swiggy").first()).toBeVisible();
  await page.getByRole("button", { name: /Confirm import/ }).click();
  await expect(page.getByRole("heading", { name: "Saved on this device" })).toBeVisible();
  await page.getByRole("link", { name: "See Overview" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.locator("#main-content").getByText("Your data · as of")).toBeVisible();
});

test("profile can delete an imported sample", async ({ page }) => {
  await page.goto("/import/");
  await page.getByTestId("try-sample").click();
  await expect(page.getByRole("heading", { name: /Review bank\.synthetic\.csv/ })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /Confirm import/ }).click();
  await page.goto("/profile/");
  await page.getByRole("button", { name: "Delete all my data" }).click();
  await page.getByRole("button", { name: "Delete everything" }).click();
  await expect(page.getByText("All your data was deleted from this device.")).toBeVisible();
  await page.goto("/import/");
  await expect(page.getByText("No imported data yet.")).toBeVisible();
});

test("a synthetic bank CSV imports and shows on Overview", async ({ page }) => {
  await page.goto("/import/");
  await expect(page.getByRole("heading", { name: "Import" })).toBeVisible();
  await page.getByTestId("file-input").setInputFiles(statement);

  await expect(page.getByRole("heading", { name: /Review lakshly-bank\.synthetic\.csv/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("Swiggy").first()).toBeVisible();
  await page.getByRole("button", { name: /Confirm import/ }).click();
  await expect(page.getByText(/Imported .+ Thank you for trusting Lakshly/)).toBeVisible();

  await page.goto("/");
  const open = page.locator("#main-content");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(open.getByText("Your data · as of")).toBeVisible();
  await expect(open).not.toContainText("NaN");
  await expect(open).not.toContainText("undefined");
  expect(await open.innerText()).not.toMatch(/[A-Z]{5}\d{4}[A-Z]/);

  await page.goto("/spend/");
  await expect(page.getByRole("heading", { name: "Spend" })).toBeVisible();
  await expect(page.getByText("Swiggy").first()).toBeVisible();

  await page.goto("/");
  await page.getByRole("button", { name: "Hide amounts" }).first().click();
  await expect(page.getByRole("button", { name: "Show amounts" }).first()).toBeVisible();
  await expect(open).not.toContainText(/₹\s?[\d,]/);
});
