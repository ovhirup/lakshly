import { describe, expect, it } from "vitest";
import { billsToIcs } from "@/lib/bills/ics";
import type { RadarBill } from "@/lib/bills/radar";

const bill: RadarBill = { id: "card:demo:2026-12-31", sourceId: "demo", kind: "card", name: "Demo, card; renewal\\next\nline", due: "2026-12-31", daysLeft: 1, amount: 98765400, paid: false, muted: false };
const now = new Date("2026-12-30T03:30:00Z");
const allowed = new Set([bill.id]);

describe("bill calendar export", () => {
  it("escapes text, uses CRLF and an exclusive all-day end date", () => {
    const text = billsToIcs([bill], allowed, now);
    expect(text).toContain("SUMMARY:Demo\\, card\\; renewal\\\\next\\nline\r\n");
    expect(text).toContain("DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101");
    expect(text).toContain("UID:" + bill.id + "@lakshly.local");
    expect(text).toContain("TRIGGER:-P3D");
    expect(text.replace(/\r\n/g, "")).not.toContain("\n");
    expect(text).not.toContain("₹");
    expect(text).not.toContain("987654");
  });
  it("includes amounts only with explicit consent and the selected lead time", () => {
    const text = billsToIcs([bill], allowed, now, { leadDays: 7, amountsInAlerts: true });
    expect(text).toContain("₹");
    expect(text).toContain("TRIGGER:-P7D");
  });
  it("exports only allowed unpaid unmuted bills", () => {
    const bills = Array.from({ length: 5 }, (_, index) => ({ ...bill, id: "demo-" + index }));
    const firstThree = new Set(bills.slice(0, 3).map((item) => item.id));
    expect(billsToIcs(bills, firstThree, now).match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(billsToIcs([{ ...bill, paid: true }, { ...bill, muted: true }], allowed, now)).not.toContain("BEGIN:VEVENT");
  });
  it("folds Unicode content at 75 octets without losing text", () => {
    const name = "Demo " + "नमस्ते".repeat(40);
    const text = billsToIcs([{ ...bill, name }], allowed, now);
    for (const line of text.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(text.replace(/\r\n /g, "")).toContain("SUMMARY:" + name);
  });
});
