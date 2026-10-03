import { afterEach, describe, expect, it } from "vitest";
import { formatCount, formatINR, formatINRCompact, formatPct } from "../lib/format";
import { createShakeDetector, DEFAULT_PRIVACY, isMasked, MASK, parsePrivacy, PCT_MASK, privacyBootScript, setFormatMask } from "../lib/privacy";

afterEach(() => setFormatMask(false, false));

describe("privacy settings (lk-privacy)", () => {
  it("defaults match the spec", () => {
    expect(parsePrivacy(null)).toEqual({ on: false, startHidden: false, shake: false, hideOnBlur: false, hidePercent: false, widgetAmounts: "hidden", v: 1 });
  });
  it("parses defensively", () => {
    expect(parsePrivacy("nope")).toEqual(DEFAULT_PRIVACY);
    expect(parsePrivacy('{"on":true,"startHidden":"yes","widgetAmounts":"shown"}')).toEqual({ ...DEFAULT_PRIVACY, on: true, widgetAmounts: "shown" });
  });
  it("effective mask = on || transient || (startHidden && !revealed)", () => {
    expect(isMasked(DEFAULT_PRIVACY, false, false)).toBe(false);
    expect(isMasked({ ...DEFAULT_PRIVACY, on: true }, false, true)).toBe(true);
    expect(isMasked(DEFAULT_PRIVACY, true, false)).toBe(true);
    expect(isMasked({ ...DEFAULT_PRIVACY, startHidden: true }, false, false)).toBe(true);
    expect(isMasked({ ...DEFAULT_PRIVACY, startHidden: true }, false, true)).toBe(false);
  });
});

describe("formatters render the mask, never the digits", () => {
  const amounts = [0, 1, 99, 123456, -842_50, 12_34_56_789_00, -5_00_00_000_00];
  it("formatINR / formatINRCompact output contains no digits when masked", () => {
    setFormatMask(true, false);
    for (const a of amounts) {
      for (const out of [formatINR(a), formatINR(a, { decimals: true }), formatINR(a, { signed: true }), formatINRCompact(a)]) {
        expect(out).toContain(MASK);
        expect(out).not.toMatch(/\d/);
        expect(out).not.toMatch(/₹\s?\d/);
      }
    }
  });
  it("mask is fixed width: same text for small and huge amounts", () => {
    setFormatMask(true, false);
    expect(formatINR(100)).toBe(formatINR(99_99_99_999_00));
    expect(formatINR(-100)).toBe(`−${MASK}`);
  });
  it("percentages stay visible unless 'Also hide percentages' is on", () => {
    setFormatMask(true, false);
    expect(formatPct(42.5)).toBe("42.5%");
    setFormatMask(true, true);
    expect(formatPct(42.5)).toBe(PCT_MASK);
  });
  it("reward point counts are masked too", () => {
    expect(formatCount(4377)).toBe("4,377");
    setFormatMask(true, false);
    expect(formatCount(4377)).not.toMatch(/\d/);
  });
  it("no regression when privacy is off", () => {
    expect(formatINR(1234567)).toBe("₹12,346");
    expect(formatINRCompact(12_50_000_00)).toBe("₹12.5L");
  });
});

describe("shake detector", () => {
  it("fires on two peaks > 15 m/s² within 600 ms, then cools down for 1.5 s", () => {
    let n = 0;
    const d = createShakeDetector(() => { n += 1; });
    d(20, 0); expect(n).toBe(0);
    d(20, 400); expect(n).toBe(1);
    d(25, 800); d(25, 1000); expect(n).toBe(1);
    d(25, 2000); d(25, 2300); expect(n).toBe(2);
  });
  it("ignores small movements and slow peaks", () => {
    let n = 0;
    const d = createShakeDetector(() => { n += 1; });
    d(10, 0); d(14.9, 100); d(20, 1000); d(20, 1700); expect(n).toBe(0);
  });
});

describe("boot script", () => {
  it("only reads lk-privacy and sets a data attribute", () => {
    expect(privacyBootScript).toContain('"lk-privacy"');
    expect(privacyBootScript).toContain("privacyBoot");
    expect(privacyBootScript).not.toMatch(/fetch|XMLHttpRequest|sendBeacon/);
  });
});
