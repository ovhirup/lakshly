import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATALOG } from "../lib/sources.gen";
import {
  attribute, checklist, currentStep, detectProvider, dueStatements, EMPTY_FLAGS, findSource, freshness, freshnessNotice, gmailQuery, gmailUrl, initialSetup, isFirstRun,
  markCompletion, outlookOpenUrl, outlookQuery, parseFlags, progressOf, serialiseFlags, setupReducer, type SetupAction, type SetupState,
} from "../lib/setup";
import { budgetId, completeMonths, goalFacts, median, roundBudget, suggestBudget, suggestGoal } from "../lib/setup-suggest";
import { planFor } from "../lib/selectors";
import { can, FREE_BILL_OF_RIGHTS, limit } from "../lib/entitlements";
import type { Account, Budget, Transaction } from "../lib/schema.gen";

// Synthetic fixture only: invented amounts, no real people, accounts or statements.
let n = 0;
const tx = (date: string, rupees: number, category: Transaction["category"]): Transaction => ({
  id: `txn_fix${String(++n).padStart(5, "0")}`, accountId: "acc_fixture1", date, amount: Math.round(rupees * 100), description: "SYNTHETIC", category,
});
const TODAY = "2026-10-03";
const FIXTURE: Transaction[] = [
  tx("2026-06-10", -50000, "groceries"), // older than the last 3 complete months
  tx("2026-07-05", -8123.45, "groceries"), tx("2026-08-05", -7900, "groceries"), tx("2026-09-05", -9050, "groceries"),
  tx("2026-09-06", 1500, "groceries"), // a refund: ignored
  tx("2026-07-09", -3000, "dining"), tx("2026-09-09", -4200, "dining"), // August had none: zero month counts
  tx("2026-07-11", -400, "transport"), tx("2026-08-11", -450, "transport"), // median ₹400 < ₹500: dropped
  tx("2026-07-12", -2000, "shopping"), tx("2026-08-12", -2000, "shopping"), tx("2026-09-12", -2000, "shopping"),
  tx("2026-07-01", -20000, "rent"), tx("2026-08-01", -20000, "rent"), tx("2026-09-01", -20000, "rent"), // fixed: never budgeted here
  tx("2026-10-02", -99999, "groceries"), // current, incomplete month
];
const ACCOUNTS: Account[] = [
  { id: "acc_fixture1", name: "Synthetic Savings", type: "savings", institution: "Sample Bank", currency: "INR", balance: 10000000, asOf: TODAY } as Account,
];

describe("email search links", () => {
  const bank = findSource("hdfc-bank")!;
  it("builds Gmail queries from sender domains, subjects, attachment and window", () => {
    expect(gmailQuery(bank, "statements")).toBe("from:(hdfcbank.net OR hdfcbank.com) subject:statement has:attachment newer_than:2y");
    expect(gmailQuery(findSource("hdfc-card")!, "statements")).toBe('from:(hdfcbank.net OR hdfcbank.com) subject:("credit card" OR statement) has:attachment newer_than:2y');
    expect(gmailQuery(findSource("groww")!)).toBe("from:groww.in subject:(order OR SIP OR allotment) newer_than:1y -from:digest.groww.in");
  });
  it("builds Outlook queries with a received date floor", () => {
    expect(outlookQuery(bank, TODAY, "statements")).toBe("(from:hdfcbank.net OR from:hdfcbank.com) AND subject:statement AND hasattachments:yes AND received>=2024-10-03");
    expect(outlookQuery(findSource("netflix")!, "2026-03-31")).toBe("from:netflix.com AND (subject:receipt OR subject:payment OR subject:membership) AND received>=2025-03-31");
  });
  it("opens Gmail for the right account, or the first signed-in one", () => {
    expect(gmailUrl("from:x y", " Me@Example.com ")).toBe("https://mail.google.com/mail/u/?authuser=me%40example.com#search/from%3Ax%20y");
    expect(gmailUrl("from:x")).toBe("https://mail.google.com/mail/u/0/#search/from%3Ax");
    expect(gmailUrl("from:x", "not-an-email")).toBe("https://mail.google.com/mail/u/0/#search/from%3Ax");
  });
  it("detects providers and picks the Outlook web app", () => {
    expect(detectProvider("a@gmail.com")).toBe("gmail");
    expect(detectProvider("a@HOTMAIL.com")).toBe("outlook");
    expect(detectProvider("a@icloud.com")).toBe("icloud");
    expect(detectProvider("a@example.org")).toBe("other");
    expect(detectProvider("nope")).toBeNull();
    expect(outlookOpenUrl("a@outlook.com")).toBe("https://outlook.live.com/mail/0/");
    expect(outlookOpenUrl("a@example.org")).toBe("https://outlook.office.com/mail/");
  });
});

describe("budget suggestion", () => {
  it("uses the last 3 complete months only", () => {
    expect(completeMonths(FIXTURE, TODAY)).toEqual(["2026-07", "2026-08", "2026-09"]);
  });
  it("median includes zero months, keeps ≥ ₹500 variable lines, rounds half-up (₹100 below ₹5,000, ₹500 above)", () => {
    const s = suggestBudget(FIXTURE, TODAY);
    expect(s.mode).toBe("history");
    expect(s.confidence).toBe("ok");
    expect(s.lines).toEqual([
      { category: "groceries", median: 812345, suggested: 750000 },
      { category: "dining", median: 300000, suggested: 290000 },
      { category: "shopping", median: 200000, suggested: 190000 },
    ]);
  });
  it("presets scale the suggestion; the Free line cap trims to the top lines", () => {
    expect(suggestBudget(FIXTURE, TODAY, { preset: "comfortable" }).lines[0].suggested).toBe(800000);
    expect(suggestBudget(FIXTURE, TODAY, { preset: "ambitious" }).lines[0].suggested).toBe(750000);
    expect(suggestBudget(FIXTURE, TODAY, { maxLines: 2 }).lines.map((l) => l.category)).toEqual(["groceries", "dining"]);
  });
  it("rounding is integer maths at the ₹5,000 boundary", () => {
    expect(roundBudget(499950)).toBe(500000);
    expect(roundBudget(500000)).toBe(500000);
    expect(roundBudget(524999)).toBe(500000);
    expect(roundBudget(525000)).toBe(550000);
    expect(roundBudget(5000)).toBe(10000);
    expect(roundBudget(4999)).toBe(0);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 4])).toBe(2);
  });
  it("low confidence with little history; starter mode with none", () => {
    expect(suggestBudget(FIXTURE.filter((t) => t.date >= "2026-09"), TODAY).confidence).toBe("low");
    const starter = suggestBudget(FIXTURE.filter((t) => t.date >= "2026-10"), TODAY, { maxLines: 6 });
    expect(starter.mode).toBe("starter");
    expect(starter.lines.length).toBeGreaterThan(0);
    expect(starter.lines.length).toBeLessThanOrEqual(6);
  });
  it("budget ids are deterministic and schema-valid; a monthly plan repeats", () => {
    expect(budgetId("2026-10", "groceries")).toBe("bud_202610groceries");
    expect(budgetId("2026-10", "groceries")).toMatch(/^[a-z]+_[A-Za-z0-9]{6,}$/);
    const plan: Budget[] = [{ id: "bud_202610groceries", month: "2026-10", category: "groceries", limit: 750000 }];
    expect(planFor(plan, "2026-09")).toEqual([{ ...plan[0], month: "2026-09" }]);
    expect(planFor(plan, "2026-12")[0].month).toBe("2026-12");
    expect(planFor([], "2026-09")).toEqual([]);
  });
});

describe("goal suggestion", () => {
  const now = "2026-10-03T10:00:00.000Z";
  it("emergency3 below 3 months of cover", () => {
    expect(suggestGoal({ monthlySpend: 5000000, liquid: 10000000 }, TODAY, now)).toMatchObject({ kind: "emergency3", target: 15000000, monthly: 420000 });
  });
  it("an upcoming yearly payment next", () => {
    expect(suggestGoal({ monthlySpend: 5000000, liquid: 20000000, annual: { name: "Sample Insurer", amount: 1234500, due: "2027-01-15" } }, TODAY, now))
      .toMatchObject({ kind: "annualPayment", target: 1300000, monthly: 440000, due: "2027-01-15" });
  });
  it("emergency6 below 6 months, else custom", () => {
    expect(suggestGoal({ monthlySpend: 5000000, liquid: 20000000 }, TODAY, now)).toMatchObject({ kind: "emergency6", target: 30000000, monthly: 840000 });
    expect(suggestGoal({ monthlySpend: 5000000, liquid: 40000000 }, TODAY, now).kind).toBe("custom");
  });
  it("derives facts from the data: average outflow, liquid balance, yearly insurance", () => {
    const f = goalFacts([...FIXTURE, tx("2026-01-15", -12345, "insurance")], ACCOUNTS, TODAY);
    expect(f.liquid).toBe(10000000);
    expect(f.monthlySpend).toBe(Math.round((812345 + 790000 + 905000 + 300000 + 420000 + 40000 + 45000 + 600000 + 6000000) / 3));
    expect(f.annual).toEqual({ name: "Yearly payment", amount: 1234500, due: "2027-01-15" });
  });
});

describe("wizard state + checklist", () => {
  const run = (actions: SetupAction[], s: SetupState = initialSetup("2026-10-03T00:00:00Z")) => actions.reduce(setupReducer, s);
  const facts = { name: "Asha", importCount: 0, budgetLines: 0 };

  it("current step is the first neither done nor skipped", () => {
    const s = run([{ type: "complete", step: "welcome" }, { type: "skip", step: "email" }]);
    expect(currentStep(s)).toBe("accounts");
    expect(s.at).toBe("accounts");
    expect(currentStep(run([{ type: "complete", step: "email" }]))).toBe("welcome");
  });
  it("emails are normalised, de-duplicated, validated and capped", () => {
    const s = run([{ type: "setEmails", emails: [" A@Gmail.com", "a@gmail.com", "bad", "b@example.org", "c@example.org"], max: 2 }]);
    expect(s.emails).toEqual(["a@gmail.com", "b@example.org"]);
  });
  it("custom sources get a safe id and are picked", () => {
    const s = run([{ type: "addCustom", name: "  Sample Co-op Bank ", kind: "bank" }]);
    expect(s.custom).toEqual([{ id: "custom_sample-co-op-bank", name: "Sample Co-op Bank", kind: "bank" }]);
    expect(s.picked).toEqual(["custom_sample-co-op-bank"]);
  });
  it("web checklist has 9 items; percent = floor(done × 100 / 9)", () => {
    const items = checklist(initialSetup("x"), facts);
    expect(items).toHaveLength(9);
    expect(items.filter((i) => i.required).map((i) => i.id)).toEqual(["profile", "myData", "sources", "firstImport", "budget"]);
    expect(progressOf(items)).toMatchObject({ done: 1, total: 9, percent: 11, requiredDone: false });
  });
  it("setup.completed fires exactly once, and only in mine mode", () => {
    const s = run([{ type: "start", mode: "mine" }, { type: "toggleSource", id: "hdfc-bank" }, { type: "budgetSaved" }]);
    const done = { ...facts, importCount: 1 };
    const first = markCompletion(s, checklist(s, done), "2026-10-03T12:00:00Z");
    expect(first.fired).toBe(true);
    expect(first.state.completedAt).toBe("2026-10-03T12:00:00Z");
    expect(markCompletion(first.state, checklist(first.state, done), "later").fired).toBe(false);
    const demo = run([{ type: "start", mode: "demo" }, { type: "toggleSource", id: "hdfc-bank" }, { type: "budgetSaved" }]);
    expect(markCompletion(demo, checklist(demo, done), "x").fired).toBe(false);
    expect(markCompletion(s, checklist(s, facts), "x").fired).toBe(false); // no import yet
  });
  it("allSources is done when every supported pick is imported or skipped", () => {
    const s = run([{ type: "toggleSource", id: "hdfc-bank" }, { type: "toggleSource", id: "sbi-bank" }, { type: "toggleSource", id: "lazypay" },
      { type: "imported", id: "hdfc-bank", at: "2026-10-03", periodTo: "2026-09-30" }]);
    const f = { ...facts, importCount: 1 };
    expect(checklist(s, f).find((i) => i.id === "allSources")!.done).toBe(false);
    const s2 = setupReducer(s, { type: "skipSource", id: "sbi-bank", reason: "later" });
    expect(checklist(s2, f).find((i) => i.id === "allSources")!.done).toBe(true);
    expect(setupReducer(s2, { type: "unskipSource", id: "sbi-bank" }).progress["sbi-bank"].status).toBe("todo");
  });
});

describe("statement attribution", () => {
  it("auto-attributes only on exactly one specific match", () => {
    expect(attribute("bank.hdfc", ["hdfc-bank", "sbi-bank", "axis-bank"])).toEqual({ kind: "auto", sourceId: "hdfc-bank" });
    expect(attribute("card.hdfc", ["hdfc-bank", "hdfc-card"])).toEqual({ kind: "auto", sourceId: "hdfc-card" });
    expect(attribute("cas.cams-kfintech", ["cams-cas", "groww"])).toEqual({ kind: "auto", sourceId: "cams-cas" });
  });
  it("generic adapters never auto-attribute, even with one candidate", () => {
    expect(attribute("bank.generic", ["axis-bank"])).toEqual({ kind: "ask", candidates: ["axis-bank"] });
    expect(attribute("bank.generic", ["hdfc-bank", "sbi-bank", "hdfc-card"])).toEqual({ kind: "ask", candidates: ["hdfc-bank", "sbi-bank"] });
    expect(attribute("csv.generic", ["hdfc-bank", "hdfc-card", "lazypay"], [])).toEqual({ kind: "ask", candidates: ["hdfc-bank", "hdfc-card"] });
    expect(attribute("card.generic", ["custom_x"], [{ id: "custom_x", name: "X", kind: "card" }])).toEqual({ kind: "ask", candidates: ["custom_x"] });
  });
  it("asks among same-kind picks when the specific bank wasn't picked", () => {
    expect(attribute("bank.hdfc", ["sbi-bank", "hdfc-card"])).toEqual({ kind: "ask", candidates: ["sbi-bank"] });
  });
});

describe("freshness", () => {
  const monthly = { every: "month" as const, expectedDay: 8, graceDays: 10 };
  const p = { status: "imported" as const, lastImportAt: "2026-10-01T00:00:00Z", periodTo: "2026-09-30" };
  it("fresh → due → stale → todo", () => {
    expect(freshness(p, monthly, "2026-10-03")).toBe("fresh");
    expect(freshness(p, monthly, "2026-11-09")).toBe("fresh");
    expect(freshness(p, monthly, "2026-11-10")).toBe("due");
    expect(freshness(p, monthly, "2026-12-10")).toBe("stale");
    expect(freshness(undefined, monthly, "2026-10-03")).toBe("todo");
    expect(freshness({ status: "imported", periodTo: "2026-01-31" }, { every: "year", graceDays: 30 }, "2026-10-03")).toBe("fresh");
  });
  it("lists stale statements before due ones and skips skipped sources", () => {
    const monthly = { every: "month" as const, graceDays: 10 };
    const targets = [
      { id: "hdfc-bank", name: "HDFC Bank", source: { cadence: monthly } as never },
      { id: "sbi-bank", name: "SBI", source: { cadence: monthly } as never },
      { id: "cams", name: "CAMS", source: { cadence: monthly } as never },
    ];
    const progress = {
      "hdfc-bank": { status: "imported" as const, periodTo: "2026-09-30" },
      "sbi-bank": { status: "imported" as const, periodTo: "2026-08-31" },
      cams: { status: "skipped" as const, periodTo: "2026-01-31" },
    };
    expect(dueStatements(targets, progress, "2026-11-15").map((d) => [d.id, d.freshness])).toEqual([["sbi-bank", "stale"], ["hdfc-bank", "due"]]);
    expect(dueStatements(targets, progress, "2026-10-03")).toEqual([]);
  });
  it("names the saved mailbox and only offers a Gmail check when this tab is connected", () => {
    const due = { id: "hdfc-bank", name: "HDFC Bank", freshness: "due" as const };
    expect(freshnessNotice(due, "statements@gmail.com", true).canCheck).toBe(true);
    expect(freshnessNotice(due, "statements@gmail.com", true).detail).toContain("statements@gmail.com");
    expect(freshnessNotice(due, "statements@gmail.com", true).detail).toContain("statement cycle");
    expect(freshnessNotice(due, "statements@gmail.com", false).canCheck).toBe(false);
    expect(freshnessNotice(due, "owner@outlook.com", true).canCheck).toBe(false);
    expect(freshnessNotice(due, null, false).detail).toContain("Add the email");
    expect(freshnessNotice(due, "statements@gmail.com", true).detail).not.toMatch(/₹|https?:/i);
  });
});

describe("sources catalog guard", () => {
  it("imports depository CAS (CDSL/NSDL) with the cas.depository adapter", () => {
    for (const id of ["cdsl-cas", "nsdl-cas"]) {
      const s = CATALOG.sources.find((x) => x.id === id)!;
      expect(s.importer).toMatchObject({ supported: true, adapters: ["cas.depository"], formats: ["pdf"] });
      expect(s.kinds[0]).toBe("cas");
    }
  });
  const raw = readFileSync(new URL("../../../packages/shared/setup/sources.json", import.meta.url), "utf8");
  const ADAPTERS = ["cas.cams-kfintech", "cas.depository", "bank.hdfc", "bank.sbi", "bank.icici", "card.hdfc", "card.sbi", "card.generic", "bank.generic", "csv.generic"];
  it("holds password formats only: no values, no PAN-shaped strings, no long digit runs", () => {
    expect(raw).not.toMatch(/password\s*[:=]|\b[A-Z]{5}\d{4}[A-Z]\b/);
    expect(raw).not.toMatch(/\d{6,}/);
  });
  it("is well-formed: unique ids, known kinds, hint keys, adapters, supported ⇔ adapters", () => {
    const ids = CATALOG.sources.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of CATALOG.sources) {
      expect(CATALOG.kindOrder).toContain(s.kinds[0]);
      for (const h of s.passwordHints) expect(CATALOG.passwordHintFormats[h]).toBeTruthy();
      for (const a of s.importer.adapters) expect(ADAPTERS).toContain(a);
      expect(s.importer.supported).toBe(s.importer.adapters.length > 0);
      expect(s.senders.domains.length).toBeGreaterThan(0);
      for (const d of s.senders.domains) expect(d).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/);
      if (!s.importer.supported) expect(s.importer.note).toBeTruthy();
    }
  });
});

describe("device flags never hold personal data", () => {
  it("serialises only v/seen/mode/dismissed/percent", () => {
    const sneaky = { ...EMPTY_FLAGS, seen: true, percent: 44, email: "a@gmail.com", picked: ["hdfc-bank"] } as unknown as typeof EMPTY_FLAGS;
    const out = serialiseFlags(sneaky);
    expect(out).not.toMatch(/@|hdfc/);
    expect(JSON.parse(out)).toEqual({ v: 1, seen: true, mode: null, dismissed: false, percent: 44 });
    expect(parseFlags('{"percent":250,"mode":"x"}')).toEqual(EMPTY_FLAGS);
    expect(parseFlags("garbage")).toEqual(EMPTY_FLAGS);
  });
  it("auto-opens only on a true first run", () => {
    expect(isFirstRun(EMPTY_FLAGS, false, false)).toBe(true);
    expect(isFirstRun({ ...EMPTY_FLAGS, seen: true }, false, false)).toBe(false);
    expect(isFirstRun(EMPTY_FLAGS, true, false)).toBe(false);
    expect(isFirstRun(EMPTY_FLAGS, false, true)).toBe(false);
  });
});

describe("setup entitlements", () => {
  it("setup and one-mailbox sync are free; background sync and reminders are Premium", () => {
    for (const f of ["setup.wizard", "setup.emailGuide", "setup.extraEmails", "setup.suggestions", "setup.health", "mailSync.connect", "mailSync.imap", "mailSync.statementPasswordKeychain"]) expect(can(f, "free")).toBe(true);
    expect(can("mailSync.background", "free")).toBe(false);
    expect(can("setup.freshnessReminders", "free")).toBe(false);
    expect(limit("mailSync.connect", "free")).toBe(1);
    expect(limit("setup.extraEmails", "free")).toBe(3);
    expect(FREE_BILL_OF_RIGHTS).toEqual(expect.arrayContaining(["setup.wizard", "setup.emailGuide", "mailSync.connect"]));
  });
  it("Free budgets: one monthly budget with up to 6 category lines", () => {
    expect(limit("budgets.unlimited", "free")).toBe(1);
    expect(limit("budgets.lines", "free")).toBe(6);
    expect(limit("budgets.lines", "premium")).toBeNull();
  });
});
