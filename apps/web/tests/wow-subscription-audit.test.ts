import { describe, expect, it } from "vitest";
import { transactions } from "@/lib/data";
import type { Category, Transaction } from "../lib/schema.gen";
import { emptyWow } from "../lib/wow/state";
import {
  buildAudit, flagText, kindTitle, scheduleLine, togglePlanned,
} from "../lib/wow/subscription-audit";

function txn(
  id: string,
  date: string,
  amount: number,
  merchant: string,
  category: Category,
  recurring?: boolean,
): Transaction {
  return {
    id,
    accountId: "demo",
    date,
    amount,
    description: merchant,
    merchant,
    category,
    categorisedBy: "rule",
    ...(recurring === undefined ? {} : { recurring }),
  };
}

function day(year: number, month: number, date: number): Date {
  return new Date(year, month - 1, date, 12);
}

describe("subscription audit", () => {
  it("detects a monthly charge and the next date", () => {
    const audit = buildAudit([
      txn("a", "2026-05-11", -64_900, "Demo Stream Box", "subscriptions"),
      txn("b", "2026-06-11", -64_900, "Demo Stream Box", "subscriptions"),
      txn("c", "2026-07-11", -64_900, "Demo Stream Box", "subscriptions"),
    ], day(2026, 7, 20), new Set());
    const item = audit.items[0];
    expect(item).toBeDefined();
    expect(item.id).toBe("demo stream box");
    expect(item.name).toBe("Demo Stream Box");
    expect(item.kind).toBe("video");
    expect(item.charges).toBe(3);
    expect(item.cadence).toBe("monthly");
    expect(item.lastDate).toBe("2026-07-11");
    expect(item.lastPaise).toBe(64_900);
    expect(item.typicalPaise).toBe(64_900);
    expect(item.monthlyPaise).toBe(64_900);
    expect(item.yearlyPaise).toBe(64_900 * 12);
    expect(item.nextDate).toBe("2026-08-11");
    expect(scheduleLine(item)).toBe("Monthly · next 11 Aug");
    expect(item.flags).toEqual([]);
    expect(item.verdict).toBe("Keep");
    expect(kindTitle("video")).toBe("Video");
    expect(kindTitle("music")).toBe("Music");
    expect(kindTitle("cloud")).toBe("Cloud");
    expect(kindTitle("news")).toBe("News");
    expect(kindTitle("other")).toBe("Other");
  });

  it("treats a single subscription charge as monthly", () => {
    const audit = buildAudit([
      txn("n", "2026-08-01", -5_000, "Sample News Daily", "subscriptions"),
      txn("once", "2026-08-02", -9_000, "Demo Cinema Night", "entertainment"),
    ], day(2026, 8, 10), new Set());
    expect(audit.items.map((item) => item.name)).toEqual(["Sample News Daily"]);
    const item = audit.items[0];
    expect(item.kind).toBe("news");
    expect(item.cadence).toBe("monthly");
    expect(item.nextDate).toBe("2026-09-01");
    expect(item.monthlyPaise).toBe(5_000);
    expect(item.yearlyPaise).toBe(60_000);
  });

  it("normalises yearly, quarterly, weekly and irregular charges", () => {
    const audit = buildAudit([
      txn("y1", "2025-01-15", -120_000, "Example Cloud Backup", "subscriptions"),
      txn("y2", "2026-01-15", -120_000, "Example Cloud Backup", "subscriptions"),
      txn("q1", "2026-01-01", -30_000, "Demo Magazine Post", "subscriptions"),
      txn("q2", "2026-04-01", -30_000, "Demo Magazine Post", "subscriptions"),
      txn("w1", "2026-04-01", -7_000, "Sample Radio Hour", "subscriptions"),
      txn("w2", "2026-04-08", -7_000, "Sample Radio Hour", "subscriptions"),
      txn("w3", "2026-04-15", -7_000, "Sample Radio Hour", "subscriptions"),
      txn("i1", "2026-01-01", -20_000, "Demo Odd Club", "entertainment"),
      txn("i2", "2026-07-20", -20_000, "Demo Odd Club", "entertainment"),
    ], day(2026, 4, 20), new Set());
    const yearly = audit.items.find((item) => item.name === "Example Cloud Backup");
    expect(yearly).toBeDefined();
    expect(yearly?.cadence).toBe("yearly");
    expect(yearly?.kind).toBe("cloud");
    expect(yearly?.monthlyPaise).toBe(120_000 / 12);
    expect(yearly?.yearlyPaise).toBe((yearly?.monthlyPaise ?? 0) * 12);
    expect(yearly?.nextDate).toBe("2027-01-15");
    const quarterly = audit.items.find((item) => item.name === "Demo Magazine Post");
    expect(quarterly?.cadence).toBe("quarterly");
    expect(quarterly?.kind).toBe("news");
    expect(quarterly?.monthlyPaise).toBe(10_000);
    expect(quarterly?.yearlyPaise).toBe(120_000);
    const weekly = audit.items.find((item) => item.name === "Sample Radio Hour");
    expect(weekly?.cadence).toBe("weekly");
    expect(weekly?.kind).toBe("music");
    expect(weekly?.monthlyPaise).toBe(Math.trunc((7_000 * 52) / 12));
    expect(weekly?.yearlyPaise).toBe((weekly?.monthlyPaise ?? 0) * 12);
    expect(weekly?.nextDate).toBe("2026-04-22");
    const irregular = audit.items.find((item) => item.name === "Demo Odd Club");
    expect(irregular?.cadence).toBe("irregular");
    expect(irregular?.nextDate).toBeNull();
    expect(irregular?.monthlyPaise).toBe((40_000 * 30) / 200);
    expect(irregular?.yearlyPaise).toBe((irregular?.monthlyPaise ?? 0) * 12);
  });

  it("flags a price rise", () => {
    const audit = buildAudit([
      txn("p1", "2026-03-05", -10_000, "Demo Stream Plus", "subscriptions"),
      txn("p2", "2026-04-05", -10_000, "Demo Stream Plus", "subscriptions"),
      txn("p3", "2026-05-05", -10_000, "Demo Stream Plus", "subscriptions"),
      txn("p4", "2026-06-05", -13_000, "Demo Stream Plus", "subscriptions"),
    ], day(2026, 6, 10), new Set());
    const item = audit.items[0];
    expect(item.lastPaise).toBe(13_000);
    expect(item.typicalPaise).toBe(10_000);
    expect(item.flags.map(flagText)).toEqual(["Price up 30%"]);
    expect(item.verdict).toBe("Worth a look");
  });

  it("flags two charges in one month", () => {
    const audit = buildAudit([
      txn("d1", "2026-04-10", -20_000, "Sample Tunes Desk", "subscriptions"),
      txn("d2", "2026-05-10", -20_000, "Sample Tunes Desk", "subscriptions"),
      txn("d3", "2026-05-20", -20_000, "Sample Tunes Desk", "subscriptions"),
      txn("d4", "2026-06-10", -20_000, "Sample Tunes Desk", "subscriptions"),
    ], day(2026, 6, 15), new Set());
    const item = audit.items[0];
    expect(item.cadence).toBe("monthly");
    expect(item.flags.map(flagText)).toEqual(["Charged twice in May"]);
    expect(item.verdict).toBe("Worth a look");
  });

  it("flags a lapsed subscription and drops it from the totals", () => {
    const audit = buildAudit([
      txn("l1", "2026-01-04", -15_000, "Demo Stream Old", "subscriptions"),
      txn("l2", "2026-02-04", -15_000, "Demo Stream Old", "subscriptions"),
      txn("l3", "2026-03-04", -15_000, "Demo Stream Old", "subscriptions"),
    ], day(2026, 6, 1), new Set());
    const item = audit.items[0];
    expect(item.cadence).toBe("monthly");
    expect(item.lapsed).toBe(true);
    expect(item.flags.map(flagText)).toEqual(["No charge since 4 Mar, may be cancelled already"]);
    expect(item.verdict).toBe("Looks cancelled");
    expect(audit.monthlyTotalPaise).toBe(0);
    expect(audit.yearlyTotalPaise).toBe(0);
  });

  it("flags two video services as an overlap", () => {
    const audit = buildAudit([
      txn("v1", "2026-05-01", -49_900, "Demo Stream One", "subscriptions"),
      txn("v2", "2026-06-01", -49_900, "Demo Stream One", "subscriptions"),
      txn("v3", "2026-07-01", -49_900, "Demo Stream One", "subscriptions"),
      txn("f1", "2026-05-02", -29_900, "Sample Flix Two", "subscriptions"),
      txn("f2", "2026-06-02", -29_900, "Sample Flix Two", "subscriptions"),
      txn("f3", "2026-07-02", -29_900, "Sample Flix Two", "subscriptions"),
    ], day(2026, 7, 20), new Set());
    expect(audit.overlaps.video).toEqual(["Demo Stream One", "Sample Flix Two"]);
    expect(audit.items.map((item) => item.name)).toEqual(["Demo Stream One", "Sample Flix Two"]);
    for (const item of audit.items) {
      expect(item.kind).toBe("video");
      expect(item.flags.map(flagText)).toEqual(["2 video services"]);
      expect(item.verdict).toBe("Worth a look");
    }
  });

  it("leaves rent, EMI, insurance and other needs out", () => {
    const blocked: [string, Category][] = [
      ["Demo Rent Co", "rent"],
      ["Demo EMI Desk", "emi"],
      ["Demo Cover Plan", "insurance"],
      ["Demo Mart", "groceries"],
      ["Demo Pump", "fuel"],
      ["Demo Power", "utilities"],
      ["Demo Sample Fund", "investments"],
      ["Demo Transfer", "transfers"],
    ];
    const rows: Transaction[] = [];
    blocked.forEach((pair, index) => {
      rows.push(txn(`b${index}a`, "2026-05-03", -50_000, pair[0], pair[1], true));
      rows.push(txn(`b${index}b`, "2026-06-03", -50_000, pair[0], pair[1], true));
    });
    rows.push(txn("keep", "2026-06-01", -9_900, "Demo Stream Keep", "subscriptions"));
    rows.push(txn("cafe1", "2026-05-08", -4_000, "Demo Cafe Club", "dining", true));
    rows.push(txn("cafe2", "2026-06-08", -4_000, "Demo Cafe Club", "dining", true));
    rows.push(txn("show", "2026-06-02", -8_000, "Sample Cinema Once", "entertainment"));
    const names = new Set(buildAudit(rows, day(2026, 6, 20), new Set()).items.map((item) => item.name));
    expect(names.has("Demo Stream Keep")).toBe(true);
    expect(names.has("Demo Cafe Club")).toBe(true);
    expect(names.has("Demo Rent Co")).toBe(false);
    expect(names.has("Demo EMI Desk")).toBe(false);
    expect(names.has("Demo Cover Plan")).toBe(false);
    expect(names.has("Demo Mart")).toBe(false);
    expect(names.has("Demo Pump")).toBe(false);
    expect(names.has("Demo Power")).toBe(false);
    expect(names.has("Demo Sample Fund")).toBe(false);
    expect(names.has("Demo Transfer")).toBe(false);
    expect(names.has("Sample Cinema Once")).toBe(false);
  });

  it("counts planned yearly savings and the amount left", () => {
    const rows = [
      txn("s1", "2026-05-11", -30_000, "Demo Stream Plan", "subscriptions"),
      txn("s2", "2026-06-11", -30_000, "Demo Stream Plan", "subscriptions"),
      txn("s3", "2026-07-11", -30_000, "Demo Stream Plan", "subscriptions"),
      txn("t1", "2026-05-12", -10_000, "Sample Tunes Plan", "subscriptions"),
      txn("t2", "2026-06-12", -10_000, "Sample Tunes Plan", "subscriptions"),
      txn("t3", "2026-07-12", -10_000, "Sample Tunes Plan", "subscriptions"),
    ];
    const audit = buildAudit(rows, day(2026, 7, 20), new Set(["demo stream plan", "missing"]));
    expect(audit.items.map((item) => item.yearlyPaise)).toEqual([360_000, 120_000]);
    expect(audit.monthlyTotalPaise).toBe(40_000);
    expect(audit.yearlyTotalPaise).toBe(480_000);
    expect(audit.plannedSavingsYearlyPaise).toBe(360_000);
    expect(audit.yearlyAfterPlanPaise).toBe(120_000);
  });

  it("toggles a planned cancel on and off", () => {
    const start = emptyWow();
    const on = togglePlanned(start, "demo stream plan");
    expect(on.plannedCancels).toEqual(["demo stream plan"]);
    expect(start.plannedCancels).toEqual([]);
    const both = togglePlanned(on, "sample tunes plan");
    expect(both.plannedCancels).toEqual(["demo stream plan", "sample tunes plan"]);
    const off = togglePlanned(both, "demo stream plan");
    expect(off.plannedCancels).toEqual(["sample tunes plan"]);
  });

  it("finds at least three subscriptions in the demo dataset", () => {
    const audit = buildAudit(transactions, new Date(2026, 9, 17, 12), new Set());
    expect(audit.items.length).toBeGreaterThanOrEqual(3);
  });
});
