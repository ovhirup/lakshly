// QA rerun2: cold hard reload on Slow 3G with cache disabled. Once lk-has-data is set, no frame may show demo
// values, and the skeleton must already be visible in the first painted frame.
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const DEMO = /5,51,538|Synthetic demo data|Demo data/;
const SHOTS = process.env.LK_FRAME_DIR;

type Frame = { t: number; vault: string | null; skeleton: boolean; demo: boolean; real: boolean };

async function instrument(page: Page) {
  await page.addInitScript((demoSrc: string) => {
    const demo = new RegExp(demoSrc);
    const w = window as unknown as { __frames: Frame[] };
    w.__frames = [];
    const tick = () => {
      if (document.body) {
        const sk = document.querySelector(".vault-skeleton");
        const main = document.getElementById("main-content");
        const text = document.body.innerText; // innerText skips display:none / visibility:hidden
        w.__frames.push({
          t: Math.round(performance.now()),
          vault: document.documentElement.dataset.vault ?? null,
          skeleton: !!sk && getComputedStyle(sk).display !== "none",
          demo: demo.test(text),
          real: !!main && /Your data · as of/.test(main.innerText),
        });
      }
      if (performance.now() < 120000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, DEMO.source);
}

async function slow3g(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  // DevTools "Slow 3G" preset.
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 2000, downloadThroughput: (500 * 1000) / 8 * 0.8, uploadThroughput: (500 * 1000) / 8 * 0.8 });
  return cdp;
}

async function filmUntil(page: Page, label: string, done: () => Promise<boolean>) {
  if (SHOTS) mkdirSync(`${SHOTS}/${label}`, { recursive: true });
  for (let i = 0; i < 1200; i++) {
    const t0 = Date.now();
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${label}/${String(i).padStart(4, "0")}.png`, timeout: 2000 }).catch(() => {});
    if (await done().catch(() => false)) return i;
    await page.waitForTimeout(Math.max(0, 100 - (Date.now() - t0)));
  }
  throw new Error("never finished loading");
}

test.describe.configure({ timeout: 240_000 });

test("cold reload on Slow 3G with real data: skeleton first, never demo", async ({ page, browserName }, info) => {
  test.skip(browserName !== "chromium", "CDP throttling is Chromium-only");
  await page.goto("/import/");
  await page.getByTestId("try-sample").click();
  await page.getByRole("button", { name: /Confirm import/ }).click();
  await expect(page.locator(".side-note").first()).toContainText("1 accounts");
  expect(await page.evaluate(() => localStorage.getItem("lk-has-data"))).toBe("1");

  await instrument(page);
  await slow3g(page);
  const nav = page.goto("/", { waitUntil: "commit", timeout: 120_000 });
  await nav;
  await filmUntil(page, `cold-${info.project.name}`, async () => page.evaluate(() => /Your data · as of/.test(document.getElementById("main-content")?.innerText ?? "")));
  const frames = await page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames);
  expect(frames.length).toBeGreaterThan(5);
  expect(frames[0].skeleton, `first frame: ${JSON.stringify(frames[0])}`).toBe(true);
  expect(frames.filter((f) => f.demo), "frames showing demo values").toEqual([]);
  expect(frames.at(-1)?.real).toBe(true);
  await page.screenshot({ path: SHOTS ? `${SHOTS}/cold-${info.project.name}-final.png` : info.outputPath("final.png") });
});

test("fresh visitor on Slow 3G sees the skeleton during the initial blank", async ({ page, browserName }, info) => {
  test.skip(browserName !== "chromium", "CDP throttling is Chromium-only");
  await instrument(page);
  await slow3g(page);
  await page.goto("/", { waitUntil: "commit", timeout: 120_000 });
  await filmUntil(page, `fresh-${info.project.name}`, async () => page.evaluate(() => document.documentElement.dataset.vault === undefined && !!document.querySelector("#main-content h1")));
  const frames = await page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames);
  expect(frames[0].skeleton).toBe(true);
  expect(frames.filter((f) => f.demo && f.vault === "pending")).toEqual([]);
});
