import { describe, expect, it } from "vitest";
import type { Account, Transaction } from "../lib/schema.gen";
import { assetAllocation, netWorth, netWorthHistory } from "../lib/selectors";
import { dataset } from "../lib/data";

const account = (id: string, type: Account["type"], balance: number): Account => ({
  id, name: id, type, institution: "Demo", currency: "INR", balance, asOf: "2026-10-01",
});
const txn = (id: string, accountId: string, date: string, amount: number): Transaction => ({
  id, accountId, date, amount, description: "Synthetic", category: amount > 0 ? "income" : "groceries",
});

describe("net worth history", () => {
  it("ends on today's net worth and walks a deposit backwards", () => {
    const accounts = [account("sav", "savings", 150000), account("loan", "loan", -40000)];
    const points = netWorthHistory(accounts, [txn("t1", "sav", "2026-09-02", 50000)]);
    expect(points.map((p) => p.month)).toEqual(["2026-09"]);
    expect(points[0].net).toBe(netWorth(accounts).net);
    expect(points[0]).toMatchObject({ assets: 150000, liabilities: 40000, net: 110000 });
  });

  it("records each month after that month's transactions", () => {
    const accounts = [account("sav", "savings", 150000)];
    const points = netWorthHistory(accounts, [
      txn("a", "sav", "2026-08-01", 50000),
      txn("b", "sav", "2026-09-01", 20000),
    ]);
    expect(points.map((p) => p.net)).toEqual([130000, 150000]);
  });

  it("splits what you own into shares that sum to 100 and leaves loans out", () => {
    const slices = assetAllocation([
      account("sav", "savings", 75000),
      account("fd", "fixed_deposit", 25000),
      account("loan", "loan", -90000),
    ]);
    expect(slices.map((s) => s.type)).toEqual(["savings", "fixed_deposit"]);
    expect(slices.map((s) => s.pct)).toEqual([75, 25]);
  });

  it("matches the synthetic demo's latest net worth", () => {
    const points = netWorthHistory(dataset.accounts, dataset.transactions);
    expect(points.length).toBeGreaterThan(1);
    expect(points[points.length - 1].net).toBe(netWorth(dataset.accounts).net);
    expect(assetAllocation(dataset.accounts).reduce((s, x) => s + x.pct, 0)).toBeCloseTo(100, 5);
  });
});
