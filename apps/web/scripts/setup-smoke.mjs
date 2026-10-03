// Headless only. Pass the path to an already installed Playwright module; no dependencies installed.
// SYNTHETIC input only. Optional --shots tests the explicitly enabled preview build.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
const { chromium } = await import(pathToFileURL(process.argv[2]).href);
const base = process.env.LAKSHLY_SMOKE_URL || "http://127.0.0.1:4173";
const shots = process.argv.includes("--shots");
const browser = await chromium.launch({ headless: true });
let scenarios = 0;
const errors = [], external = [];
async function context(viewport) {
  const ctx = await browser.newContext({ viewport, reducedMotion: "reduce" });
  await ctx.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.protocol === "http:" || url.protocol === "https:") {
      if (url.origin !== new URL(base).origin) { external.push(url.origin); return route.abort(); }
    }
    return route.continue();
  });
  ctx.on("page", page => {
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
  });
  return ctx;
}
async function vault(page) {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => { const r = indexedDB.open("lakshly-vault", 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const get = key => new Promise((resolve, reject) => { const r = db.transaction("kv").objectStore("kv").get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const [key, record] = await Promise.all([get("key"), get("vault")]); db.close();
    if (!record) return null;
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: record.iv }, key, record.ct);
    const data = JSON.parse(new TextDecoder().decode(plain));
    return { version: data.version, encrypted: record.alg === "AES-GCM-256", setup: data.setup,
      goals: data.goals ?? [], budgets: data.dataset.budgets ?? [], imports: data.imports };
  });
}
async function noOverflow(page) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Horizontal overflow");
  assert.equal(await page.locator("h1").count(), 1);
}
try {
  if (shots) {
    const themes = ["lakshmi", "monochromeGold", "graphite", "ocean", "forest", "roseQuartz"];
    const steps = ["welcome", "email", "accounts", "import", "plan", "done"];
    await mkdir("/tmp/lakshly-r3-shots", { recursive: true });
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const ctx = await context(viewport), page = await ctx.newPage();
      for (const theme of themes) for (const appearance of ["light", "dark"]) for (const step of steps) {
        await page.goto(`${base}/setup/?step=${step}&setupDemo=midway&theme=${theme}&appearance=${appearance}`);
        await page.getByText(`Step ${steps.indexOf(step) + 1} of 6,`, { exact: false }).first().waitFor();
        await noOverflow(page);
        assert.equal(await page.evaluate(() => localStorage.getItem("lk-setup-flags")), null, "Shots state persisted");
        assert.equal(await page.evaluate(() => localStorage.getItem("lakshly.source")), null, "Shots mode persisted");
        if (theme === "lakshmi" && appearance === "light") await page.screenshot({ path: `/tmp/lakshly-r3-shots/${viewport.width}-${step}.png`, fullPage: true });
        scenarios++;
      }
      await ctx.close();
    }
  } else {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const ctx = await context(viewport), page = await ctx.newPage();
      await page.goto(`${base}/setup/`);
      await page.getByRole("button", { name: "Set up with my data", exact: true }).waitFor();
      await noOverflow(page);
      await page.getByLabel("What should we call you?", { exact: false }).fill("SYNTHETIC Demo");
      await page.getByRole("button", { name: "Set up with my data", exact: true }).click();
      await page.getByLabel("Which email do", { exact: false }).fill("demo.user@example.org");
      await page.locator("label.field", { hasText: /^Provider/ }).locator("select").selectOption("google");
      await page.getByRole("button", { name: "Connect Gmail (read-only)", exact: true }).click();
      await page.getByRole("dialog").waitFor();
      await page.getByRole("button", { name: "Agree and connect", exact: true }).click();
      await page.getByText("Automatic sync is in a closed beta", { exact: false }).waitFor();
      for (const address of ["extra.demo@example.org", "third.demo@example.org"]) {
        await page.getByLabel("Another address", { exact: false }).fill(address);
        await page.getByRole("button", { name: "Save another address", exact: true }).click();
        await page.getByText(address, { exact: true }).first().waitFor();
      }
      assert.equal(await page.getByLabel("Another address", { exact: false }).count(), 0);
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.locator("button.setup-source").filter({ hasText: "HDFC Bank" }).first().click();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      // SYNTHETIC HDFC statement from packages/parsers (npm run fixtures); bank.hdfc auto-attributes to the picked HDFC Bank.
      const pdf = new URL("../../../packages/parsers/tests/fixtures/out/hdfc-bank.synthetic.pdf", import.meta.url);
      await page.getByTestId("file-input").setInputFiles(pdf.pathname);
      try { await page.getByRole("button", { name: /Confirm import/ }).click({ timeout: 20000 }); }
      catch (e) { await page.screenshot({ path: `/tmp/lakshly-smoke-fail-${viewport.width}.png`, fullPage: true }); throw e; }
      await page.getByText("✓ Imported", { exact: false }).first().waitFor();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.getByRole("button", { name: "Save budget", exact: true }).click();
      await page.getByText("✓ Budget saved", { exact: false }).waitFor();
      const createGoal = page.getByRole("button", { name: "Create goal", exact: true });
      if (await createGoal.isDisabled()) await page.getByLabel("Target (INR)", { exact: true }).fill("10000");
      await createGoal.click();
      await page.getByText("Your first goal is already set.", { exact: false }).waitFor();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
      await page.getByRole("progressbar", { name: "Setup progress" }).waitFor();
      assert.equal(await page.getByRole("progressbar", { name: "Setup progress" }).getAttribute("aria-valuenow"), "100");
      const stored = await vault(page); assert.equal(stored.version, 2); assert(stored.encrypted); assert.equal(stored.setup.events.length, 1); assert.equal(stored.goals.length, 1); assert.equal(stored.imports.length, 1);
      const plain = await page.evaluate(() => Object.values(localStorage).join("\n"));
      assert(!/@|hdfc|HDFC|SYNTHETIC Demo|catalogId|sources/.test(plain), "Sensitive wizard values in localStorage");
      assert.deepEqual(Object.keys(JSON.parse(await page.evaluate(() => localStorage.getItem("lk-setup-flags")))).sort(), ["dismissed", "mode", "percent", "seen", "v"]);
      await noOverflow(page); await page.screenshot({ path: `/tmp/lakshly-r3-${viewport.width}.png`, fullPage: true });
      await page.reload(); await page.getByRole("heading", { name: "Data sources health", exact: true }).waitFor();
      assert.equal((await vault(page)).setup.events.length, 1);
      scenarios++; await ctx.close();
    }
    // A true first run redirects; deliberate demo stays on Overview and creates no sources/events.
    const ctx = await context({ width: 1440, height: 1000 }), page = await ctx.newPage();
    await page.goto(base); await page.waitForURL(/\/setup\//);
    await page.getByRole("button", { name: "Explore with demo data", exact: true }).click();
    await page.getByRole("heading", { name: "Use your own data · continue setup", exact: true }).waitFor();
    const demo = await vault(page); assert.equal(demo.setup.mode, "demo"); assert.deepEqual(demo.setup.sources, []); assert.deepEqual(demo.setup.events, []);
    await page.reload(); await page.getByRole("heading", { name: "Overview", exact: true }).waitFor(); scenarios++;
    await ctx.close();
    // The query is inert in a production build without the flag.
    const inert = await context({ width: 390, height: 844 }), p = await inert.newPage();
    await p.goto(`${base}/setup/?step=import&setupDemo=midway`); await p.getByRole("heading", { name: "Sync and import", exact: true }).waitFor();
    const empty = await vault(p); assert.equal(empty.setup.profile.name, ""); assert.deepEqual(empty.setup.sources, []); scenarios++; await inert.close();
  }
  assert.deepEqual(external, [], "Unexpected external requests"); assert.deepEqual(errors, [], "Browser errors");
  console.log(`PASS: ${scenarios} headless scenarios; 0 external requests; 0 console/page errors.`);
} finally { await browser.close(); }
