// Setup wizard: pure logic. No React, no storage, no network.
// Links/queries for the manual email-search guide, the wizard reducer, the checklist,
// statement attribution and freshness. Suggestions (budget/goal) live in setup-suggest.ts.
import { CATALOG } from "./sources.gen";
import type { Source, SourceKind, SourcesCatalog } from "./setup-types";

/* ───────────── email providers + search links ───────────── */

export type Provider = "gmail" | "outlook" | "icloud" | "yahoo" | "other";

const PROVIDER_DOMAINS: Record<Exclude<Provider, "other">, string[]> = {
  gmail: ["gmail.com", "googlemail.com"],
  outlook: ["outlook.com", "hotmail.com", "live.com", "msn.com", "outlook.in", "hotmail.co.in", "live.in"],
  icloud: ["icloud.com", "me.com", "mac.com"],
  yahoo: ["yahoo.com", "yahoo.co.in", "yahoo.in", "ymail.com", "rocketmail.com"],
};

export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[A-Za-z]{2,}$/;

export function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase().slice(0, 254);
}

/** Provider from the address domain. Custom domains are "other" (could be Workspace or Microsoft 365). */
export function detectProvider(email: string): Provider | null {
  const e = normaliseEmail(email);
  if (!EMAIL_RE.test(e)) return null;
  const domain = e.split("@")[1];
  for (const [p, ds] of Object.entries(PROVIDER_DOMAINS)) if (ds.includes(domain)) return p as Provider;
  return "other";
}

const quote = (w: string) => (w.startsWith('"') ? w : /\s/.test(w) ? `"${w}"` : w);
const group = (op: string, items: string[]) => (items.length === 1 ? `${op}:${items[0]}` : `${op}:(${items.join(" OR ")})`);

export function findSource(id: string, catalog: SourcesCatalog = CATALOG): Source | undefined {
  return catalog.sources.find((s) => s.id === id);
}

/** Gmail search operators: from, subject, has:attachment, newer_than and excluded sender domains. */
export function gmailQuery(source: Source, searchId?: string): string {
  const s = source.searches.find((x) => x.id === searchId) ?? source.searches[0];
  const parts = [group("from", [...source.senders.domains, ...source.senders.addresses])];
  if (s?.subjectAny.length) parts.push(group("subject", s.subjectAny.map(quote)));
  if (s?.attachment) parts.push("has:attachment");
  if (s?.window) parts.push(`newer_than:${s.window}`);
  for (const d of source.senders.excludeDomains) parts.push(`-from:${d}`);
  return parts.join(" ");
}

function windowStart(window: string, today: string): string {
  const n = Number(window.slice(0, -1)) || 1;
  const [y, m, d] = today.split("-").map(Number);
  const back = window.endsWith("y") ? n * 12 : n;
  const total = y * 12 + (m - 1) - back;
  const yy = Math.floor(total / 12), mm = (total % 12) + 1;
  const dd = Math.min(d, new Date(Date.UTC(yy, mm, 0)).getUTCDate());
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** Outlook (KQL-style) search: from, subject, hasattachments and a received date floor. */
export function outlookQuery(source: Source, today: string, searchId?: string): string {
  const s = source.searches.find((x) => x.id === searchId) ?? source.searches[0];
  const senders = [...source.senders.domains, ...source.senders.addresses];
  const from = senders.length === 1 ? `from:${senders[0]}` : `(${senders.map((d) => `from:${d}`).join(" OR ")})`;
  const parts = [from];
  if (s?.subjectAny.length) {
    const subj = s.subjectAny.map((w) => `subject:${quote(w)}`);
    parts.push(subj.length === 1 ? subj[0] : `(${subj.join(" OR ")})`);
  }
  if (s?.attachment) parts.push("hasattachments:yes");
  if (s?.window) parts.push(`received>=${windowStart(s.window, today)}`);
  for (const d of source.senders.excludeDomains) parts.push(`NOT from:${d}`);
  return parts.join(" AND ");
}

/** Opens Gmail's search for the right account. Without an address, the first signed-in account. */
export function gmailUrl(query: string, email?: string): string {
  const e = email ? normaliseEmail(email) : "";
  const base = e && EMAIL_RE.test(e) ? `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(e)}` : "https://mail.google.com/mail/u/0/";
  return `${base}#search/${encodeURIComponent(query)}`;
}

/** Outlook has no stable search deep link: open the mailbox and paste the copied search. */
export function outlookOpenUrl(email?: string): string {
  const p = email ? detectProvider(email) : null;
  return p === "outlook" ? "https://outlook.live.com/mail/0/" : "https://outlook.office.com/mail/";
}

/* ───────────── catalog helpers ───────────── */

export function searchCatalog(q: string, catalog: SourcesCatalog = CATALOG): Source[] {
  const n = q.trim().toLowerCase();
  if (!n) return catalog.sources;
  return catalog.sources.filter((s) => [s.name, s.id, ...s.aliases, ...s.senders.domains].some((x) => x.toLowerCase().includes(n)));
}

export function groupByKind(sources: Source[], catalog: SourcesCatalog = CATALOG): { kind: SourceKind; label: string; sources: Source[] }[] {
  return catalog.kindOrder
    .map((kind) => ({ kind, label: catalog.kinds[kind], sources: sources.filter((s) => s.kinds[0] === kind) }))
    .filter((g) => g.sources.length);
}

export function passwordHintText(keys: string[], catalog: SourcesCatalog = CATALOG): string[] {
  return keys.map((k) => catalog.passwordHintFormats[k]).filter(Boolean);
}

/* ───────────── wizard state ───────────── */

export const STEPS = ["welcome", "email", "accounts", "import", "plan", "done"] as const;
export type StepId = (typeof STEPS)[number];
export const STEP_LABELS: Record<StepId, string> = {
  welcome: "Welcome", email: "Email", accounts: "Accounts", import: "Import", plan: "Plan", done: "Done",
};

export type SkipReason = "no_statement" | "later" | "dont_use" | "other";
export const SKIP_REASONS: Record<SkipReason, string> = {
  no_statement: "I can't find a statement", later: "I'll do it later", dont_use: "I don't use this any more", other: "Something else",
};

export interface CustomSource { id: string; name: string; kind: SourceKind }
export interface SourceProgress {
  status: "todo" | "imported" | "skipped";
  skipReason?: SkipReason;
  /** ISO date of the latest import attributed to this source. */
  lastImportAt?: string;
  /** Statement period end of the latest import (yyyy-mm-dd), drives freshness. */
  periodTo?: string;
  imports?: number;
}
export interface SetupGoal {
  kind: "emergency3" | "annualPayment" | "emergency6" | "custom";
  name: string;
  /** Paise. */
  target: number;
  monthly: number;
  due?: string;
  createdAt: string;
}

export interface SetupState {
  v: 1;
  mode: "mine" | "demo" | null;
  at: StepId;
  done: StepId[];
  skipped: StepId[];
  /** Up to limit("setup.extraEmails") + 1 addresses, primary first. Encrypted with the vault; never in localStorage. */
  emails: string[];
  picked: string[];
  custom: CustomSource[];
  progress: Record<string, SourceProgress>;
  themeChosen: boolean;
  budgetSaved: boolean;
  goal: SetupGoal | null;
  goalSkipped: boolean;
  startedAt: string;
  completedAt?: string;
}

export function initialSetup(now: string): SetupState {
  return { v: 1, mode: null, at: "welcome", done: [], skipped: [], emails: [], picked: [], custom: [], progress: {}, themeChosen: false, budgetSaved: false, goal: null, goalSkipped: false, startedAt: now };
}

export type SetupAction =
  | { type: "start"; mode: "mine" | "demo" }
  | { type: "theme" }
  | { type: "complete"; step: StepId }
  | { type: "skip"; step: StepId }
  | { type: "goTo"; step: StepId }
  | { type: "back" }
  | { type: "setEmails"; emails: string[]; max: number }
  | { type: "toggleSource"; id: string }
  | { type: "addCustom"; name: string; kind: SourceKind }
  | { type: "removeCustom"; id: string }
  | { type: "imported"; id: string; at: string; periodTo?: string }
  | { type: "skipSource"; id: string; reason: SkipReason }
  | { type: "unskipSource"; id: string }
  | { type: "budgetSaved" }
  | { type: "goal"; goal: SetupGoal | null }
  | { type: "reset"; now: string };

const without = <T,>(xs: T[], x: T) => xs.filter((y) => y !== x);
const withOnce = <T,>(xs: T[], x: T) => (xs.includes(x) ? xs : [...xs, x]);

/** First step neither done nor skipped; "done" when everything before it is settled. */
export function currentStep(s: SetupState): StepId {
  return STEPS.find((st) => !s.done.includes(st) && !s.skipped.includes(st)) ?? "done";
}

function nextAfter(step: StepId): StepId {
  return STEPS[Math.min(STEPS.indexOf(step) + 1, STEPS.length - 1)];
}

export function setupReducer(s: SetupState, a: SetupAction): SetupState {
  switch (a.type) {
    case "start": return { ...s, mode: a.mode };
    case "theme": return { ...s, themeChosen: true };
    case "complete": return { ...s, done: withOnce(s.done, a.step), skipped: without(s.skipped, a.step), at: nextAfter(a.step) };
    case "skip": return a.step === "done" ? s : { ...s, skipped: withOnce(s.skipped, a.step), at: nextAfter(a.step) };
    case "goTo": return { ...s, at: a.step };
    case "back": return { ...s, at: STEPS[Math.max(STEPS.indexOf(s.at) - 1, 0)] };
    case "setEmails": {
      const clean = [...new Set(a.emails.map(normaliseEmail).filter((e) => EMAIL_RE.test(e)))].slice(0, a.max);
      return { ...s, emails: clean };
    }
    case "toggleSource": return { ...s, picked: s.picked.includes(a.id) ? without(s.picked, a.id) : [...s.picked, a.id] };
    case "addCustom": {
      const name = a.name.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 40);
      if (!name) return s;
      const id = `custom_${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "source"}`;
      if (s.custom.some((c) => c.id === id)) return s;
      return { ...s, custom: [...s.custom, { id, name, kind: a.kind }], picked: [...s.picked, id] };
    }
    case "removeCustom": return { ...s, custom: s.custom.filter((c) => c.id !== a.id), picked: without(s.picked, a.id) };
    case "imported": {
      const prev = s.progress[a.id];
      const periodTo = [prev?.periodTo, a.periodTo].filter(Boolean).sort().pop();
      return { ...s, progress: { ...s.progress, [a.id]: { status: "imported", lastImportAt: a.at, periodTo, imports: (prev?.imports ?? 0) + 1 } } };
    }
    case "skipSource": return { ...s, progress: { ...s.progress, [a.id]: { ...s.progress[a.id], status: "skipped", skipReason: a.reason } } };
    case "unskipSource": {
      const p = s.progress[a.id];
      return { ...s, progress: { ...s.progress, [a.id]: { ...p, status: p?.lastImportAt ? "imported" : "todo", skipReason: undefined } } };
    }
    case "budgetSaved": return { ...s, budgetSaved: true };
    case "goal": return a.goal ? { ...s, goal: a.goal, goalSkipped: false } : { ...s, goal: null, goalSkipped: true };
    case "reset": return initialSetup(a.now);
  }
}

/* ───────────── checklist ───────────── */

export type ChecklistId = "profile" | "theme" | "myData" | "email" | "sources" | "firstImport" | "allSources" | "budget" | "goal";
export interface ChecklistItem { id: ChecklistId; label: string; required: boolean; done: boolean; step: StepId; href?: string }
export interface SetupFacts { name: string; importCount: number; budgetLines: number }

/** Supported catalog sources (and custom ones) the user picked, i.e. the import to-do list. */
export function importTargets(s: SetupState, catalog: SourcesCatalog = CATALOG): { id: string; name: string; kind: SourceKind; source?: Source; supported: boolean }[] {
  return s.picked.map((id) => {
    const src = catalog.sources.find((x) => x.id === id);
    if (src) return { id, name: src.name, kind: src.kinds[0], source: src, supported: src.importer.supported };
    const c = s.custom.find((x) => x.id === id);
    return { id, name: c?.name ?? id, kind: c?.kind ?? "bank", supported: true };
  });
}

/** Web has 9 items (the Apple app adds App lock). */
export function checklist(s: SetupState, f: SetupFacts, catalog: SourcesCatalog = CATALOG): ChecklistItem[] {
  const targets = importTargets(s, catalog).filter((t) => t.supported);
  const settled = targets.every((t) => s.progress[t.id]?.status === "imported" || s.progress[t.id]?.status === "skipped");
  return [
    { id: "profile", label: "Tell Lakshly your name", required: true, done: !!f.name.trim(), step: "welcome" },
    { id: "theme", label: "Pick a look", required: false, done: s.themeChosen, step: "welcome" },
    { id: "myData", label: "Choose to use your own data", required: true, done: s.mode === "mine", step: "welcome" },
    { id: "email", label: "Add the email your statements go to", required: false, done: s.emails.length > 0, step: "email" },
    { id: "sources", label: "Pick your banks, cards and investments", required: true, done: s.picked.length > 0, step: "accounts" },
    { id: "firstImport", label: "Import your first statement", required: true, done: f.importCount > 0, step: "import" },
    { id: "allSources", label: "Import or skip every account", required: false, done: targets.length > 0 && settled && f.importCount > 0, step: "import" },
    { id: "budget", label: "Save a monthly budget", required: true, done: s.budgetSaved || f.budgetLines > 0, step: "plan" },
    { id: "goal", label: "Set a first goal", required: false, done: !!s.goal, step: "plan" },
  ];
}

export function progressOf(items: ChecklistItem[]): { done: number; total: number; percent: number; requiredDone: boolean } {
  const done = items.filter((i) => i.done).length;
  const total = items.length;
  return { done, total, percent: Math.floor((done * 100) / total), requiredDone: items.every((i) => !i.required || i.done) };
}

/**
 * setup.completed fires exactly once: the first time every required item is done, in "mine" mode.
 * Returns the (possibly stamped) state and whether the event fired now.
 */
export function markCompletion(s: SetupState, items: ChecklistItem[], now: string): { state: SetupState; fired: boolean } {
  if (s.completedAt || s.mode !== "mine" || !progressOf(items).requiredDone) return { state: s, fired: false };
  return { state: { ...s, completedAt: now }, fired: true };
}

/* ───────────── attribution ───────────── */

export type Attribution = { kind: "auto"; sourceId: string } | { kind: "ask"; candidates: string[] };

const isGeneric = (adapter: string) => /\.generic$|^csv\./.test(adapter);
const adapterKind = (adapter: string): SourceKind | null => {
  const k = adapter.split(".")[0];
  return k === "bank" || k === "card" || k === "cas" ? k : null;
};

/** Which picked source a parsed file belongs to. Exactly one specific match is automatic; generic adapters always ask. */
export function attribute(adapter: string, picked: string[], custom: CustomSource[] = [], catalog: SourcesCatalog = CATALOG): Attribution {
  const pickedSources = picked.map((id) => catalog.sources.find((s) => s.id === id)).filter((s): s is Source => !!s);
  if (!isGeneric(adapter)) {
    const hits = pickedSources.filter((s) => s.importer.adapters.includes(adapter));
    if (hits.length === 1) return { kind: "auto", sourceId: hits[0].id };
    if (hits.length > 1) return { kind: "ask", candidates: hits.map((s) => s.id) };
  }
  const kind = adapterKind(adapter);
  const sameKind = [
    ...pickedSources.filter((s) => s.importer.supported && (!kind || s.kinds[0] === kind)).map((s) => s.id),
    ...custom.filter((c) => picked.includes(c.id) && (!kind || c.kind === kind)).map((c) => c.id),
  ];
  return { kind: "ask", candidates: sameKind };
}

/* ───────────── freshness ───────────── */

export type Freshness = "fresh" | "due" | "stale" | "todo";

const addDays = (iso: string, n: number) => new Date(Date.parse(iso + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
function addMonths(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const yy = Math.floor(total / 12), mm = (total % 12) + 1;
  const dd = Math.min(d, new Date(Date.UTC(yy, mm, 0)).getUTCDate());
  return `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/**
 * fresh: the next statement isn't expected yet (period end + one cycle + grace).
 * due:   it should have arrived; within one more cycle.  stale: older than that.  todo: never imported.
 */
export function freshness(p: SourceProgress | undefined, cadence: Source["cadence"], today: string): Freshness {
  const anchor = p?.periodTo ?? p?.lastImportAt?.slice(0, 10);
  if (!anchor || p?.status === "todo" || !p) return "todo";
  const cycle = cadence.every === "year" ? 12 : 1;
  const expected = addDays(addMonths(anchor, cycle), cadence.graceDays);
  if (today <= expected) return "fresh";
  if (today <= addMonths(expected, cycle)) return "due";
  return "stale";
}

/* ───────────── device flags (localStorage) ───────────── */

export const FLAGS_KEY = "lk-setup-flags";
/** Only what the shell needs before the vault unlocks. Never the email, names or institutions. */
export interface SetupFlags { v: 1; seen: boolean; mode: "mine" | "demo" | null; dismissed: boolean; percent: number }
export const EMPTY_FLAGS: SetupFlags = { v: 1, seen: false, mode: null, dismissed: false, percent: 0 };

export function parseFlags(raw: string | null): SetupFlags {
  if (!raw) return EMPTY_FLAGS;
  try {
    const f = JSON.parse(raw) as Partial<SetupFlags>;
    return {
      v: 1,
      seen: f.seen === true,
      mode: f.mode === "mine" || f.mode === "demo" ? f.mode : null,
      dismissed: f.dismissed === true,
      percent: typeof f.percent === "number" && f.percent >= 0 && f.percent <= 100 ? Math.floor(f.percent) : 0,
    };
  } catch {
    return EMPTY_FLAGS;
  }
}

export function serialiseFlags(f: SetupFlags): string {
  const { v, seen, mode, dismissed, percent } = f;
  return JSON.stringify({ v, seen, mode, dismissed, percent });
}

/** Auto-open only on a true first run: no flags, no chosen dataset, nothing in the vault. */
export function isFirstRun(flags: SetupFlags, sourceChosen: boolean, hasVaultData: boolean): boolean {
  return !flags.seen && !sourceChosen && !hasVaultData;
}
