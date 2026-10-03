// Badges + nudge engine. Golden values come from the SYNTHETIC demo dataset; guard tests use hand-made inputs.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dataset } from "../lib/data";
import { demoNow, demoSeed } from "../components/useReview";
import { effectiveNwv, overlayDecisions, type ReviewTxn } from "../lib/review";
import { applyXp, buildFacts, emptyLedger, evaluate, ledgerKey, mergeLedger, nextUp, renderEvidence, RULES, RULE_TYPES, type BadgeEval, type Ledger } from "../lib/badges";
import { CATALOG, decide, renderNudge, type Candidate, type CoachPrefs, type EngineInput, type LogEntry } from "../lib/nudges";
import { can, FEATURES, FREE_BILL_OF_RIGHTS } from "../lib/entitlements";

const seed = demoSeed(dataset);
const now = demoNow(dataset);
const facts = (clearedWeeks = seed.clearedWeeks) => buildFacts({
  transactions: overlayDecisions(dataset.transactions as ReviewTxn[], seed), budgets: dataset.budgets ?? [], debts: dataset.debts ?? [], sips: dataset.sips ?? [],
  accounts: dataset.accounts, clearedWeeks, nwvOf: (t) => effectiveNwv(t, seed), now,
});
const earnedKeys = (ev: BadgeEval[]) => ev.flatMap((e) => e.earned.map((u) => `${ledgerKey(u)}:${u.xp}`));

describe("badge engine on the demo (golden)", () => {
  const ev = evaluate(facts());
  it("earns the expected tiers", () => {
    expect(earnedKeys(ev)).toEqual([
      "category_tamer:bronze:25", "no_delivery_week:bronze:20", "no_delivery_week:silver:30", "no_delivery_week:gold:50",
      "emi_on_time:bronze:20", "emi_on_time:silver:40", "slice_cleared:bronze:debt_mpvx35xy:25", "slice_cleared:silver:debt_mpvx35xy:25",
      "sip_steady:bronze:20", "sip_steady:silver:40", "emergency_ready:bronze:30", "emergency_ready:silver:60",
    ]);
  });
  it("Next up shows the closest tiers (≥ 60%)", () => {
    expect(nextUp(ev).map((p) => [p.id, p.tier, Math.round(p.pct * 100)])).toEqual([["slice_cleared", "gold", 79], ["emergency_ready", "gold", 76], ["inbox_zero", "bronze", 75]]);
  });
  it("clearing the demo week unlocks Inbox zero bronze", () => {
    const xp = RULES.badges.find((b) => b.id === "inbox_zero")!.tiers[0].xp;
    expect(earnedKeys(evaluate(facts()))).not.toContain(`inbox_zero:bronze:${xp}`);
    expect(earnedKeys(evaluate(facts([...seed.clearedWeeks, "2026-W40"])))).toContain(`inbox_zero:bronze:${xp}`);
  });
  it("every rule type has an evaluator, except the ones marked not yet available", () => {
    const missing = RULES.badges.filter((b) => !RULE_TYPES.includes(b.rule.type)).map((b) => b.id);
    expect(ev.filter((e) => !e.evaluable).map((e) => e.id)).toEqual(expect.arrayContaining(missing));
  });
  it("evidence renders money only through the formatter (masks with privacy mode)", () => {
    for (const e of ev) for (const u of e.earned) expect(renderEvidence(u.evidence, () => "••••")).not.toMatch(/₹\s?\d/);
  });
});

describe("ledger: badges are never revoked", () => {
  const ev = evaluate(facts());
  it("first run is history (backfill); later unlocks are live; nothing is removed or rewritten", () => {
    const { ledger, added } = mergeLedger(emptyLedger(), ev, "2026-10-01");
    expect(added.length).toBe(12);
    expect(added.every((a) => a.backfill)).toBe(true);
    // The data changes and nothing qualifies any more: the ledger keeps every entry untouched.
    const again = mergeLedger(ledger, [], "2026-10-08");
    expect(again.added).toEqual([]);
    expect(again.ledger.entries).toEqual(ledger.entries);
    // Re-evaluating doesn't move firstSeen.
    const third = mergeLedger(ledger, ev, "2026-11-01");
    expect(third.added).toEqual([]);
    expect(Object.values(third.ledger.entries).every((e) => e.firstSeen === "2026-10-01")).toBe(true);
  });
  it("a new unlock after the first run is live, not backfill", () => {
    const { ledger } = mergeLedger(emptyLedger(), [], "2026-10-01");
    const { added } = mergeLedger(ledger, ev.slice(0, 2), "2026-10-02");
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((a) => !a.backfill)).toBe(true);
  });
});

describe("XP", () => {
  const entry = (id: string, xp: number, firstSeen: string, backfill: boolean) => ({ id, tier: "bronze" as const, date: firstSeen, evidence: { t: "x" }, firstSeen, xp, backfill });
  it("history bonus is capped at 250", () => {
    const l: Ledger = { ...emptyLedger(), entries: Object.fromEntries([...Array(10)].map((_, i) => [`h${i}`, entry(`h${i}`, 40, "2026-10-01", true)])) };
    expect(applyXp(l, "2026-10-01")).toMatchObject({ historyEarned: 400, historyBonus: 250, paid: 0, total: 250 });
  });
  it("live XP is paid at most 80 per ISO week; overflow is banked and paid later", () => {
    const l: Ledger = { ...emptyLedger(), entries: { a: entry("a", 60, "2026-10-05", false), b: entry("b", 60, "2026-10-06", false) } };
    expect(applyXp(l, "2026-10-07")).toMatchObject({ paid: 80, banked: 40, total: 80 });
    expect(applyXp(l, "2026-10-12")).toMatchObject({ paid: 120, banked: 0, total: 120 });
  });
  it("Premium can't buy XP or badges", () => {
    expect(RULES.xp.premiumCanBuy).toBe(false);
    const src = readFileSync(new URL("../lib/badges.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/entitlements|useTier|lakshly\.plan/);
    expect(can("badges.core", "free")).toBe(true);
    expect(FREE_BILL_OF_RIGHTS).toContain("badges.core");
    // Premium-only badge features are cosmetic.
    const premium = Object.entries(FEATURES).filter(([id, f]) => id.startsWith("badges.") && f.minTier !== "free").map(([id]) => id).sort();
    expect(premium).toEqual(["badges.animatedFrames", "badges.themes"]);
    // Same facts → same unlocks and XP; nothing reads the plan.
    expect(earnedKeys(evaluate(facts()))).toEqual(earnedKeys(evaluate(facts())));
  });
});

describe("nudge catalog lint", () => {
  const moneyKeys = CATALOG.maskPlaceholders;
  it("no banned words in any template or trigger", () => {
    for (const n of CATALOG.nudges) {
      const texts = [n.trigger, ...Object.values(n.templates).flatMap((t) => (t ? [t.text, t.masked] : []))].join(" ").toLowerCase();
      for (const w of CATALOG.bannedWords) expect(texts, `${n.id} uses "${w}"`).not.toContain(w);
    }
  });
  it("masked templates never contain money placeholders; every nudge has hype + straight", () => {
    for (const n of CATALOG.nudges) {
      expect(n.templates.hype && n.templates.straight).toBeTruthy();
      for (const t of Object.values(n.templates)) if (t) for (const k of moneyKeys) expect(t.masked, `${n.id}`).not.toContain(k);
    }
  });
  it("renders a masked nudge without any amount", () => {
    const d = CATALOG.nudges.find((n) => n.id === "pace_over")!;
    const c: Candidate = { id: "pace_over", subject: "dining", vars: { category: "Dining", usedPct: "80%", day: 10, dim: 30 }, money: { spent: 400000, budget: 500000 } };
    expect(renderNudge(d, c, "straight", true, () => "₹9,999")).not.toMatch(/₹/);
    expect(renderNudge(d, c, "straight", false, (p) => `₹${p / 100}`)).toContain("₹4000");
  });
});

describe("nudge engine guards", () => {
  const NOW = new Date("2026-10-01T19:00:00+05:30");
  const prefs: CoachPrefs = { v: 1, tone: "straight", sources: {} };
  const base = (over: Partial<EngineInput> = {}): EngineInput => ({ candidates: [], log: [], prefs, now: NOW, historyDays: 180, premium: false, roastOff: false, ...over });
  const pace: Candidate = { id: "pace_over", subject: "dining", vars: { category: "Dining", usedPct: "80%", day: 1, dim: 31 }, money: { spent: 1, budget: 2 } };
  const review: Candidate = { id: "review_waiting", subject: "2026-W40", vars: { count: 5 } };
  const near: Candidate = { id: "near_badge", subject: "slice_cleared:gold", vars: { badge: "Slice cleared", pct: "79%" } };
  const log = (id: string, subject: string, at: string, action: LogEntry["action"], polarity: LogEntry["polarity"]): LogEntry => ({ id, subject, at, action, polarity });

  it("shows at most one nudge, preferring the highest priority", () => {
    const d = decide(base({ candidates: [review, near, pace] }));
    expect(d.shown?.id).toBeDefined();
    expect(d.suppressed.filter((s) => s.reason === "maxShownPerDay").length).toBe(2);
  });
  it("a different nudge already shown today blocks new ones; the same one stays", () => {
    const l = [log("review_waiting", "2026-W40", "2026-10-01T09:00:00+05:30", "shown", "info")];
    expect(decide(base({ candidates: [near], log: l })).shown).toBeNull();
    expect(decide(base({ candidates: [review], log: l })).shown?.id).toBe("review_waiting");
  });
  it("negative nudges need 30 days of data", () => {
    const d = decide(base({ candidates: [pace], historyDays: 20 }));
    expect(d.shown).toBeNull();
    expect(d.suppressed[0].reason).toBe("minHistory");
  });
  it("Not now snoozes for 7 days; turning a source off silences it", () => {
    const l = [log("pace_over", "dining", "2026-09-28T10:00:00+05:30", "notNow", "negative")];
    expect(decide(base({ candidates: [pace], log: l })).suppressed[0].reason).toBe("snoozed");
    expect(decide(base({ candidates: [pace], log: l, now: new Date("2026-10-06T10:00:00+05:30") })).shown?.id).toBe("pace_over");
    expect(decide(base({ candidates: [pace], prefs: { ...prefs, sources: { pace: false } } })).suppressed[0].reason).toBe("sourceOff");
  });
  it("at most 3 negative nudges a week", () => {
    const l = ["2026-09-28", "2026-09-29", "2026-09-30"].map((d, i) => log("delivery_burst", `s${i}`, `${d}T10:00:00+05:30`, "shown", "negative"));
    expect(decide(base({ candidates: [pace], log: l })).suppressed[0].reason).toBe("negativePerWeek");
  });
  it("Roast-lite is Premium; Free falls back to Straight", () => {
    expect(decide(base({ candidates: [review], prefs: { ...prefs, tone: "roast" } })).tone).toBe("straight");
    expect(decide(base({ candidates: [review], prefs: { ...prefs, tone: "roast" }, premium: true })).tone).toBe("roast");
  });
  it("guardrail: mostly-snoozed negatives switch to Straight and one a week", () => {
    const l: LogEntry[] = [];
    for (let i = 0; i < 4; i++) {
      const at = `2026-09-${String(10 + i * 3).padStart(2, "0")}T10:00:00+05:30`;
      l.push(log("delivery_burst", `g${i}`, at, "shown", "negative"), log("delivery_burst", `g${i}`, at, "notNow", "negative"));
    }
    const d = decide(base({ candidates: [review], log: l, prefs: { ...prefs, tone: "hype" } }));
    expect(d.guardrail).toBe(true);
    expect(d.tone).toBe("straight");
    expect(d.toneNotice).toBeTruthy();
  });
});
