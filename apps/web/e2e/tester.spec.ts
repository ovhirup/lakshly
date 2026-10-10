import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const require = createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../packages/parsers/package.json"));
const { PDFDocument } = require("@cantoo/pdf-lib") as {
  PDFDocument: {
    create: () => Promise<{
      addPage: () => void;
      setTitle: (title: string) => void;
      encrypt: (options: { userPassword: string; ownerPassword: string }) => void;
      save: () => Promise<Uint8Array>;
    }>;
  };
};

const secret = "NOT-THE-PASSWORD";

async function lockedPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage();
  doc.setTitle("Synthetic locked statement");
  doc.encrypt({ userPassword: "DEMO1234", ownerPassword: "DEMO1234-owner" });
  return Buffer.from(await doc.save());
}

test("a file that is not a statement shows a clear error", async ({ page }) => {
  await page.goto("/import/");
  await page.getByTestId("file-input").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello\n"),
  });
  await expect(page.locator("#main-content").getByRole("alert")).toHaveText(
    "Please choose a PDF statement, a CAS PDF, or a CSV export. (XLS/XLSX: save as CSV first.)",
  );
});

test("a locked sample PDF asks for a password and does not keep it", async ({ page }) => {
  await page.goto("/import/");
  await page.getByTestId("file-input").setInputFiles({
    name: "locked.synthetic.pdf",
    mimeType: "application/pdf",
    buffer: await lockedPdf(),
  });
  await expect(page.getByRole("heading", { name: /is password-protected/ })).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Statement password").fill(secret);
  await page.getByRole("button", { name: "Unlock on this device" }).click();
  await expect(page.getByText("That password didn't work. Try again.")).toBeVisible();
  await expect(page.getByLabel("Statement password")).toHaveValue("");
  const stored = await page.evaluate(() => JSON.stringify(localStorage));
  expect(stored).not.toContain(secret);
  expect(stored).not.toContain("DEMO1234");
  await expect(page.locator("body")).not.toContainText(secret);
});

test("the public site stays Free and a Premium theme stays locked", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore with demo data" }).click();
  expect(await page.getByTestId("id-chip-compact").textContent()).toContain("Free Version");
  await expect(page.getByRole("group", { name: "Demo plan" })).toHaveCount(0);

  await page.getByRole("button", { name: "Theme and appearance" }).click();
  await page.getByRole("button", { name: /^Ocean\./ }).click();
  const offer = page.getByRole("dialog", { name: /Lakshly Premium/ });
  await expect(offer).toBeVisible();
  await expect(offer.getByRole("button", { name: "Preview Premium (demo)" })).toHaveCount(0);
  await offer.getByRole("button", { name: "Not now" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "lakshmi");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "lakshmi");
  expect(await page.getByTestId("id-chip-compact").textContent()).toContain("Free Version");
});
