// Weekly review + Worth-it: golden tests on a SYNTHETIC fixture written for this repo (no real data).
import { describe, expect, it } from "vitest";
import {
  applyAction, buildInbox, canUndo, countLabel, emptyState, isoWeek, levelFor, monthlyRatio, normaliseState, overlayDecisions, type ReviewCtx,
  questFor, regretMerchants, streakText, weekMonday, type ReviewAction, type ReviewState, type ReviewTxn,
} from "../lib/review";

const tx = (id: string, date: string, amount: number, merchant: string, category: ReviewTxn["category"], extra: Partial<ReviewTxn> = {}): ReviewTxn =>
  ({ id, accountId: "acc_demo1", date, amount, description: merchant, merchant, category, categorisedBy: "rule", ...extra });

// Week 2026-W45 = Mon 2 Nov .. Sun 8 Nov 2026. "now" = Sunday 8 Nov 2026, 19:00 local.
const NOW = new Date(2026, 10, 8, 19, 0, 0);
const TXNS: ReviewTxn[] = [
  tx("t_veg1", "2026-11-02", -64000, "Demo Veggie Cart", "groceries", { nwv: "need" }),
  tx("t_late1", "2026-11-02", -38000, "Midnight Momo Delivery", "dining", { nwv: "vice" }),
  tx("t_gift1", "2026-11-03", -20000, "UPI Ravi (demo)", "other", { nwv: "want" }),
  tx("t_bus1", "2026-11-03", -30000, "Demo Bus Pass", "transport"),
  tx("t_tv1", "2026-11-04", -14900, "Sample Stream Box", "subscriptions", { recurring: true }),
  tx("t_shoe1", "2026-11-04", -329900, "Example Shoe Studio", "shopping"),
  tx("t_xfer1", "2026-11-05", -500000, "Self transfer", "transfers"),
  tx("t_sal1", "2026-11-05", 7000000, "Demo Employer", "income"),
  tx("t_ref1", "2026-11-06", 29900, "Example Shoe Studio", "shopping", { tags: ["refund"] }),
  tx("t_pow1", "2026-11-06", -99000, "Demo Power Co", "utilities", { recurring: true }),
  tx("t_med1", "2026-11-07", -25000, "Sample Chemist", "health"),
  tx("t_cafe1", "2026-11-07", -18000, "Demo Filter Coffee", "dining"),
  tx("t_user1", "2026-11-07", -45000, "Demo Book Shop", "education", { categorisedBy: "user" }),
  tx("t_old1", "2026-09-20", -52000, "Sample Mart (old import)", "shopping"),
  tx("t_prev1", "2026-11-01", -11100, "Before last review", "dining"),
];
const BEFORE: ReviewState = normaliseState({
  v: 1, lastReviewedAt: "2026-11-01T20:00:00+05:30", lastClearedWeek: "2026-W44", streak: 2, bestStreak: 6, freezesLeft: 1,
  xp: 100, weekXP: { "2026-W45": 0 }, decisions: { t_prev1: { category: "dining", nwv: "want", action: "confirm", at: "2026-11-01T20:00:00+05:30" } }, merchantRules: {},
});
const OPTS = { importedAt: { t_old1: "2026-11-08T10:00:00+05:30" } };
const ctx = { txns: TXNS, now: NOW, opts: OPTS };
const run = (s: ReviewState, actions: ReviewAction[], c: ReviewCtx = ctx) => actions.reduce((st, a) => applyAction(st, a, c).state, s);

const SESSION: ReviewAction[] = [
  { type: "confirm", tx: "t_veg1" }, { type: "confirm", tx: "t_bus1" }, { type: "confirm", tx: "t_tv1" }, { type: "confirm", tx: "t_pow1" },
  { type: "confirm", tx: "t_med1" }, { type: "change", tx: "t_gift1", category: "gifts", nwv: "want", rememberMerchant: true },
  { type: "change", tx: "t_late1", category: "dining", nwv: "want" }, { type: "skip", tx: "t_shoe1" }, { type: "confirm", tx: "t_ref1" },
  { type: "confirm", tx: "t_cafe1" }, { type: "confirm", tx: "t_shoe1" },
];

describe("ISO weeks", () => {
  it("computes week ids and Mondays", () => {
    expect(isoWeek("2026-11-08")).toBe("2026-W45");
    expect(isoWeek("2026-11-02")).toBe("2026-W45");
    expect(isoWeek("2026-01-01")).toBe("2026-W01");
    expect(isoWeek("2027-01-01")).toBe("2026-W53");
    expect(weekMonday("2026-W45")).toBe("2026-11-02");
  });
});

describe("buildInbox", () => {
  it("includes the right 10 rows, newest first, stable within a day", () => {
    const inbox = buildInbox(TXNS, BEFORE, NOW, OPTS);
    expect(inbox.week).toBe("2026-W45");
    expect(inbox.rows.map((r) => r.tx.id)).toEqual(["t_med1", "t_cafe1", "t_ref1", "t_pow1", "t_tv1", "t_shoe1", "t_gift1", "t_bus1", "t_veg1", "t_late1"]);
    expect(inbox.count).toBe(10);
  });
  it("excludes transfers, income, user-categorised and decided rows; old imports go to Older imports", () => {
    const inbox = buildInbox(TXNS, BEFORE, NOW, OPTS);
    const ids = inbox.rows.map((r) => r.tx.id);
    for (const id of ["t_xfer1", "t_sal1", "t_user1", "t_prev1", "t_old1"]) expect(ids).not.toContain(id);
    expect(inbox.older.map((r) => r.tx.id)).toEqual(["t_old1"]);
  });
  it("first run shows only the last 7 days", () => {
    const ids = buildInbox(TXNS, emptyState(), NOW, OPTS).rows.map((r) => r.tx.id);
    expect(ids).toContain("t_veg1");
    expect(ids).toContain("t_prev1");
    expect(buildInbox(TXNS, emptyState(), new Date(2026, 10, 12, 9), OPTS).rows.map((r) => r.tx.id)).not.toContain("t_veg1");
  });
  it("suggests NWV from the category when a row has none; refunds have no NWV", () => {
    const rows = buildInbox(TXNS, BEFORE, NOW, OPTS).rows;
    const by = (id: string) => rows.find((r) => r.tx.id === id)!;
    expect(by("t_bus1").suggestion).toEqual({ category: "transport", nwv: "need" });
    expect(by("t_shoe1").suggestion).toEqual({ category: "shopping", nwv: "want" });
    expect(by("t_ref1").suggestion.nwv).toBeNull();
    expect(by("t_ref1").refund).toBe(true);
  });
  it("caps the badge label at 50+", () => {
    expect(countLabel(50)).toBe("50");
    expect(countLabel(51)).toBe("50+");
  });
});

describe("applyAction", () => {
  it("full session: XP, streak, merchant rule and inbox zero", () => {
    const s = run(BEFORE, SESSION);
    expect(buildInbox(TXNS, s, NOW, OPTS).count).toBe(0);
    // 8 confirms (+8) + 2 changes (+4) + cleared (+15) + streak bonus 5×min(3,4) (+15) = 42
    expect(s.weekXP["2026-W45"]).toBe(42);
    expect(s.xp).toBe(142);
    expect([s.streak, s.bestStreak, s.freezesLeft, s.lastClearedWeek]).toEqual([3, 6, 1, "2026-W45"]);
    expect(s.merchantRules).toEqual({ "upi ravi (demo)": { category: "gifts", nwv: "want" } });
    expect(Object.keys(s.decisions)).toHaveLength(11);
    expect(s.decisions.t_ref1).toMatchObject({ category: "shopping", nwv: null, action: "confirm" });
    expect(s.decisions.t_late1).toMatchObject({ category: "dining", nwv: "want", action: "change" });
  });
  it("announces the clear with the week number", () => {
    const s = run(BEFORE, SESSION.slice(0, -1));
    const r = applyAction(s, SESSION[SESSION.length - 1], ctx);
    expect(r.cleared).toBe(true);
    expect(r.message).toBe("Inbox zero. Week 45 done ✨");
    expect(r.streakBonus).toBe(15);
  });
  it("a new transaction after inbox zero reopens the inbox without undoing the clear", () => {
    const s = run(BEFORE, SESSION);
    const more = [...TXNS, tx("t_veg2", "2026-11-08", -21000, "Demo Veggie Cart", "groceries")];
    expect(buildInbox(more, s, NOW, OPTS).count).toBe(1);
    const s2 = applyAction(s, { type: "confirm", tx: "t_veg2" }, { ...ctx, txns: more });
    expect(s2.cleared).toBe(false); // already cleared this week: no second bonus
    expect(s2.state.lastClearedWeek).toBe("2026-W45");
    expect(s2.state.xp).toBe(143);
  });
  it("merchant rules feed later suggestions but never rewrite past decisions", () => {
    const s = run(BEFORE, SESSION);
    const more = [...TXNS, tx("t_gift2", "2026-11-08", -10000, "UPI Ravi (demo)", "other")];
    expect(buildInbox(more, s, NOW, OPTS).rows[0].suggestion).toEqual({ category: "gifts", nwv: "want" });
    expect(s.decisions.t_prev1.category).toBe("dining");
  });
  it("skip moves a row to the bottom and keeps it in the inbox", () => {
    const s = run(BEFORE, [{ type: "skip", tx: "t_med1" }]);
    const ids = buildInbox(TXNS, s, NOW, OPTS).rows.map((r) => r.tx.id);
    expect(ids[ids.length - 1]).toBe("t_med1");
    expect(ids).toHaveLength(10);
  });
  it("pressing 2 (Want) on a Need suggestion counts as a change", () => {
    const r = applyAction(BEFORE, { type: "confirm", tx: "t_bus1", nwv: "want" }, ctx);
    expect(r.state.decisions.t_bus1).toMatchObject({ nwv: "want", action: "change" });
    expect(r.xpGained).toBe(2);
  });
  it("refund rows confirm only (no NWV), even via change", () => {
    const r = applyAction(BEFORE, { type: "change", tx: "t_ref1", category: "gifts", nwv: "vice" }, ctx);
    expect(r.state.decisions.t_ref1).toMatchObject({ category: "shopping", nwv: null, action: "confirm" });
  });
  it("Older imports can be confirmed but earn no XP", () => {
    const r = applyAction(BEFORE, { type: "confirm", tx: "t_old1" }, ctx);
    expect(r.state.decisions.t_old1).toBeDefined();
    expect(r.xpGained).toBe(0);
  });
  it("confirm all confirms every remaining row", () => {
    const r = applyAction(BEFORE, { type: "confirmAll" }, ctx);
    expect(buildInbox(TXNS, r.state, NOW, OPTS).count).toBe(0);
    expect(r.cleared).toBe(true);
    expect(r.state.weekXP["2026-W45"]).toBe(10 + 15 + 15);
  });
  it("the weekly cap holds at 60", () => {
    const many: ReviewTxn[] = Array.from({ length: 70 }, (_, i) => tx(`m${i}`, "2026-11-05", -1000 - i, `Demo Stall ${i}`, "dining"));
    const c = { txns: many, now: NOW };
    const s = run(BEFORE, many.map((t) => ({ type: "change", tx: t.id, category: "dining", nwv: "want" }) as ReviewAction), c);
    expect(s.weekXP["2026-W45"]).toBe(60);
    expect(s.xp).toBe(160);
  });
  it("undo restores the row and the XP within 5 s only", () => {
    const r = applyAction(BEFORE, { type: "confirm", tx: "t_veg1" }, ctx);
    const entry = { prev: BEFORE, at: 1_000, message: r.message };
    expect(canUndo(entry, 5_900)).toBe(true);
    expect(canUndo(entry, 6_100)).toBe(false);
    expect(buildInbox(TXNS, entry.prev, NOW, OPTS).count).toBe(10);
    expect(entry.prev.xp).toBe(100);
  });
});

describe("streaks and freezes", () => {
  const weekTxn = (week: number) => [tx(`w${week}`, weekMonday(`2026-W${week}`), -5000, "Demo Kiosk", "groceries")];
  const clearAt = (s: ReviewState, week: number) => {
    const day = weekMonday(`2026-W${week}`);
    const [y, m, d] = day.split("-").map(Number);
    const c = { txns: weekTxn(week), now: new Date(y, m - 1, d + 6, 19) };
    return applyAction({ ...s, lastReviewedAt: null }, { type: "confirmAll" }, c).state;
  };
  const after = run(BEFORE, SESSION); // cleared W45, streak 3, 1 freeze
  it("skipping one week with a freeze keeps the streak", () => {
    expect(clearAt(after, 47)).toMatchObject({ streak: 4, freezesLeft: 0 });
  });
  it("one freeze covers one missed week only", () => {
    expect(clearAt(after, 48)).toMatchObject({ streak: 1, freezesLeft: 0 });
  });
  it("skipping with no freeze resets to 1 on the next clear", () => {
    expect(clearAt({ ...after, freezesLeft: 0 }, 47)).toMatchObject({ streak: 1, freezesLeft: 0 });
  });
  it("freezes refill at 1 per 4 cleared weeks, max 1", () => {
    let s: ReviewState = { ...after, freezesLeft: 0, clearsTowardFreeze: 1 };
    for (const w of [46, 47, 48]) s = clearAt(s, w);
    expect(s.freezesLeft).toBe(1);
    expect(s.streak).toBe(6);
  });
  it("streak copy is gentle", () => {
    expect(streakText(after, NOW)).toBe("🔥 3-week streak");
    expect(streakText(after, new Date(2026, 11, 20))).toBe("Streak resting. Pick it up anytime 🌱");
  });
});

describe("Worth it", () => {
  const WT: ReviewTxn[] = [
    tx("w1", "2026-10-03", -40000, "Midnight Momo Delivery", "dining", { nwv: "vice" }),
    tx("w2", "2026-10-10", -42000, "Midnight Momo Delivery", "dining", { nwv: "vice" }),
    tx("w3", "2026-10-17", -39000, "Midnight Momo Delivery", "dining", { nwv: "want" }),
    tx("w4", "2026-10-18", -250000, "Example Shoe Studio", "shopping", { nwv: "want" }),
    tx("w5", "2026-10-24", -60000, "Demo Cinema Hall", "entertainment", { nwv: "want" }),
    tx("w6", "2026-10-25", -70000, "Demo Veggie Cart", "groceries", { nwv: "need" }),
  ];
  const s = normaliseState({ worth: { w1: "no", w2: "no", w3: "no", w4: "yes", w5: "yes", w6: "yes" } });
  it("monthly ratio over Wants+Vices only (Needs excluded)", () => {
    expect(monthlyRatio(WT, s, "2026-10")).toEqual({ month: "2026-10", rated: 5, yes: 2, no: 3, ratio: 0.4 });
  });
  it("needs at least 5 ratings", () => {
    expect(monthlyRatio(WT.slice(0, 4), s, "2026-10").ratio).toBeNull();
  });
  it("regret merchants: ≥3 'no' and ≥60% within 60 days, mapped to a quest suggestion", () => {
    const r = regretMerchants(WT, s, new Date(2026, 10, 1));
    expect(r).toEqual(["Midnight Momo Delivery"]);
    expect(questFor(r[0], "dining", false).id).toBe("no_delivery_week");
    expect(questFor("Example Shoe Studio", "shopping", false).id).toBe("wishlist_three");
    expect(questFor("Example Shoe Studio", "shopping", true).premium).toBe(true);
    expect(regretMerchants(WT, s, new Date(2027, 0, 30))).toEqual([]);
  });
  it("re-tagging a rated Want as a Need keeps the rating but drops it from ratios", () => {
    const s2 = { ...s, decisions: { w4: { category: "shopping" as const, nwv: "need" as const, action: "change" as const, at: "x" } } };
    expect(monthlyRatio(WT, s2, "2026-10")).toMatchObject({ rated: 4, ratio: null });
    expect(s2.worth.w4).toBe("yes");
  });
  it("rating never changes XP", () => {
    const r = applyAction(BEFORE, { type: "rate", tx: "t_late1", worth: "no" }, ctx);
    expect(r.state.xp).toBe(BEFORE.xp);
    expect(r.state.weekXP).toEqual(BEFORE.weekXP);
    expect(r.state.worth.t_late1).toBe("no");
    const withRatings = run(BEFORE, [{ type: "rate", tx: "t_late1", worth: "no" }, { type: "rate", tx: "t_shoe1", worth: "yes" }, ...SESSION]);
    const without = run(BEFORE, SESSION);
    expect(withRatings.xp).toBe(without.xp);
    expect(withRatings.weekXP).toEqual(without.weekXP);
    expect(withRatings.decisions.t_shoe1.worth).toBe("yes");
    const cleared = applyAction(withRatings, { type: "rate", tx: "t_shoe1", worth: null }, ctx).state;
    expect(cleared.worth.t_shoe1).toBeUndefined();
    expect(cleared.decisions.t_shoe1.worth).toBeUndefined();
  });
});

describe("overlay + levels", () => {
  it("decisions overlay category and mark rows user-categorised, without mutating input", () => {
    const s = run(BEFORE, SESSION);
    const out = overlayDecisions(TXNS, s);
    expect(out.find((t) => t.id === "t_gift1")).toMatchObject({ category: "gifts", categorisedBy: "user" });
    expect(TXNS.find((t) => t.id === "t_gift1")!.category).toBe("other");
  });
  it("levels come from the shared table", () => {
    expect(levelFor(0).current.level).toBe(1);
    expect(levelFor(160).current.name).toBe("Bud");
    expect(levelFor(99999).next).toBeNull();
  });
});
