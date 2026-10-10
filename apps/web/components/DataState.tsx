"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { emptyDataset, findDuplicateAccounts, mergeAccounts as foldAccounts, mergeResult, type MergeReport, type ParseResult } from "@lakshly/parsers";
import { mergeImportDetails } from "@/lib/import/merge";
import { dataset as demo } from "@/lib/data";
import type { Budget, LakshlyDataset } from "@/lib/schema.gen";
import { budgetId } from "@/lib/setup-suggest";
import type { SetupGoal } from "@/lib/setup";
import { deleteVault, loadUserData, saveUserData, vaultLockState, VAULT_DELETED_EVENT, VAULT_LOCKED_EVENT, VAULT_UNLOCKED_EVENT, type UserData } from "@/lib/vault";
import { Glass, PageHeader } from "./ui";
import { Icon } from "./Icon";
import { usePrivacy } from "./Privacy";
import { useReviewStore, type ReviewApi } from "./useReview";
import { overlayDecisions, type ReviewTxn } from "@/lib/review";
import "./data-state.css";

export type Source = "demo" | "mine";
import { clearVaultPending, hasDataFlag, SOURCE_KEY, setHasData } from "@/lib/vault-boot";
const SETUP_FLAGS_KEY = "lk-setup-flags";

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener("storage", l);
  return () => { listeners.delete(l); window.removeEventListener("storage", l); };
}
// A browser that has real data shows it (unless the person explicitly picked the demo).
const readSource = (): Source => { const v = localStorage.getItem(SOURCE_KEY); return v === "mine" || (v !== "demo" && hasDataFlag()) ? "mine" : "demo"; };

interface DataCtx {
  source: Source;
  setSource: (s: Source) => void;
  /** True once the encrypted vault has been read (or there is none). */
  ready: boolean;
  /** True when a passphrase is set and this tab has not unlocked it. */
  vaultLocked: boolean;
  user: UserData | null;
  /** The dataset every page renders: demo data, or the user's own imported data. */
  dataset: LakshlyDataset;
  accounts: LakshlyDataset["accounts"];
  transactions: LakshlyDataset["transactions"];
  budgets: NonNullable<LakshlyDataset["budgets"]>;
  debts: NonNullable<LakshlyDataset["debts"]>;
  sips: NonNullable<LakshlyDataset["sips"]>;
  rewards: NonNullable<LakshlyDataset["rewards"]>;
  saveImport: (r: ParseResult, fileName: string, sourceId?: string, ref?: string) => Promise<MergeReport>;
  /** Pairs of saved accounts that look like the same account (CSV + PDF, or an import the matcher could not decide). */
  mergeOffers: MergeOffer[];
  /** Fold one saved account into another (duplicate rows are dropped). Returns the number removed. */
  mergeAccounts: (dropId: string, keepId: string) => Promise<number>;
  dismissMergeOffer: (dropId: string, keepId: string) => void;
  /** Replace one month's budget lines in the user's own data (creates an empty dataset if needed). */
  saveBudgets: (month: string, lines: { category: Budget["category"]; limit: number }[]) => Promise<void>;
  saveGoal: (goal: SetupGoal) => Promise<void>;
  deleteAll: () => Promise<void>;
  /** Privacy mode is on: amounts render masked. Consumers re-render when it flips. */
  masked: boolean;
  /** Raw transactions before weekly-review decisions are applied (the review inbox reads these). */
  rawTransactions: LakshlyDataset["transactions"];
  review: ReviewApi;
}
export interface MergeOffer { keepId: string; dropId: string; keepName: string; dropName: string; overlap: number }
const Ctx = createContext<DataCtx | null>(null);
const DISMISSED_MERGES = "lk-merge-dismissed";

export function DataProvider({ children }: { children: React.ReactNode }) {
  const source = useSyncExternalStore(subscribe, readSource, () => "demo" as Source);
  const [user, setUserState] = useState<UserData | null>(null);
  // Latest saved data, updated synchronously so back-to-back saves (bulk Gmail import) never overwrite each other.
  const userRef = useRef<UserData | null>(null);
  const setUser = useCallback((u: UserData | null) => { userRef.current = u; setUserState(u); }, []);
  const [ready, setReady] = useState(false);
  const [vaultLocked, setVaultLocked] = useState(false);
  const { masked } = usePrivacy();

  useEffect(() => {
    let alive = true;
    vaultLockState()
      .then((state) => {
        if (!alive) return;
        if (state === "locked") { setVaultLocked(true); setReady(true); return; }
        return loadUserData().then((u) => { if (alive) { setUser(u); setReady(true); setHasData(!!u && (u.imports.length > 0 || u.dataset.transactions.length > 0)); } });
      })
      .catch(() => { if (alive) setReady(true); });
    const onLock = () => { setUser(null); setVaultLocked(true); };
    const onUnlock = () => {
      setVaultLocked(false);
      loadUserData().then((u) => { if (alive) setUser(u); }).catch(() => {});
    };
    window.addEventListener(VAULT_LOCKED_EVENT, onLock);
    window.addEventListener(VAULT_UNLOCKED_EVENT, onUnlock);
    return () => {
      alive = false;
      window.removeEventListener(VAULT_LOCKED_EVENT, onLock);
      window.removeEventListener(VAULT_UNLOCKED_EVENT, onUnlock);
    };
  }, [setUser]);

  // The vault has been read (or is locked): lift the boot-time "hide demo numbers" gate.
  useEffect(() => { if (ready) clearVaultPending(); }, [ready]);

  const setSource = useCallback((s: Source) => { localStorage.setItem(SOURCE_KEY, s); emit(); }, []);

  const [ambiguous, setAmbiguous] = useState<{ dropId: string; keepId: string }[]>([]);
  const saveImport = useCallback(async (r: ParseResult, fileName: string, sourceId?: string, ref?: string) => {
    const base: UserData = userRef.current ?? { version: 1, dataset: emptyDataset(), holdings: [], statements: [], imports: [] };
    const { dataset, report, accountAliases } = mergeResult(base.dataset, r);
    const details = mergeImportDetails(base, r, dataset, accountAliases);
    const known = new Set(base.dataset.transactions.map((t) => t.id));
    const at = new Date().toISOString();
    const importedAt = { ...(base.importedAt ?? {}) };
    for (const t of dataset.transactions) if (!known.has(t.id) && !importedAt[t.id]) importedAt[t.id] = at;
    const next: UserData = {
      version: 1,
      importedAt,
      dataset,
      ...details,
      imports: [...base.imports, { at: new Date().toISOString(), file: fileName.slice(0, 120), adapter: r.adapter, added: report.added, duplicates: report.duplicates, ...(sourceId ? { sourceId } : {}), ...(ref ? { ref: ref.slice(0, 120) } : {}) }],
      ...(base.goals ? { goals: base.goals } : {}),
    };
    await saveUserData(next);
    setUser(next);
    setHasData(true);
    if (report.ambiguous?.length) setAmbiguous((prev) => [...prev, ...report.ambiguous!.flatMap((x) => x.candidateIds.map((c) => ({ dropId: x.incomingId, keepId: c })))]);
    return report;
  }, [setUser]);

  const [dismissed, setDismissed] = useState<string[]>(() => { try { return JSON.parse(sessionStorage.getItem(DISMISSED_MERGES) ?? "[]"); } catch { return []; } });
  const mergeOffers = useMemo<MergeOffer[]>(() => {
    const ds = user?.dataset;
    if (!ds) return [];
    const name = (id: string) => ds.accounts.find((a) => a.id === id)?.name;
    const pairs = [...findDuplicateAccounts(ds).map((p) => ({ keepId: p.keepId, dropId: p.dropId, overlap: p.overlap })), ...ambiguous.map((p) => ({ ...p, overlap: 0 }))];
    const seen = new Set<string>();
    return pairs.flatMap((p) => {
      const k = `${p.dropId}>${p.keepId}`;
      const keepName = name(p.keepId), dropName = name(p.dropId);
      if (seen.has(k) || dismissed.includes(k) || !keepName || !dropName) return [];
      seen.add(k);
      return [{ ...p, keepName, dropName }];
    });
  }, [user, ambiguous, dismissed]);
  const dismissMergeOffer = useCallback((dropId: string, keepId: string) => {
    setDismissed((d) => { const n = [...d, `${dropId}>${keepId}`]; try { sessionStorage.setItem(DISMISSED_MERGES, JSON.stringify(n)); } catch { /* private mode */ } return n; });
  }, []);
  const mergeAccounts = useCallback(async (dropId: string, keepId: string) => {
    const base = userRef.current;
    if (!base) return 0;
    const { dataset, removed } = foldAccounts(base.dataset, dropId, keepId);
    const next: UserData = { ...base, dataset, statements: base.statements.map((m) => (m.accountId === dropId ? { ...m, accountId: keepId } : m)), holdings: base.holdings.map((h) => (h.accountId === dropId ? { ...h, accountId: keepId } : h)) };
    await saveUserData(next);
    setUser(next);
    setAmbiguous((prev) => prev.filter((p) => p.dropId !== dropId && p.keepId !== dropId));
    return removed;
  }, [setUser]);

  const saveBudgets = useCallback(async (month: string, lines: { category: Budget["category"]; limit: number }[]) => {
    const base: UserData = userRef.current ?? { version: 1, dataset: emptyDataset(), holdings: [], statements: [], imports: [] };
    const others = (base.dataset.budgets ?? []).filter((b) => b.month !== month);
    const fresh: Budget[] = lines.map((l) => ({ id: budgetId(month, l.category), month, category: l.category, limit: l.limit, rollover: false }));
    const next: UserData = { ...base, dataset: { ...base.dataset, budgets: [...others, ...fresh] } };
    await saveUserData(next);
    setUser(next);
  }, [setUser]);

  const saveGoal = useCallback(async (goal: SetupGoal) => {
    const base: UserData = userRef.current ?? { version: 1, dataset: emptyDataset(), holdings: [], statements: [], imports: [] };
    const next: UserData = { ...base, goals: [...(base.goals ?? []).filter((g) => g.kind !== goal.kind), goal] };
    await saveUserData(next);
    setUser(next);
  }, [setUser]);


  const active: LakshlyDataset = useMemo(() => (source === "mine" ? (user?.dataset ?? (emptyDataset() as LakshlyDataset)) : demo), [source, user]);
  const review = useReviewStore(source, active.transactions as ReviewTxn[], demo, user?.importedAt);
  const transactions = useMemo(() => overlayDecisions(active.transactions, review.state), [active, review.state]);
  const { forgetAll } = review;
  const deleteAll = useCallback(async () => {
    await deleteVault();
    setHasData(false);
    localStorage.removeItem(SOURCE_KEY);
    localStorage.removeItem(SETUP_FLAGS_KEY);
    localStorage.removeItem("lk-worth-snooze"); // legacy plaintext snoozes (now kept in the encrypted review record)
    setUser(null);
    forgetAll();
    emit();
    window.dispatchEvent(new Event(VAULT_DELETED_EVENT));
  }, [forgetAll, setUser]);
  const value: DataCtx = {
    source, setSource, ready, vaultLocked, user, saveImport, mergeOffers, mergeAccounts, dismissMergeOffer, saveBudgets, saveGoal, deleteAll, masked, review,
    dataset: active,
    accounts: active.accounts,
    rawTransactions: active.transactions,
    transactions,
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
  if (d.vaultLocked) return (
    <>
      <PageHeader title={title} subtitle="Your data is locked" />
      <Glass className="card empty-state">
        <h2>Vault locked</h2>
        <p className="muted">Enter the passphrase in Profile to open the imported data on this device. The demo stays available. Nothing is sent.</p>
        <div className="row-actions">
          <Link className="btn primary" href="/profile/">Unlock in Profile</Link>
          <button className="btn ghost" onClick={() => d.setSource("demo")}>View demo data</button>
        </div>
      </Glass>
    </>
  );
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
        <p className="muted">My data has no statements yet. Practise with a fake sample, or import a bank, card or mutual fund statement. Parsing stays on this device.</p>
        <div className="row-actions">
          <Link className="btn primary" href="/import/?sample=1">Try a sample statement</Link>
          <Link className="btn ghost" href="/import/">Import a statement</Link>
          <Link className="btn ghost" href="/setup/?step=resume">Guided setup</Link>
          <button className="btn ghost" onClick={() => d.setSource("demo")}>View demo data</button>
        </div>
      </Glass>
    </>
  );
}

/** Small label used in the shell: which dataset is on screen. */
export function DataPill() {
  const { source } = useData();
  return <span className={`demo-pill ${source === "mine" ? "mine" : ""}`} data-source-hint="">{source === "mine" ? "My data" : "Demo data"}</span>;
}

export function DataNote() {
  const { source } = useData();
  return <p className="tiny muted" data-source-hint="">{source === "mine" ? "Your data · encrypted, stored only on this device" : "Synthetic demo data · stored only on this device"}</p>;
}
