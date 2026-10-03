"use client";
import { createContext, useCallback, useContext, useEffect, useState, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { emptyDataset, type MergeReport, type ParseResult } from "@lakshly/parsers";
import { dataset as demo } from "@/lib/data";
import type { LakshlyDataset } from "@/lib/schema.gen";
import { deleteVault, loadUserData, saveUserData, type UserData } from "@/lib/vault";
import { initialSetup, setupReducer, type SetupAction, type SetupState, type SetupGoal, type BudgetLine } from "@lakshly/shared";
import { emptyUser, mergeImport, reconcileImports } from "@/lib/setup-import";
import { localToday, SETUP_FLAGS_KEY, writeSetupFlags } from "@/lib/setup-storage";
import { useAppState } from "./AppState";
import { limit } from "@/lib/entitlements";
import { loadSetupDemo } from "@/lib/setup-demo";
import { Glass, PageHeader } from "./ui";
import { Icon } from "./Icon";
import "./data-state.css";

export type Source = "demo" | "mine";
const SOURCE_KEY = "lakshly.source";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener("storage", l);
  return () => { listeners.delete(l); window.removeEventListener("storage", l); };
}
const readSource = (): Source => (localStorage.getItem(SOURCE_KEY) === "mine" ? "mine" : "demo");

interface DataCtx {
  source: Source;
  setSource: (s: Source) => void;
  /** True once the encrypted vault has been read (or there is none). */
  ready: boolean;
  user: UserData | null;
  /** The dataset every page renders: demo data, or the user's own imported data. */
  dataset: LakshlyDataset;
  accounts: LakshlyDataset["accounts"];
  transactions: LakshlyDataset["transactions"];
  budgets: NonNullable<LakshlyDataset["budgets"]>;
  debts: NonNullable<LakshlyDataset["debts"]>;
  sips: NonNullable<LakshlyDataset["sips"]>;
  rewards: NonNullable<LakshlyDataset["rewards"]>;
  setup: SetupState | undefined;
  goals: SetupGoal[];
  ephemeral: boolean;
  storageError: string | null;
  dispatchSetup: (action: SetupAction) => Promise<SetupState>;
  saveBudgets: (lines: BudgetLine[]) => Promise<void>;
  saveGoal: (goal: SetupGoal) => Promise<void>;
  saveImport: (r: ParseResult, fileName: string) => Promise<MergeReport & { importId: string }>;
  deleteAll: () => Promise<void>;
}
const Ctx = createContext<DataCtx | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { plan } = useAppState();
  const loadError = useRef(false);
  const storedSource = useSyncExternalStore(subscribe, readSource, () => "demo" as Source);
  const [user, setUser] = useState<UserData | null>(null);
  const userRef = useRef<UserData | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const ephemeralRef = useRef(false);
  const [ephemeral, setEphemeral] = useState(false);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const preview = await loadSetupDemo(window.location.search);
        const data = preview ? { ...emptyUser(), dataset: preview.dataset, setup: preview.setup } : await loadUserData();
        if (!alive) return;
        ephemeralRef.current = !!preview;
        setEphemeral(!!preview);
        userRef.current = data; setUser(data); setReady(true);
      } catch {
        if (alive) { loadError.current = true; setStorageError("This browser couldn't unlock the vault. Your stored data has not been changed."); setReady(true); }
      }
    }
    void load();
    return () => { alive = false; };
  }, []);

  const setSource = useCallback((s: Source) => {
    if (!ephemeralRef.current) localStorage.setItem(SOURCE_KEY, s);
    emit();
  }, []);

  const persist = useCallback(async (next: UserData) => {
    if (!ephemeralRef.current) {
      await saveUserData(next);
      if (next.setup) { try { writeSetupFlags(localStorage, next.setup, { ...next.dataset, goals: next.goals }, localToday()); } catch { /* Non-secret hints are optional; vault save succeeded. */ } }
    }
    userRef.current = next;
    setUser(next);
  }, []);

  // All encrypted mutations use the latest committed data, in order. A failed save does not
  // prevent the next attempt, and never replaces the in-memory dataset with an unsaved one.
  const mutate = useCallback(<T,>(operation: (base: UserData) => Promise<T>): Promise<T> => {
    if (loadError.current) return Promise.reject(new Error("Unlock the existing vault before changing it."));
    const work = queue.current.catch(() => undefined).then(() => operation(userRef.current ?? emptyUser()));
    queue.current = work;
    return work;
  }, []);

  const dispatchSetup = useCallback((action: SetupAction) => mutate(async base => {
    const now = new Date().toISOString();
    const today = ephemeralRef.current ? "2026-10-03" : localToday();
    if (action.type === "addEmail" || action.type === "setEmail") {
      const address = action.email.trim().toLowerCase();
      const primary = action.type === "setEmail" ? address : base.setup?.email.primary ?? "";
      const extra = action.type === "addEmail" ? [...(base.setup?.email.extra ?? []), address] : base.setup?.email.extra ?? [];
      if (new Set([primary, ...extra].filter(Boolean)).size > limit("setup.extraEmails", plan)) throw new Error("Too many saved addresses.");
    }
    let setup = setupReducer(base.setup ?? initialSetup(now), { ...action,
      dataset: { ...base.dataset, goals: base.goals }, today, platform: "web" }, now);
    setup = reconcileImports(base, setup, now, today);
    await persist({ ...base, setup });
    if (action.type === "chooseMode") setSource(action.mode);
    return setup;
  }), [mutate, persist, setSource, plan]);

  const saveBudgets = useCallback((lines: BudgetLine[]) => mutate(async base => {
    const valid = lines.filter(l => Number.isSafeInteger(l.limit) && l.limit >= 0);
    const month = ephemeralRef.current ? "2026-10" : localToday().slice(0, 7);
    if (!valid.length || valid.some(l => l.month !== month)) throw new Error("Choose a valid budget for this month.");
    const dataset = { ...base.dataset, budgets: [...(base.dataset.budgets ?? []).filter(b => b.month !== month), ...valid] } as UserData["dataset"];
    const now = new Date().toISOString();
    const setup = setupReducer(base.setup ?? initialSetup(now), { type: "acceptBudget", lines: valid, currentStep: base.setup?.currentStep,
      dataset: { ...dataset, goals: base.goals }, today: `${month}-01`, platform: "web" }, now);
    await persist({ ...base, dataset, setup });
  }), [mutate, persist]);

  const saveGoal = useCallback((goal: SetupGoal) => mutate(async base => {
    if (base.goals?.length) return; // Setup creates at most one goal, on every plan.
    if (!goal.name.trim() || !Number.isSafeInteger(goal.target) || goal.target <= 0 ||
        !Number.isSafeInteger(goal.saved) || !Number.isSafeInteger(goal.monthly) || goal.saved < 0 || goal.monthly < 0) throw new Error("Choose valid goal amounts.");
    const goals = [{ ...goal, createdBy: "setup" as const }];
    const now = new Date().toISOString();
    const setup = setupReducer(base.setup ?? initialSetup(now), { type: "acceptGoal", goal, currentStep: base.setup?.currentStep,
      dataset: { ...base.dataset, goals }, today: ephemeralRef.current ? "2026-10-03" : localToday(), platform: "web" }, now);
    await persist({ ...base, goals, setup });
  }), [mutate, persist]);

  const saveImport = useCallback((r: ParseResult, fileName: string) => mutate(async base => {
    const now = new Date().toISOString();
    const importId = `imp_${crypto.randomUUID().replaceAll("-", "")}`;
    const { user: next, report } = mergeImport(base, r, fileName, now, importId);
    if (base.setup) next.setup = reconcileImports(next, base.setup, now, ephemeralRef.current ? "2026-10-03" : localToday());
    await persist(next);
    return { ...report, importId };
  }), [mutate, persist]);

  const deleteAll = useCallback(async () => {
    await queue.current.catch(() => undefined);
    if (!ephemeralRef.current) {
      await deleteVault();
      localStorage.removeItem(SOURCE_KEY);
      localStorage.removeItem(SETUP_FLAGS_KEY);
    }
    loadError.current = false; setStorageError(null);
    userRef.current = null; setUser(null); emit();
  }, []);

  const source: Source = ephemeral ? (user?.setup?.mode ?? "mine") : storedSource;
  const active: LakshlyDataset = source === "mine" ? (user?.dataset ?? (emptyDataset() as LakshlyDataset)) : demo;
  const value: DataCtx = {
    source, setSource, ready, user, saveImport, deleteAll, ephemeral, storageError,
    setup: user?.setup, goals: user?.goals ?? [], dispatchSetup, saveBudgets, saveGoal,
    dataset: active,
    accounts: active.accounts,
    transactions: active.transactions,
    budgets: active.budgets ?? [],
    debts: active.debts ?? [],
    sips: active.sips ?? [],
    rewards: active.rewards ?? [],
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useData must be used inside DataProvider");
  return c;
}

/** Renders children only when the active dataset has what the page needs; otherwise a friendly empty state. */
export function DataGate({ title, need = ["transactions"], children }: { title: string; need?: ("transactions" | "accounts" | "savings" | "cards" | "debts" | "sips" | "rewards")[]; children: React.ReactNode }) {
  const d = useData();
  if (d.source === "demo") return <>{children}</>;
  if (!d.ready) return <PageHeader title={title} subtitle="Unlocking your on-device vault…" />;
  const missing = need.some((n) =>
    n === "transactions" ? !d.transactions.length
      : n === "accounts" ? !d.accounts.length
        : n === "savings" ? !d.accounts.some((a) => a.type === "savings" || a.type === "current")
          : n === "cards" ? !d.accounts.some((a) => a.type === "credit_card")
            : n === "debts" ? !d.debts.length
              : n === "sips" ? !d.sips.length && !d.accounts.some((a) => a.type === "mutual_fund")
                : !d.rewards.length);
  if (!missing) return <>{children}</>;
  return (
    <>
      <PageHeader title={title} subtitle="Showing your data" />
      <Glass className="card empty-state">
        <span className="empty-icon" aria-hidden="true"><Icon name="import" size={26} /></span>
        <h2>Nothing here yet</h2>
        <p className="muted">Import a bank, credit-card or mutual fund (CAS) statement to fill this page. Parsing happens on this device; nothing is uploaded.</p>
        <div className="row-actions">
          <Link className="btn primary" href="/import/">Import a statement</Link>
          <Link className="btn ghost" href="/setup/">Guided setup</Link>
          <button className="btn ghost" onClick={() => d.setSource("demo")}>View demo data</button>
        </div>
      </Glass>
    </>
  );
}

/** Small label used in the shell: which dataset is on screen. */
export function DataPill() {
  const { source } = useData();
  return <span className={`demo-pill ${source === "mine" ? "mine" : ""}`}>{source === "mine" ? "My data" : "Demo data"}</span>;
}

export function DataNote() {
  const { source } = useData();
  return <p className="tiny muted">{source === "mine" ? "Your data · encrypted, stored only on this device" : "Synthetic demo data · stored only on this device"}</p>;
}
