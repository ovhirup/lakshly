import { beforeEach, describe, expect, it } from "vitest";
import { setFormatMask } from "../lib/privacy";
import type { Category, Transaction } from "../lib/schema.gen";
import { emptyWow, type WowFee, type WowState } from "../lib/wow/state";
import { demoWowSeed } from "../components/useWow";
import {
  applyFeeAdd, applyFeeLog, applyFeeRemove, applyFeeReset, dayString, demoFeeSeed, dueDateLabel, dueLine,
  feeSuggestions, headline, paiseFromRupees, perMonthLine, percent, potMax, readyLine, rupeeField, runwayPlan,
  statusTitle,
} from "../lib/wow/fee-runway";

function txn(id: string, date: string, amount: number, merchant: string, category: Category): Transaction {
  return {
    id,
    accountId: "demo",
    date,
    amount,
    description: merchant,
    merchant,
    category,
    categorisedBy: "rule",
  };
}

function fee(id: string, name: string, amount: number, due: string, yearly: boolean): WowFee {
  return { id, name, amount, due, yearly };
}

function clock(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 12);
}

describe("fee runway", () => {
  it("ceils the monthly share and keeps at least one month", () => {
    const now = clock(2026, 1, 15);
    const soon = fee("soon", "Demo Soon", 100, "2026-01-20", false);
    const later = fee("later", "Demo Later", 1_000, "2026-04-15", true);
    const plan = runwayPlan([later, soon], {}, now);
    const soonRow = plan.fees.find((item) => item.id === "soon");
    const laterRow = plan.fees.find((item) => item.id === "later");
    expect(soonRow?.monthsLeft).toBe(1);
    expect(soonRow?.daysLeft).toBe(5);
    expect(soonRow?.perMonthPaise).toBe(100);
    expect(laterRow?.monthsLeft).toBe(3);
    expect(laterRow?.toGoPaise).toBe(1_000);
    expect(laterRow?.perMonthPaise).toBe(334);
    expect(plan.fees.map((item) => item.id)).toEqual(["soon", "later"]);
    expect(plan.monthlyNeedPaise).toBe(434);
  });

  it("marks funded, on track, and behind", () => {
    const now = clock(2026, 1, 15);
    const due = "2026-07-15";
    const plan = runwayPlan([
      fee("late", "Demo Late", 12_000, due, true),
      fee("funded", "Demo Funded", 12_000, due, true),
      fee("open", "Demo Open", 12_000, due, false),
      fee("steady", "Demo Steady", 12_000, due, true),
    ], { funded: 12_000, steady: 7_000, late: 1_000 }, now);
    expect(plan.fees.find((item) => item.id === "funded")?.status).toBe("funded");
    expect(plan.fees.find((item) => item.id === "funded")?.fraction).toBe(1);
    expect(plan.fees.find((item) => item.id === "funded")?.perMonthPaise).toBe(0);
    expect(plan.fees.find((item) => item.id === "steady")?.status).toBe("onTrack");
    expect(plan.fees.find((item) => item.id === "late")?.status).toBe("behind");
    expect(plan.fees.find((item) => item.id === "open")?.status).toBe("onTrack");
    expect(plan.totalPaise).toBe(48_000);
    expect(plan.fundedPaise).toBe(20_000);
  });

  it("rolls a past yearly fee forward and drops a one-off", () => {
    const now = clock(2026, 6, 15);
    const plan = runwayPlan([
      fee("once", "Demo One Off", 2_000, "2026-06-01", false),
      fee("year", "Demo Cover", 5_000, "2026-06-01", true),
    ], { year: 8_000, once: 2_000 }, now);
    expect(plan.fees.map((item) => item.id)).toEqual(["year"]);
    expect(plan.fees[0].due).toBe("2027-06-01");
    expect(plan.fees[0].setAside).toBe(3_000);
    expect(plan.fees[0].toGoPaise).toBe(2_000);
  });

  it("logs across the funded line once, then resets and removes", () => {
    let state: WowState = emptyWow();
    const item = fee("fee-demo", "Demo Cover", 10_000, "2026-12-01", true);
    state = applyFeeAdd(state, item);
    expect(applyFeeLog(state, item.id, 0).fundedNow).toBe(false);
    expect(applyFeeLog(state, item.id, -5).fundedNow).toBe(false);
    expect(applyFeeLog(state, item.id, 0).state).toBe(state);

    let outcome = applyFeeLog(state, item.id, 4_000);
    expect(outcome.fundedNow).toBe(false);
    state = outcome.state;
    expect(state.setAside[item.id]).toBe(4_000);

    outcome = applyFeeLog(state, item.id, 6_000);
    expect(outcome.fundedNow).toBe(true);
    state = outcome.state;

    outcome = applyFeeLog(state, item.id, 1);
    expect(outcome.fundedNow).toBe(false);
    state = outcome.state;
    expect(state.setAside[item.id]).toBe(10_001);

    state = applyFeeReset(state, item.id);
    expect(state.setAside[item.id] ?? 0).toBe(0);
    outcome = applyFeeLog(state, item.id, 10_000);
    expect(outcome.fundedNow).toBe(true);
    state = outcome.state;

    state = applyFeeRemove(state, item.id);
    expect(state.fees.some((row) => row.id === item.id)).toBe(false);
    expect(state.setAside[item.id]).toBeUndefined();
    expect(applyFeeLog(state, item.id, 500).fundedNow).toBe(false);
    expect(applyFeeLog(state, item.id, 500).state.setAside[item.id]).toBeUndefined();
  });

  it("clamps the pot", () => {
    let state = applyFeeAdd(emptyWow(), fee("cap", "Demo Cap", 2_000_000_000_000, "2026-12-01", true));
    let outcome = applyFeeLog(state, "cap", 2_000_000_000_000);
    expect(outcome.fundedNow).toBe(false);
    state = outcome.state;
    expect(state.setAside.cap).toBe(potMax);
    outcome = applyFeeLog(state, "cap", 10);
    expect(outcome.fundedNow).toBe(false);
    expect(outcome.state).toBe(state);
    expect(state.setAside.cap).toBe(potMax);
  });

  it("suggests a yearly insurance row and skips what is already saved", () => {
    const now = clock(2026, 3, 1);
    const rows = [
      txn("a", "2025-01-01", -100_000, "Demo Cover Insurance", "insurance"),
      txn("b", "2026-01-01", -120_000, "Demo Cover Insurance", "insurance"),
      txn("recent", "2026-02-01", -50_000, "Demo Recent Cover", "insurance"),
      txn("old", "2025-01-01", -80_000, "Example Old Cover", "insurance"),
      txn("income", "2025-01-01", 80_000, "Example Refund", "insurance"),
      txn("word", "2025-03-01", -2_999, "Sample Club membership", "shopping"),
    ];
    const found = feeSuggestions(rows, [], now);
    const yearly = found.find((item) => item.name === "Demo Cover Insurance");
    expect(yearly?.id).toBe("sugg-demo-cover-insurance");
    expect(yearly?.amount).toBe(120_000);
    expect(yearly?.due).toBe("2027-01-01");
    expect(yearly?.yearly).toBe(true);
    expect(found.some((item) => item.id === "sugg-example-old-cover" && item.amount === 80_000 && item.due === "2026-01-01")).toBe(true);
    expect(found.some((item) => item.id === "sugg-sample-club-membership" && item.yearly)).toBe(true);
    expect(found.some((item) => item.name === "Demo Recent Cover")).toBe(false);
    expect(found.some((item) => item.name === "Example Refund")).toBe(false);

    const again = feeSuggestions(rows, [
      fee("sugg-demo-cover-insurance", "Demo Cover Insurance", 120_000, "2027-01-01", true),
    ], now);
    expect(again.some((item) => item.id === "sugg-demo-cover-insurance")).toBe(false);
  });

  it("seeds three demo fees and leaves an empty record empty", () => {
    const now = clock(2026, 1, 15);
    const seeded = demoFeeSeed(now);
    const plan = runwayPlan(seeded.fees, seeded.setAside, now);
    expect(plan.fees).toHaveLength(3);
    expect(plan.fees.map((item) => item.name).sort()).toEqual([
      "Demo Car Insurance",
      "Example Professional Licence",
      "Sample Card Co annual fee",
    ]);
    expect(plan.fees.every((item) => item.yearly)).toBe(true);
    const car = plan.fees.find((item) => item.name === "Demo Car Insurance");
    const card = plan.fees.find((item) => item.name === "Sample Card Co annual fee");
    const licence = plan.fees.find((item) => item.name === "Example Professional Licence");
    expect(car?.amount).toBe(1_450_000);
    expect(car?.setAside).toBe(900_000);
    expect(card?.amount).toBe(299_900);
    expect(card?.setAside).toBe(0);
    expect(licence?.amount).toBe(900_000);
    expect(licence?.setAside).toBe(200_000);
    expect(car?.due).toBe("2026-05-15");
    expect(card?.due).toBe("2026-08-15");
    expect(licence?.due).toBe("2026-12-15");
    expect(plan.fees.some((item) => item.status === "onTrack" || item.status === "funded")).toBe(true);

    const demo = demoWowSeed(now);
    expect(demo.fees).toHaveLength(3);
    expect(demo.setAside["demo-car-insurance"]).toBe(900_000);
    expect(emptyWow().fees).toEqual([]);
    expect(runwayPlan([], {}, now).fees).toEqual([]);
  });
});

describe("fee runway copy", () => {
  beforeEach(() => setFormatMask(false, false));

  it("writes the due line with the day, month, and day count", () => {
    expect(dueLine("2026-02-12", 118)).toBe("due 12 Feb · 118 days");
    expect(dueLine("2026-03-01", 1)).toBe("due 1 Mar · 1 day");
    expect(dueLine("2026-12-31", 0)).toBe("due 31 Dec · today");
    expect(dueDateLabel("2026-02-12")).toBe("12 Feb");
  });

  it("titles each status", () => {
    expect(statusTitle("funded")).toBe("Funded ✓");
    expect(statusTitle("onTrack")).toBe("On track");
    expect(statusTitle("behind")).toBe("Behind");
  });

  it("builds the headline, ready line, and percent", () => {
    expect(headline(150_000)).toBe("Set aside ₹1,500 a month");
    expect(readyLine(6_200, 10_000, 0.62)).toBe("₹62 of ₹100 ready (62%)");
    expect(perMonthLine(334)).toBe("₹3.34 a month");
    expect(percent(0)).toBe(0);
    expect(percent(1)).toBe(100);
    expect(percent(0.625)).toBe(63);
    expect(percent(-0.2)).toBe(0);
    expect(percent(1.4)).toBe(100);
  });

  it("formats a rupee field and parses it back to paise", () => {
    expect(rupeeField(150_000)).toBe("1500");
    expect(rupeeField(350)).toBe("3.50");
    expect(rupeeField(0)).toBe("");
    expect(paiseFromRupees("1,500")).toBe(150_000);
    expect(paiseFromRupees("₹3.50")).toBe(350);
    expect(paiseFromRupees("3.5")).toBe(350);
    expect(paiseFromRupees("0")).toBeNull();
    expect(paiseFromRupees("")).toBeNull();
    expect(paiseFromRupees("12.345")).toBeNull();
    expect(paiseFromRupees("-5")).toBeNull();
  });

  it("uses the calendar day", () => {
    expect(dayString(new Date(2026, 1, 12, 12))).toBe("2026-02-12");
  });
});
