import { readFileSync } from "node:fs";
import { describe, expect, it, afterEach, vi } from "vitest";
import { initialSetup, setupReducer, checklist, type SetupAction } from "@lakshly/shared";
import { emptyDataset, type ParseResult } from "@lakshly/parsers";
import { migrateUserData, type LegacyUserData } from "../lib/vault";
import { setupFlags, writeSetupFlags, SETUP_FLAGS_KEY, isFirstRun } from "../lib/setup-storage";
import { loadSetupDemo } from "../lib/setup-demo";
import { emptyUser, mergeImport, reconcileImports, attributionAction } from "../lib/setup-import";
import { formatMoney } from "../lib/format";
const now = "2026-10-03T11:00:00+05:30", today = "2026-10-03";
const storage = () => { const rows = new Map<string, string>(); return { rows, getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value); }, removeItem: (key: string) => { rows.delete(key); } }; };
const parsed: ParseResult = { adapter: "bank.hdfc", adapterLabel: "HDFC Bank", kind: "bank", confidence: 1,
  accounts: [{ id: "acc_demo001", name: "SYNTHETIC savings", type: "savings", institution: "HDFC Bank", currency: "INR", balance: 100000, asOf: today, source: "statement" }],
  transactions: [{ id: "txn_demo001", accountId: "acc_demo001", date: today, amount: -10000, description: "SYNTHETIC groceries", category: "groceries", categorisedBy: "rule" }], holdings: [], sips: [], meta: [{ adapter: "bank.hdfc", kind: "bank", institution: "HDFC Bank", accountId: "acc_demo001", periodTo: today }], warnings: [] };
afterEach(() => vi.unstubAllEnvs());
describe("setup privacy and persistence", () => {
  it("greps localStorage after a synthetic wizard session: only non-secret flags", () => {
    const store = storage(); let state = initialSetup(now); const data = { ...emptyDataset(), goals: [] };
    const actions: SetupAction[] = [{ type: "start" }, { type: "setProfile", profile: { name: "SYNTHETIC Demo" } },
      { type: "chooseMode", mode: "mine" }, { type: "setEmail", email: "demo.user@example.org" },
      { type: "addEmail", email: "other.demo@example.org" }, { type: "toggleSource", catalogId: "hdfc-bank" },
      { type: "goTo", step: "import" }, { type: "finishLater" }];
    for (const action of actions) { state = setupReducer(state, { ...action, dataset: data, today }, now); writeSetupFlags(store, state, data, today); }
    const plain = [...store.rows.values()].join("\n");
    expect(plain).not.toMatch(/@|hdfc|HDFC|SYNTHETIC Demo|password|catalogId|sources|institution/);
    expect([...store.rows.keys()]).toEqual([SETUP_FLAGS_KEY]);
    expect(Object.keys(JSON.parse(plain)).sort()).toEqual(["dismissed", "mode", "percent", "seen", "v"]);
    expect(JSON.parse(plain)).toEqual(setupFlags(state, data, today));
    expect(JSON.parse(plain).dismissed).toBe(false);
  });
  it("flags have the exact permitted projection, even when state contains mailbox metadata", () => {
    const state = initialSetup(now); state.email.primary = "demo@example.org";
    expect(setupFlags(state, emptyDataset(), today)).toEqual({ seen: true, mode: "mine", dismissed: false, percent: 28, v: 1 });
  });
  it("true first run requires absent vault, absent source preference and absent flags", () => {
    const store = storage(); expect(isFirstRun(store, null)).toBe(true);
    store.setItem("lakshly.source", "demo"); expect(isFirstRun(store, null)).toBe(false);
    store.removeItem("lakshly.source"); store.setItem(SETUP_FLAGS_KEY, "{}"); expect(isFirstRun(store, null)).toBe(false);
    store.removeItem(SETUP_FLAGS_KEY); expect(isFirstRun(store, emptyUser())).toBe(false);
  });
  it("v1 to v2 preserves the entire dataset and import facts; log identities are stable", () => {
    const old: LegacyUserData = { version: 1, dataset: emptyDataset(), holdings: [], statements: [], imports: [{ at: now, file: "SYNTHETIC.pdf", adapter: "bank.hdfc", added: 2, duplicates: 1 }] };
    const next = migrateUserData(old);
    expect(next.version).toBe(2); expect(next.dataset).toBe(old.dataset); expect(next.holdings).toBe(old.holdings); expect(next.statements).toBe(old.statements);
    expect(next.imports).toEqual([{ ...old.imports[0], id: "imp_legacy000001", accountIds: [] }]);
    expect(migrateUserData(old)).toEqual(next); expect(migrateUserData(next)).toBe(next); expect(old.version).toBe(1);
  });
  it("preview is inert without the shots build flag, including when the query asks for it", async () => {
    vi.stubEnv("NEXT_PUBLIC_LAKSHLY_SHOTS", undefined);
    expect(await loadSetupDemo("?setupDemo=midway&step=import")).toBe(null);
    vi.stubEnv("NEXT_PUBLIC_LAKSHLY_SHOTS", "0"); expect(await loadSetupDemo("?setupDemo=midway")).toBe(null);
  });
  it("shots preview is synthetic and cloned, and never persists through its loader", async () => {
    vi.stubEnv("NEXT_PUBLIC_LAKSHLY_SHOTS", "1");
    expect(await loadSetupDemo("?step=import")).toBe(null);
    const first = await loadSetupDemo("?setupDemo=midway"); expect(first?.dataset.synthetic).toBe(true);
    first!.setup.profile.name = "SYNTHETIC edit";
    expect((await loadSetupDemo("?setupDemo=midway"))!.setup.profile.name).not.toBe("SYNTHETIC edit");
  });
  it("money formatting masks every amount and preserves integer-paise formatting", () => {
    expect(formatMoney(2690000)).toBe("₹26,900"); expect(formatMoney(-123456, { privacy: true })).toBe("••••");
    expect(formatMoney(10000, { currency: "USD" })).toContain("100");
  });
});
describe("importer attribution glue", () => {
  it("preserves setup and goals while recording saved result account IDs and import identity", () => {
    const base = emptyUser(); base.setup = initialSetup(now); base.goals = [{ id: "goal_demo001", name: "SYNTHETIC goal", kind: "custom", target: 100000, saved: 0, monthly: 10000, due: "2027-10-03", createdAt: now, createdBy: "setup" }];
    const merged = mergeImport(base, parsed, "SYNTHETIC.pdf", now, "imp_demo001");
    expect(merged.entry.accountIds).toEqual(["acc_demo001"]); expect(merged.entry.id).toBe("imp_demo001"); expect(merged.report.added).toBe(1);
    expect(merged.user.setup).toBe(base.setup); expect(merged.user.goals).toBe(base.goals);
  });
  it("auto attributes an outside-wizard branded import, once, when its source is picked", () => {
    const { user } = mergeImport(emptyUser(), parsed, "SYNTHETIC.pdf", now, "imp_demo001");
    const state = setupReducer(initialSetup(now), { type: "toggleSource", catalogId: "hdfc-bank" }, now);
    const next = reconcileImports(user, state, now, today);
    expect(next.sources[0]).toMatchObject({ status: "imported", importIds: ["imp_demo001"], accountIds: ["acc_demo001"], lastDataDate: today });
    expect(reconcileImports(user, next, now, today).imports).toHaveLength(1);
  });
  it("low-confidence imports show Needs a look and cannot satisfy firstImport", () => {
    const { user } = mergeImport(emptyUser(), { ...parsed, confidence: 0.5 }, "SYNTHETIC.pdf", now, "imp_demo001");
    const state = setupReducer(initialSetup(now), { type: "toggleSource", catalogId: "hdfc-bank" }, now);
    const next = reconcileImports(user, state, now, today);
    expect(next.sources[0].status).toBe("error"); expect(checklist(next, user.dataset, "web", today).items.find(i => i.id === "firstImport")?.done).toBe(false);
  });
  it("low-confidence final required import never emits a transient completion event", () => {
    const base = emptyUser(); base.dataset.budgets = [{ id: "bud_demo001", month: "2026-10", category: "groceries", limit: 100000, rollover: false }];
    const { user, entry } = mergeImport(base, { ...parsed, confidence: 0.5 }, "SYNTHETIC.pdf", now, "imp_demo001");
    let state = setupReducer(initialSetup(now), { type: "setProfile", profile: { name: "SYNTHETIC Demo" } }, now);
    state = setupReducer(state, { type: "toggleSource", catalogId: "hdfc-bank" }, now);
    for (const next of [reconcileImports(user, state, now, today), setupReducer(state, attributionAction(user, entry, "hdfc-bank"), now)]) {
      expect(next.sources[0].status).toBe("error"); expect(next.sources[0].importIds).toContain(entry.id);
      expect(checklist(next, user.dataset, "web", today).upAndRunning).toBe(false);
      expect(next.events).toEqual([]); expect(next.completedAt).toBe(null);
    }
  });
  it("generic adapters ask first; the selected account remembers the source next time", () => {
    const generic = { ...parsed, adapter: "bank.generic" };
    const { user, entry } = mergeImport(emptyUser(), generic, "SYNTHETIC.csv", now, "imp_demo001");
    let state = setupReducer(initialSetup(now), { type: "toggleSource", catalogId: "hdfc-bank" }, now);
    expect(reconcileImports(user, state, now, today).sources[0].status).toBe("todo");
    state = setupReducer(state, attributionAction(user, entry, "hdfc-bank"), now);
    const again = mergeImport(user, generic, "SYNTHETIC-next.csv", now, "imp_demo002");
    expect(reconcileImports(again.user, state, now, today).sources[0].importIds).toEqual(["imp_demo001", "imp_demo002"]);
    expect(again.report.duplicates).toBe(1);
  });
  it("demo never attributes imports or creates completion events", () => {
    const { user } = mergeImport(emptyUser(), parsed, "SYNTHETIC.pdf", now, "imp_demo001");
    const state = setupReducer(initialSetup(now), { type: "chooseMode", mode: "demo" }, now);
    expect(reconcileImports(user, state, now, today).sources).toEqual([]); expect(state.events).toEqual([]);
  });
  it("import callback uses the edited saved result and returns its import ID; reset clears flags", () => {
    const importer = readFileSync(new URL("../components/Importer.tsx", import.meta.url), "utf8");
    expect(importer).toContain("saveImport(savedResult, fileName)"); expect(importer).toContain("onImported?.(report, savedResult, report.importId)");
    const provider = readFileSync(new URL("../components/DataState.tsx", import.meta.url), "utf8");
    expect(provider).toContain("localStorage.removeItem(SETUP_FLAGS_KEY)"); expect(provider).toContain("if (!ephemeralRef.current)");
    expect(checklist(initialSetup(now), emptyDataset(), "web", today).upAndRunning).toBe(false);
  });
});
