import { describe, expect, it } from "vitest";
import { CURRENCIES } from "@/lib/currencies.gen";
import { goalFacts, roundBudget, suggestBudget, suggestGoal } from "@/lib/setup-suggest";

// WP1 B2: the suggestion thresholds now come from the shared currency table. INR is the default and must not change
// (setup.test.ts and golden-inr.test.ts pin that); these tests cover the new currency parameter.
describe("setup thresholds follow the currency", () => {
  it("INR stays the default: same numbers as before the migration", () => {
    expect(CURRENCIES.INR.magnitude.minBudgetLine).toBe(50000);
    expect(roundBudget(123456)).toBe(roundBudget(123456, 100, "INR"));
    expect(roundBudget(499999) % 10000).toBe(0);
    expect(roundBudget(500000) % 50000).toBe(0);
  });

  it("USD rounds to $10 below $500 and $50 at or above", () => {
    expect(roundBudget(12345, 100, "USD")).toBe(12000); // $123.45 -> $120
    expect(roundBudget(123456, 100, "USD")).toBe(125000); // $1,234.56 -> $1,250
    expect(roundBudget(49999, 100, "USD") % 1000).toBe(0);
    expect(roundBudget(50000, 100, "USD") % 5000).toBe(0);
  });

  it("USD starter budgets are the USD placeholders, rounded on the USD grid", () => {
    const s = suggestBudget([], "2026-09-15", { currency: "USD", preset: "comfortable" });
    expect(s.mode).toBe("starter");
    expect(s.lines.map((l) => [l.category, l.suggested])).toEqual([["groceries", 40000], ["dining", 20000], ["transport", 15000], ["shopping", 20000]]);
  });

  it("USD goals round to $100 targets, $10 monthly, and a $1,000 custom default", () => {
    const g = suggestGoal({ monthlySpend: 200000, liquid: 100000 }, "2026-09-15", "2026-09-15T00:00:00Z", "USD");
    expect(g.kind).toBe("emergency3");
    expect(g.target).toBe(600000);
    expect(g.monthly).toBe(42000);
    const custom = suggestGoal({ monthlySpend: 0, liquid: 0 }, "2026-09-15", "2026-09-15T00:00:00Z", "USD");
    expect(custom).toMatchObject({ kind: "custom", target: 100000, monthly: 9000 });
  });

  it("the annual-payment threshold follows the currency", () => {
    const txn = (amount: number) => ({ id: "t1", date: "2025-12-01", accountId: "a", amount, category: "insurance", merchant: "Insurer" }) as never;
    // $300 qualifies in USD (threshold $250) but is far below the INR threshold of ₹5,000 in paise terms (30000 < 500000).
    expect(goalFacts([txn(-30000)], [], "2026-09-15", "USD").annual).toBeDefined();
    expect(goalFacts([txn(-30000)], [], "2026-09-15", "INR").annual).toBeUndefined();
  });
});
