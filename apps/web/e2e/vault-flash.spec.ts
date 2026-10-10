// QA 11 Oct: after a reload, someone with real data must never see demo numbers while the vault opens.
import { expect, test } from "@playwright/test";

test("reload with real data shows a skeleton, never the demo", async ({ page }) => {
  await page.goto("/import/");
  await page.getByTestId("try-sample").click();
  await page.getByRole("button", { name: /Confirm import/ }).click();
  await expect(page.locator(".side-note").first()).toContainText("1 accounts");
  await page.addInitScript(() => {
    const w = window as unknown as { __demoSeen: boolean; __skeletonSeen: boolean };
    w.__demoSeen = false; w.__skeletonSeen = false;
    const check = () => {
      if (!document.body) return;
      if (document.documentElement.dataset.vault === "pending") w.__skeletonSeen = true;
      if (document.body.innerText.includes("Synthetic demo data")) w.__demoSeen = true;
    };
    new MutationObserver(check).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
    const loop = () => { check(); if (performance.now() < 6000) requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText(/Your data · as of/)).toBeVisible();
  const seen = await page.evaluate(() => { const w = window as unknown as { __demoSeen: boolean; __skeletonSeen: boolean }; return { __demoSeen: w.__demoSeen, __skeletonSeen: w.__skeletonSeen }; });
  expect(seen.__demoSeen).toBe(false);
  expect(seen.__skeletonSeen).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("lk-has-data"))).toBe("1");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toMatch(/₹|NEFT|SWIGGY/i);
});
