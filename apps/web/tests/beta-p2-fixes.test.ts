// Codex review P2/P1 fixes (PRs #20-#22). Synthetic fixtures only.
import { describe, expect, it } from "vitest";
import { applyAction, buildInbox, emptyState, isRefund, normaliseState, type ReviewTxn } from "../lib/review";
import { EMPTY_FLAGS, parseFlags, serialiseFlags } from "../lib/setup";
import { maskPctText, PCT_MASK, setFormatMask } from "../lib/privacy";
import { formatPct } from "../lib/format";

const tx = (id: string, date: string, amount: number, merchant: string, category: ReviewTxn["category"], extra: Partial<ReviewTxn> = {}): ReviewTxn =>
  ({ id, accountId: "acc_demo1", date, amount, description: merchant, merchant, category, categorisedBy: "rule", ...extra });
const NOW = new Date(2026, 10, 8, 19, 0, 0);

describe("refunds from parsed statements (no refund tag)", () => {
  it("recognises refund wording and credits in a spending category", () => {
    expect(isRefund(tx("a", "2026-11-06", 29900, "REFUND Example Shoe Studio", "other"))).toBe(true);
    expect(isRefund(tx("b", "2026-11-06", 29900, "Example Shoe Studio", "shopping"))).toBe(true);
    expect(isRefund(tx("c", "2026-11-06", 29900, "Reversal UPI demo", "other"))).toBe(true);
  });
  it("does not treat income, transfers or debits as refunds", () => {
    expect(isRefund(tx("d", "2026-11-06", 7000000, "Demo Employer", "income"))).toBe(false);
    expect(isRefund(tx("e", "2026-11-06", 500000, "Self transfer", "transfers"))).toBe(false);
    expect(isRefund(tx("f", "2026-11-06", -29900, "Example Shoe Studio", "shopping"))).toBe(false);
  });
});

describe("weekly clear needs a regular inbox row", () => {
  it("confirming only an older late import awards no clear or streak bonus", () => {
    const txns = [tx("t_old1", "2026-09-20", -52000, "Sample Mart (old import)", "shopping")];
    const s = normaliseState({ lastReviewedAt: "2026-11-01T20:00:00+05:30", lastClearedWeek: "2026-W44", streak: 2 });
    const opts = { importedAt: { t_old1: "2026-11-08T10:00:00+05:30" } };
    const inbox = buildInbox(txns, s, NOW, opts);
    expect(inbox.count).toBe(0);
    expect(inbox.older.length).toBe(1);
    const r = applyAction(s, { type: "confirm", tx: "t_old1" }, { txns, now: NOW, opts });
    expect(r.cleared).toBe(false);
    expect(r.xpGained).toBe(0);
    expect(r.state.streak).toBe(2);
  });
});

describe("worth-it snoozes live in the encrypted review record", () => {
  it("snooze action stores merchant -> until and survives normalise", () => {
    const r = applyAction(emptyState(), { type: "snooze", merchant: "Demo Momo", until: "2026-12-08T00:00:00.000Z" }, { txns: [], now: NOW });
    expect(r.state.snoozed).toEqual({ "Demo Momo": "2026-12-08T00:00:00.000Z" });
    expect(normaliseState(JSON.parse(JSON.stringify(r.state))).snoozed).toEqual(r.state.snoozed);
    expect(normaliseState({}).snoozed).toEqual({});
  });
});

describe("setup flags mirror completion", () => {
  it("round-trips complete and never leaks other fields", () => {
    const f = parseFlags(serialiseFlags({ ...EMPTY_FLAGS, seen: true, mode: "mine", percent: 66, complete: true }));
    expect(f.complete).toBe(true);
    expect(parseFlags(serialiseFlags({ ...EMPTY_FLAGS, percent: 66 })).complete).toBeUndefined();
  });
});

describe("also hide percentages", () => {
  it("masks percentages inside generated text and formatPct", () => {
    setFormatMask(true, true);
    expect(maskPctText("Wants at 30% or less (best so far 42%)")).toBe(`Wants at ${PCT_MASK} or less (best so far ${PCT_MASK})`);
    expect(formatPct(10.5, 2)).toBe(PCT_MASK);
    setFormatMask(true, false);
    expect(maskPctText("Loan: 40% repaid")).toBe("Loan: 40% repaid");
    setFormatMask(false, false);
  });
});

describe("privacy Hide works when storage is blocked", () => {
  it("falls back to memory when localStorage throws", async () => {
    const g = globalThis as unknown as { localStorage?: unknown };
    const prev = g.localStorage;
    g.localStorage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    try {
      const { __privacyStore } = await import("../components/Privacy");
      __privacyStore.reset();
      expect(__privacyStore.read().on).toBe(false);
      __privacyStore.write({ ...__privacyStore.read(), on: true });
      expect(__privacyStore.read().on).toBe(true);
      __privacyStore.reset();
    } finally { g.localStorage = prev; }
  });
});
