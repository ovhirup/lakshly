// QA 11 Oct: a real click on the dropzone must open the native file chooser.
// Raw CDP: intercept the chooser dialog, then send real mouse (desktop) / touch (mobile) input at the dropzone.
import { expect, test } from "@playwright/test";

for (const path of ["/import/", "/setup/?step=email"]) {
  test(`dropzone opens the file chooser on a real click/tap (${path})`, async ({ page, browserName, isMobile }) => {
    test.skip(browserName !== "chromium", "CDP file-chooser interception is Chromium-only");
    await page.goto(path);
    const target = page.getByTestId("drop-target").first();
    await target.scrollIntoViewIfNeeded();
    const box = (await target.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Page.enable");
    await cdp.send("Page.setInterceptFileChooserDialog", { enabled: true });
    const opened = new Promise<{ mode: string }>((resolve) => cdp.on("Page.fileChooserOpened", (e) => resolve(e as { mode: string })));
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    // The element under the pointer must be the label itself (no overlay eating the click).
    expect(await page.evaluate(([px, py]) => document.elementFromPoint(px, py)?.closest("label.drop-target") !== null, [x, y])).toBe(true);
    if (isMobile) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else {
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
      await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    }
    const e = await Promise.race([opened, new Promise<null>((r) => setTimeout(() => r(null), 5000))]);
    expect(e, "native file chooser should open").not.toBeNull();
    expect(e!.mode).toBe("selectSingle");
  });
}

test("file input is a real, visually hidden input (not display:none / visibility:hidden)", async ({ page }) => {
  await page.goto("/import/");
  const s = await page.getByTestId("file-input").first().evaluate((el) => { const c = getComputedStyle(el); return { display: c.display, visibility: c.visibility, pe: c.pointerEvents, hidden: (el as HTMLInputElement).hidden }; });
  expect(s.display).not.toBe("none");
  expect(s.visibility).toBe("visible");
  expect(s.hidden).toBe(false);
  const label = await page.getByTestId("drop-target").first().evaluate((el) => ({ pe: getComputedStyle(el).pointerEvents, forOk: !!document.getElementById((el as HTMLLabelElement).htmlFor) }));
  expect(label).toEqual({ pe: "auto", forOk: true });
});
