import { describe, expect, it } from "vitest";
import { monthlyCashflow } from "../lib/selectors";
import { dataset } from "../lib/data";

describe("demo dataset cash flow", () => {
  const flow = monthlyCashflow(dataset.transactions);

  it("covers six complete months", () => {
    expect(flow).toHaveLength(6);
  });

  it("has income above spending and a healthy savings rate every month", () => {
    for (const m of flow) {
      expect(m.income).toBeGreaterThan(m.spend);
      const rate = m.saved / m.income;
      expect(rate).toBeGreaterThanOrEqual(0.2);
      expect(rate).toBeLessThanOrEqual(0.35);
    }
  });

  it("does not count credit-card bill payments as income or spend", () => {
    const transfers = dataset.transactions.filter((t) => t.category === "transfers");
    expect(transfers.length).toBeGreaterThan(0);
    const total = flow.reduce((s, m) => s + m.income, 0);
    const salary = dataset.transactions.filter((t) => t.category === "income").reduce((s, t) => s + t.amount, 0);
    expect(total).toBe(salary);
  });
});
