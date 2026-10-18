// Headless bill radar screenshots of the static web build (served locally). No windows are opened.
// usage: node bill-shots.mjs <baseURL> <outdir>   (run from apps/web so @playwright/test resolves)
import { chromium, webkit, devices, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [base, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const screens = [
  { name: "overview", path: "/", only: "bills-overview" },
  { name: "radar", path: "/bills/", only: "bills-page" },
  { name: "alerts", path: "/bills/", only: "bills-alerts", alertsOn: true },
  { name: "paid", path: "/bills/", only: "bills-page", markPaid: true },
  { name: "radar-hidden", path: "/bills/", only: "bills-page", privacy: true },
];
const themes = [["lakshmi", "dark"], ["monochromeGold", "light"]];
const plans = ["free", "premium"];
const forms = [
  { name: "desktop", engine: chromium, ctx: { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 } },
  { name: "mobile", engine: process.env.WOW_MOBILE_WEBKIT === "1" ? webkit : chromium, ctx: Object.fromEntries(Object.entries(devices["iPhone 15"]).filter(([name]) => name !== "defaultBrowserType")) },
];
let count = 0;
const missing = [];
for (const form of forms) {
  const browser = await form.engine.launch({ headless: true });
  for (const [theme, appearance] of themes) for (const plan of plans) for (const s of screens) {
    const context = await browser.newContext({ ...form.ctx, colorScheme: appearance });
    await context.addInitScript(([plan, theme, appearance, privacy]) => {
      try {
        localStorage.setItem("lakshly.plan", plan);
        localStorage.setItem("lakshly.themeId", theme);
        localStorage.setItem("lakshly.appearance", appearance);
        localStorage.setItem("lk-privacy", JSON.stringify({ on: privacy, startHidden: false, shake: false, hideOnBlur: false, hidePercent: false, widgetAmounts: "hidden", v: 1 }));
      } catch { /* ignore */ }
    }, [plan, theme, appearance, !!s.privacy]);
    await context.addInitScript(() => {
      class FakeNotification { static permission = "granted"; static requestPermission() { return Promise.resolve("granted"); } constructor() {} close() {} }
      window.Notification = FakeNotification;
    });
    await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
    const page = await context.newPage();
    await page.goto(base + "/", { waitUntil: "domcontentloaded" });
    const demo = page.getByRole("button", { name: "Explore with demo data" });
    await demo.first().waitFor({ timeout: 4000 }).catch(() => undefined);
    if (await demo.count()) await demo.first().click();
    await page.goto(base + s.path, { waitUntil: "domcontentloaded" });
    await page.locator("#main-content").waitFor({ timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(1200);
    // Hide fixed chrome (bottom tab bar, ribbons) so it does not cover clipped cards.
    await page.evaluate(() => {
      for (const el of document.querySelectorAll("body *")) {
        const pos = getComputedStyle(el).position;
        if ((pos === "fixed" || pos === "sticky") && !el.closest('[data-testid^="bills-"]')) el.style.visibility = "hidden";
      }
    });
    if (s.alertsOn) {
      const toggle = page.locator('[data-testid="bills-alerts"] input[type="checkbox"]').first();
      if (await toggle.count()) { await toggle.check(); await page.waitForTimeout(500); }
    }
    if (s.markPaid) {
      const btn = page.locator('[data-testid="bills-mark-paid"]').first();
      if (await btn.count()) { await btn.click(); await page.waitForTimeout(500); }
    }
    if (s.markPaid) await expect(page.getByTestId("bills-row").first()).toContainText("Paid ✓");
    if (s.privacy) await expect(page.getByTestId("bills-page")).not.toContainText(/₹\s?[\d,]/);
    if (s.alertsOn) await expect(page.getByTestId("bills-alerts").getByLabel("Bill alerts", { exact: true })).toBeChecked();
    const sel = `[data-testid="${s.only}"]`;
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
    const boxes = [];
    for (const el of await page.locator(sel).all()) {
      if (!(await el.isVisible())) continue;
      const b = await el.boundingBox();
      if (b && b.width > 0 && b.height > 0) boxes.push({ ...b, x: b.x + scroll.x, y: b.y + scroll.y });
    }
    const file = `${out}/bills-${s.name}-${plan}-${form.name}-${theme}-${appearance}.png`;
    if (!boxes.length) {
      missing.push(file);
      await page.screenshot({ path: file, fullPage: false });
    } else {
      const pad = 16;
      const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - pad);
      const y = Math.max(0, Math.min(...boxes.map((b) => b.y)) - pad);
      const r = Math.max(...boxes.map((b) => b.x + b.width)) + pad;
      const btm = Math.max(...boxes.map((b) => b.y + b.height)) + pad;
      await page.screenshot({ path: file, fullPage: true, clip: { x, y, width: r - x, height: btm - y } });
    }
    count++;
    await context.close();
  }
  await browser.close();
}
console.log(`bill radar web shots: ${count}`);
if (missing.length) throw new Error("Missing bill elements (viewport fallbacks):\n" + missing.join("\n"));
