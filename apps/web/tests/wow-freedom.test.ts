import { describe, expect, it } from "vitest";
import type { Debt } from "../lib/schema.gen";
import { debts } from "../lib/data";
import {
  clearedFraction, countdown, emiDoesNotCoverInterest, extraSliderMaximum, extraStepPaise, interestSaved, maxMonths, message, pullIn, simulate, startMonth,
} from "../lib/wow/freedom";
import { extraPaiseMax, normaliseWow, type WowFee } from "../lib/wow/state";

function debt(
  id: string,
  name: string,
  principal: number,
  outstanding: number,
  rate: number,
  emi: number,
  kind: Debt["kind"] = "personal_loan",
): Debt {
  return {
    id, name, kind, lender: "Sample Lender", principal, outstanding, annualRatePct: rate, emi,
    startDate: "2026-01-01", tenureMonths: 12,
  };
}

function payoffMonth(plan: { payoffs: { id: string; month: string | null }[] }, id: string): string | null | undefined {
  return plan.payoffs.find((p) => p.id === id)?.month;
}

const fee = (over: Partial<WowFee> = {}): WowFee => ({
  id: "fee-demo", name: "Demo annual fee", amount: 50_000, due: "2026-04-01", yearly: true, ...over,
});

describe("freedom date", () => {
  it("pays one loan off on the baseline month", () => {
    const loan = debt("loan", "Demo personal loan", 12_000, 12_000, 12, 5_000);
    const plan = simulate([loan], "2026-01", 0, false);
    expect(plan.freedomMonth).toBe("2026-03");
    expect(plan.months).toBe(3);
    expect(plan.totalInterestPaise).toBe(213);
    expect(plan.payoffs).toEqual([{ id: "loan", name: "Demo personal loan", month: "2026-03" }]);
    expect(plan.unscheduled).toEqual([]);

    const flat = debt("flat", "Demo flat loan", 30_000, 30_000, 0, 10_000);
    const flatPlan = simulate([flat], "2026-01", 0, false);
    expect(flatPlan.freedomMonth).toBe("2026-03");
    expect(flatPlan.months).toBe(3);
    expect(flatPlan.totalInterestPaise).toBe(0);
  });

  it("leaves a zero EMI or a closed loan unscheduled", () => {
    const loan = debt("loan", "Demo personal loan", 30_000, 30_000, 0, 10_000);
    const family = debt("family", "Demo family loan", 10_000, 10_000, 0, 0, "family");
    const paid = debt("paid", "Demo closed loan", 5_000, 0, 10, 500);
    const plan = simulate([loan, family, paid], "2026-01", 0, false);
    expect(plan.unscheduled.map((d) => d.id)).toEqual(["family", "paid"]);
    expect(plan.payoffs.map((p) => p.id)).toEqual(["loan"]);
    expect(plan.freedomMonth).toBe("2026-03");
    expect(plan.payoffs.some((p) => p.id === "family")).toBe(false);
  });

  it("pulls the date in with extra and saves interest", () => {
    const loan = debt("loan", "Demo personal loan", 12_000, 12_000, 12, 5_000);
    const baseline = simulate([loan], "2026-01", 0, false);
    const whatIf = simulate([loan], "2026-01", 3_000, false);
    expect(baseline.freedomMonth).toBe("2026-03");
    expect(whatIf.freedomMonth).toBe("2026-02");
    expect(whatIf.totalInterestPaise).toBe(161);
    expect(pullIn(baseline, whatIf)).toBe(1);
    expect(interestSaved(baseline, whatIf)).toBe(52);
    expect(pullIn(baseline, baseline)).toBe(0);
    expect(interestSaved(whatIf, baseline)).toBe(0);
    expect(message(1)).toBe("1 month sooner, nice nudge 🎉");
  });

  it("rolls a cleared EMI onto the next debt", () => {
    const first = debt("a", "Demo high loan", 10_000, 10_000, 0, 10_000);
    const second = debt("b", "Demo long loan", 20_000, 20_000, 0, 5_000);
    const rows = [first, second];
    const plain = simulate(rows, "2026-01", 0, false);
    const rolled = simulate(rows, "2026-01", 0, true);
    expect(plain.freedomMonth).toBe("2026-04");
    expect(plain.months).toBe(4);
    expect(rolled.freedomMonth).toBe("2026-02");
    expect(rolled.months).toBe(2);
    expect(pullIn(plain, rolled)).toBeGreaterThan(0);
    expect(pullIn(plain, rolled)).toBe(2);
    expect(rolled.months).toBeLessThan(plain.months);
  });

  it("avalanches the highest rate, then the smallest balance", () => {
    const high = debt("high", "Demo high rate", 50_000, 50_000, 24, 100);
    const low = debt("low", "Demo low rate", 5_000, 5_000, 1, 100);
    const plan = simulate([low, high], "2026-04", 50_900, false);
    expect(payoffMonth(plan, "high")).toBe("2026-04");
    expect(payoffMonth(plan, "low")).not.toBe("2026-04");

    const big = debt("big", "Demo big balance", 10_000, 10_000, 12, 100);
    const small = debt("small", "Demo small balance", 4_000, 4_000, 12, 100);
    const tie = simulate([big, small], "2026-05", 5_000, false);
    expect(payoffMonth(tie, "small")).toBe("2026-05");
    expect(payoffMonth(tie, "big")).not.toBe("2026-05");

    const heavy = debt("heavy", "Demo heavy rate", 5_000, 5_000, 18, 5_000);
    const light = debt("light", "Demo light rate", 1_000, 1_000, 1, 100);
    const cascade = simulate([light, heavy], "2026-08", 976, false);
    expect(cascade.payoffs.map((p) => p.month)).toEqual(["2026-08", "2026-08"]);
  });

  it("has no freedom month when the EMI does not cover interest", () => {
    const trap = debt("trap", "Demo interest trap", 100_000, 100_000, 12, 500);
    const plan = simulate([trap], "2026-01", 0, false);
    expect(plan.freedomMonth).toBeNull();
    expect(plan.months).toBe(maxMonths);
    expect(plan.payoffs).toEqual([{ id: "trap", name: "Demo interest trap", month: null }]);
    expect(plan.totalInterestPaise).toBeGreaterThan(0);
    expect(emiDoesNotCoverInterest(trap)).toBe(true);
    expect(emiDoesNotCoverInterest(debt("ok", "Demo covered", 12_000, 12_000, 12, 5_000))).toBe(false);
    expect(emiDoesNotCoverInterest(debt("family", "Demo family loan", 10_000, 10_000, 0, 0, "family"))).toBe(false);
  });

  it("never counts a negative countdown", () => {
    expect(countdown("2001-01", new Date()).days).toBe(0);
    expect(countdown("2099-01", new Date()).days).toBeGreaterThan(0);
    expect(countdown("not-a-month", new Date()).days).toBe(0);

    const mid = new Date(2026, 5, 15);
    expect(countdown("2026-06", mid).days).toBe(16);
    const onTarget = new Date(2026, 6, 1);
    expect(countdown("2026-06", onTarget).days).toBe(0);
    const after = new Date(2026, 6, 2, 9);
    expect(countdown("2026-06", after).days).toBe(0);
  });

  it("measures how much principal is already cleared", () => {
    expect(clearedFraction([])).toBe(0);
    expect(clearedFraction([debt("zero", "Demo zero", 0, 0, 0, 0)])).toBe(0);
    expect(clearedFraction([debt("half", "Demo half", 200, 100, 0, 10)])).toBe(0.5);
    const done = debt("done", "Demo done", 80, 20, 0, 10);
    const open = debt("open", "Demo open", 80, 80, 0, 10);
    expect(clearedFraction([done, open])).toBe(0.375);
  });

  it("picks the message from the months pulled in", () => {
    expect(message(0)).toBe("Steady and sure, the tortoise also won 🐢");
    expect(message(-3)).toBe("Steady and sure, the tortoise also won 🐢");
    expect(message(1)).toBe("1 month sooner, nice nudge 🎉");
    expect(message(2)).toBe("2 months sooner, nice nudge 🎉");
    expect(message(5)).toBe("5 months sooner, nice nudge 🎉");
    expect(message(6)).toBe("6 months sooner, half a year back in your pocket 🚀");
    expect(message(11)).toBe("11 months sooner, half a year back in your pocket 🚀");
    expect(message(12)).toBe("12 months sooner, freedom speedrun unlocked 🏁");
    expect(message(24)).toBe("24 months sooner, freedom speedrun unlocked 🏁");
  });

  it("reads the start month from the review clock", () => {
    expect(startMonth(new Date(2026, 9, 17, 21))).toBe("2026-10");
  });

  it("gives the synthetic demo a freedom month", () => {
    const plan = simulate(debts, "2026-01", 0, false);
    expect(plan.freedomMonth).not.toBeNull();
    expect(plan.payoffs.length).toBeGreaterThan(0);
    expect(plan.unscheduled.some((d) => d.emi === 0)).toBe(true);
  });

  it("ignores a bad month and a negative extra", () => {
    const loan = debt("loan", "Demo personal loan", 12_000, 12_000, 12, 5_000);
    const bad = simulate([loan], "nope", 0, false);
    expect(bad.freedomMonth).toBeNull();
    expect(bad.months).toBe(0);
    expect(bad.payoffs).toEqual([]);
    expect(bad.totalInterestPaise).toBe(0);
    expect(bad.unscheduled.map((d) => d.id)).toEqual(["loan"]);
    const clamped = simulate([loan], "2026-01", -3_000, false);
    expect(clamped.freedomMonth).toBe("2026-03");
    expect(clamped.totalInterestPaise).toBe(213);
  });

  it("caps the extra slider at a ₹500 step and at least ₹500", () => {
    expect(extraStepPaise).toBe(50_000);
    expect(extraSliderMaximum([])).toBe(50_000);
    expect(extraSliderMaximum([debt("a", "Demo loan", 10_000, 10_000, 0, 10_000)])).toBe(50_000);
    expect(extraSliderMaximum([debt("a", "Demo loan", 80_000, 80_000, 0, 40_000)])).toBe(100_000);
    expect(extraSliderMaximum([
      debt("a", "Demo loan", 60_000, 60_000, 0, 30_000),
      debt("b", "Demo family loan", 20_000, 20_000, 0, 0, "family"),
    ])).toBe(100_000);
  });
});

describe("normaliseWow", () => {
  it("fills defaults for empty input", () => {
    const empty = { extraPaise: 0, rollOver: false, plannedCancels: [], fees: [], setAside: {} };
    expect(normaliseWow(null)).toEqual(empty);
    expect(normaliseWow(undefined)).toEqual(empty);
    expect(normaliseWow("nope")).toEqual(empty);
    expect(normaliseWow([])).toEqual(empty);
    expect(normaliseWow({})).toEqual(empty);
  });

  it("clamps extra, sorts cancels, and keeps only safe amounts", () => {
    const state = normaliseWow({
      extraPaise: extraPaiseMax + 25,
      rollOver: true,
      plannedCancels: ["zeta", "alpha", "zeta", 3, ""],
      setAside: { rent: 100, junk: -40, late: 1.5, missing: "20" },
    });
    expect(state.extraPaise).toBe(extraPaiseMax);
    expect(normaliseWow({ extraPaise: -8 }).extraPaise).toBe(0);
    expect(normaliseWow({ extraPaise: 1.5 }).extraPaise).toBe(0);
    expect(normaliseWow({ extraPaise: "500" }).extraPaise).toBe(0);
    expect(state.rollOver).toBe(true);
    expect(normaliseWow({ rollOver: "yes" }).rollOver).toBe(false);
    expect(state.plannedCancels).toEqual(["", "alpha", "zeta"]);
    expect(state.setAside).toEqual({ rent: 100, junk: 0 });
  });

  it("drops a fee that is missing a field or has a bad amount or date", () => {
    const good = fee();
    const state = normaliseWow({
      fees: [
        good,
        null,
        "fee",
        fee({ id: "" }),
        fee({ name: 4 as unknown as string }),
        fee({ amount: -1 }),
        fee({ amount: 10.5 }),
        fee({ due: "2026-02-31" }),
        fee({ due: "01-04-2026" }),
        fee({ yearly: "yes" as unknown as boolean }),
        fee({ id: "fee-sample", name: "Sample card fee", amount: 0, due: "2024-02-29", yearly: false }),
      ],
    });
    expect(state.fees).toEqual([
      good,
      { id: "fee-sample", name: "Sample card fee", amount: 0, due: "2024-02-29", yearly: false },
    ]);
  });
});
