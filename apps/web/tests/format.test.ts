import { describe, expect, it } from "vitest";
import { formatINR, formatINRCompact, formatMonth } from "@/lib/format";
import { amortise, budgetProgress, netWorth, spendByCategory } from "@/lib/selectors";
import { dataset } from "@/lib/data";

describe("INR formatting (from paise)", () => {
  it("uses Indian digit grouping", () => {
    expect(formatINR(12345678900)).toBe("₹12,34,56,789");
    expect(formatINR(-50000)).toBe("−₹500");
    expect(formatINR(1999, { decimals: true })).toBe("₹19.99");
  });
  it("compacts to K / L / Cr", () => {
    expect(formatINRCompact(95000)).toBe("₹950");
    expect(formatINRCompact(1250000)).toBe("₹12.5K");
    expect(formatINRCompact(32000000)).toBe("₹3.2L");
    expect(formatINRCompact(1100000000)).toBe("₹1.1Cr");
  });
  it("formats months locale-independently", () => expect(formatMonth("2026-09")).toBe("Sep 2026"));
});

describe("selectors on synthetic data", () => {
  it("only loads synthetic datasets", () => expect(dataset.synthetic).toBe(true));
  it("computes net worth = assets - liabilities", () => {
    const nw = netWorth(dataset.accounts);
    expect(nw.net).toBe(nw.assets - nw.liabilities);
    expect(nw.liabilities).toBeGreaterThan(0);
  });
  it("spend excludes income and investments", () => {
    const cats = spendByCategory(dataset.transactions).map((c) => c.category);
    expect(cats).not.toContain("income");
    expect(cats).not.toContain("investments");
  });
  it("prepayment pays debt off sooner with less interest", () => {
    const d = dataset.debts![0];
    const base = amortise(d);
    const fast = amortise(d, 200000);
    expect(fast.months).toBeLessThan(base.months);
    expect(fast.interest).toBeLessThan(base.interest);
  });
  it("budget progress matches budgets for the month", () => {
    const m = dataset.budgets![0].month;
    expect(budgetProgress(dataset.budgets!, dataset.transactions, m).length).toBe(dataset.budgets!.filter((b) => b.month === m).length);
  });
});
