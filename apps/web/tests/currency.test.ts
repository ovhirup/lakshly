import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { CURRENCIES } from "@/lib/currencies.gen";
import { currencyInfo, fromMinor, isCurrencyCode, minorFactor, toMinor, tryToMinor, type CurrencyCode } from "@/lib/currency";

const bad = (code: string) => code as unknown as CurrencyCode;
import { MASK } from "@/lib/privacy";
import { MIN_LINE, roundBudget } from "@/lib/setup-suggest";
// @ts-expect-error plain .mjs generator without types
import { render, renderSwift } from "../scripts/gen-currencies.mjs";

const SRC = readFileSync(new URL("../../../packages/shared/currency/currencies.json", import.meta.url), "utf8");

describe("currency table", () => {
  it("covers exactly INR and USD for now", () => {
    expect(Object.keys(CURRENCIES)).toEqual(["INR", "USD"]);
    expect(isCurrencyCode("INR")).toBe(true);
    expect(isCurrencyCode("JPY")).toBe(false);
  });

  it("throws on an unsupported currency instead of falling back", () => {
    expect(() => currencyInfo(bad("JPY"))).toThrow("Unsupported currency");
    expect(() => toMinor("1", bad("EUR"))).toThrow();
    expect(() => minorFactor(bad("EUR"))).toThrow();
  });

  it("INR rows equal today's hard-coded rupee constants (Principle 1: no India regression)", () => {
    const m = CURRENCIES.INR.magnitude;
    expect(CURRENCIES.INR.mask).toBe(MASK);
    expect(m.minBudgetLine).toBe(MIN_LINE);
    // roundBudget: step is ₹100 below ₹5,000 and ₹500 at or above.
    expect(m.budgetStepThreshold).toBe(500000);
    expect(roundBudget(m.budgetStepThreshold - 1, 100) % m.budgetStepSmall).toBe(0);
    expect(roundBudget(m.budgetStepThreshold, 100) % m.budgetStepLarge).toBe(0);
    expect(m.starterBudgets).toEqual([["groceries", 600000], ["dining", 300000], ["transport", 200000], ["shopping", 300000]]);
  });

  it("minimums sit on the rounding grid", () => {
    for (const c of Object.values(CURRENCIES)) {
      expect(c.magnitude.minBudgetLine % c.magnitude.budgetStepSmall).toBe(0);
      expect(c.magnitude.goalMonthlyMinimum % c.magnitude.budgetStepSmall).toBe(0);
    }
  });

  it("USD keeps the INR step ratios", () => {
    const i = CURRENCIES.INR.magnitude;
    const u = CURRENCIES.USD.magnitude;
    expect(u.budgetStepLarge / u.budgetStepSmall).toBe(i.budgetStepLarge / i.budgetStepSmall);
    expect(u.budgetStepThreshold / u.budgetStepSmall).toBe(i.budgetStepThreshold / i.budgetStepSmall);
    expect(u.annualPaymentThreshold).toBe(u.budgetStepThreshold / 2);
    expect(CURRENCIES.USD.compactUnits.map((x) => x[1])).toEqual(["B", "M", "K"]);
  });
});

describe("toMinor / fromMinor", () => {
  it("parses decimal strings exactly", () => {
    expect(toMinor("19.99", "INR")).toBe(1999);
    expect(toMinor("1234.5", "USD")).toBe(123450);
    expect(toMinor("0.07", "USD")).toBe(7);
    expect(toMinor("-12.30", "USD")).toBe(-1230);
    expect(toMinor("+5", "INR")).toBe(500);
    expect(toMinor("  42 ", "INR")).toBe(4200);
    expect(toMinor("-0", "INR")).toBe(0);
    expect(Object.is(toMinor("-0.00", "USD"), 0)).toBe(true);
  });
  it("accepts trailing zero fraction digits but rejects real extra precision", () => {
    expect(toMinor("1.500", "USD")).toBe(150);
    expect(() => toMinor("1.505", "USD")).toThrow("Too many decimal places");
  });
  it("rejects non-amounts", () => {
    for (const bad of ["", "abc", "1,234", "1.2.3", "₹5", ".5", "5.", "NaN"]) expect(() => toMinor(bad, "INR")).toThrow();
  });
  it("has no silent-rounding number overload (strings only)", () => {
    // @ts-expect-error numbers are not accepted: a float cannot carry extra precision honestly
    expect(() => toMinor(19.999, "USD")).toThrow();
  });
  it("tryToMinor returns null instead of throwing, for text a user is still typing", () => {
    expect(tryToMinor("12.", "INR")).toBeNull();
    expect(tryToMinor("", "INR")).toBeNull();
    expect(tryToMinor("1.005", "USD")).toBeNull();
    expect(tryToMinor("12.50", "USD")).toBe(1250);
  });
  it("trims all surrounding whitespace, including newlines", () => expect(toMinor("42\n", "INR")).toBe(4200));
  it("round-trips minor to major", () => {
    expect(minorFactor("INR")).toBe(100);
    expect(fromMinor(1999, "USD")).toBe(19.99);
    for (const minor of [0, 1, 99, 100, 123456789, -5]) expect(toMinor(fromMinor(minor, "USD").toFixed(2), "USD")).toBe(minor);
  });
});

describe("generated files are current", () => {
  it("lib/currencies.gen.ts matches the generator output", () => {
    expect(readFileSync(new URL("../lib/currencies.gen.ts", import.meta.url), "utf8")).toBe(render(SRC));
  });
  it("Currencies.gen.swift matches the generator output", () => {
    expect(readFileSync(new URL("../../apple/Lakshly/Components/Currencies.gen.swift", import.meta.url), "utf8")).toBe(renderSwift(SRC));
  });
  it("the generator rejects an off-grid minimum", () => {
    const off = JSON.parse(SRC);
    off.currencies.USD.magnitude.minBudgetLine = 2500;
    expect(() => render(JSON.stringify(off))).toThrow("multiple of budgetStepSmall");
  });
  it("the generator rejects a table with mismatched magnitude keys", () => {
    const bad = JSON.parse(SRC);
    delete bad.currencies.USD.magnitude.minBudgetLine;
    expect(() => render(JSON.stringify(bad))).toThrow("magnitude keys differ");
  });
});
