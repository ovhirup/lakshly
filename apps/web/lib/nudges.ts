// Nudge engine (pure): decides which single nudge, if any, to show. Factual, kind, rate-limited, explainable.
import { NUDGE_CATALOG_JSON } from "./game.gen";
import { isoWeek, localDate } from "./review";

export type Tone = "hype" | "straight" | "roast";
export type Polarity = "positive" | "negative" | "info";
export interface Template { text: string; masked: string }
export interface NudgeDef {
  id: string; polarity: Polarity; source: string; screen: "overview" | "spend"; v1Priority: number; priority: number;
  cooldownHours: number; minHistoryDays: number; trigger: string; action: { label: string; href: string };
  templates: { hype: Template; straight: Template; roast: Template | null };
}
export interface Catalog {
  version: number;
  limits: { maxShownPerDay: number; maxPerScreen: number; snoozeDaysOnNotNow: number; minDataDaysForNegative: number; negativePerWeek: number; roastOffAfterOverMonths: number; guardrail: { minShown: number; snoozeShare: number; days: number } };
  bannedWords: string[];
  maskPlaceholders: string[];
  nudges: NudgeDef[];
}
export const CATALOG: Catalog = NUDGE_CATALOG_JSON as unknown as Catalog;

/** Values for a candidate. Money values are paise and only ever rendered through the formatter. */
export interface Candidate { id: string; subject: string; vars: Record<string, string | number>; money?: Record<string, number> }
export type NudgeAction = "shown" | "tapped" | "notNow" | "snooze7" | "snooze30" | "off";
export interface LogEntry { id: string; subject: string; at: string; action: NudgeAction; polarity: Polarity }
export interface CoachPrefs { v: 1; tone: Tone; sources: Record<string, boolean>; guardrailOptOutUntil?: string }
export const DEFAULT_PREFS: CoachPrefs = { v: 1, tone: "straight", sources: {} };
export const SOURCES: { id: string; label: string }[] = [
  { id: "pace", label: "Budget pace" }, { id: "badges", label: "Badges close to done" }, { id: "review", label: "Weekly review" },
  { id: "delivery", label: "Food-delivery bursts" }, { id: "rewards", label: "Points expiring" },
];

export interface EngineInput {
  candidates: Candidate[];
  log: readonly LogEntry[];
  prefs: CoachPrefs;
  now: Date;
  historyDays: number;
  premium: boolean;
  /** Last N complete months both over target: roast falls back to straight. */
  roastOff: boolean;
}
export interface Suppressed { id: string; subject: string; reason: "maxShownPerDay" | "negativePerWeek" | "guardrailWeekly" | "snoozed" | "cooldown" | "sourceOff" | "minHistory" }
export interface Decision { shown: (Candidate & { def: NudgeDef }) | null; suppressed: Suppressed[]; tone: Tone; toneNotice: string | null; guardrail: boolean }

const def = (id: string) => CATALOG.nudges.find((n) => n.id === id);
const hoursSince = (iso: string, now: Date) => (now.getTime() - Date.parse(iso)) / 3600000;

export function snoozedUntil(log: readonly LogEntry[], id: string, subject: string): number {
  let until = 0;
  for (const e of log) {
    if (e.id !== id || e.subject !== subject) continue;
    const days = e.action === "notNow" || e.action === "snooze7" ? CATALOG.limits.snoozeDaysOnNotNow : e.action === "snooze30" ? 30 : e.action === "off" ? 36500 : 0;
    if (days) until = Math.max(until, Date.parse(e.at) + days * 86400000);
  }
  return until;
}

/** More than half of negative nudges snoozed in the last 30 days (with at least 4 shown) -> 1 a week, Straight tone. */
export function guardrailActive(log: readonly LogEntry[], now: Date, prefs: CoachPrefs): boolean {
  if (prefs.guardrailOptOutUntil && Date.parse(prefs.guardrailOptOutUntil) > now.getTime()) return false;
  const g = CATALOG.limits.guardrail;
  const recent = log.filter((e) => e.polarity === "negative" && hoursSince(e.at, now) <= g.days * 24);
  const shown = recent.filter((e) => e.action === "shown").length;
  const snoozed = recent.filter((e) => e.action === "notNow" || e.action === "snooze7" || e.action === "snooze30").length;
  return shown >= g.minShown && snoozed / shown > g.snoozeShare;
}

export function decide(input: EngineInput): Decision {
  const { log, prefs, now } = input;
  const today = localDate(now);
  const week = isoWeek(today);
  const guardrail = guardrailActive(log, now, prefs);
  const suppressed: Suppressed[] = [];
  const eligible: (Candidate & { def: NudgeDef })[] = [];
  for (const c of input.candidates) {
    const d = def(c.id);
    if (!d) continue;
    if (prefs.sources[d.source] === false) { suppressed.push({ id: c.id, subject: c.subject, reason: "sourceOff" }); continue; }
    if (snoozedUntil(log, c.id, c.subject) > now.getTime()) { suppressed.push({ id: c.id, subject: c.subject, reason: "snoozed" }); continue; }
    const minDays = Math.max(d.minHistoryDays, d.polarity === "negative" ? CATALOG.limits.minDataDaysForNegative : 0);
    if (input.historyDays < minDays) { suppressed.push({ id: c.id, subject: c.subject, reason: "minHistory" }); continue; }
    const lastShown = log.filter((e) => e.id === c.id && e.subject === c.subject && e.action === "shown" && localDate(new Date(e.at)) !== today).map((e) => e.at).sort().pop();
    if (lastShown && hoursSince(lastShown, now) < d.cooldownHours) { suppressed.push({ id: c.id, subject: c.subject, reason: "cooldown" }); continue; }
    eligible.push({ ...c, def: d });
  }
  const rank = { positive: 0, info: 1, negative: 2 } as const;
  eligible.sort((a, b) => a.def.v1Priority - b.def.v1Priority || b.def.priority - a.def.priority || rank[a.def.polarity] - rank[b.def.polarity]);

  const shownToday = log.filter((e) => e.action === "shown" && localDate(new Date(e.at)) === today);
  const alreadyToday = shownToday[0];
  const negThisWeek = new Set(log.filter((e) => e.action === "shown" && e.polarity === "negative" && isoWeek(localDate(new Date(e.at))) === week).map((e) => `${e.id}:${e.subject}:${localDate(new Date(e.at))}`)).size;
  const shownThisWeek = log.some((e) => e.action === "shown" && isoWeek(localDate(new Date(e.at))) === week && localDate(new Date(e.at)) !== today);

  let shown: Decision["shown"] = null;
  for (const c of eligible) {
    const same = alreadyToday && alreadyToday.id === c.id && alreadyToday.subject === c.subject;
    if (shown) { suppressed.push({ id: c.id, subject: c.subject, reason: "maxShownPerDay" }); continue; }
    if (alreadyToday && !same && shownToday.length >= CATALOG.limits.maxShownPerDay) { suppressed.push({ id: c.id, subject: c.subject, reason: "maxShownPerDay" }); continue; }
    if (!same && guardrail && shownThisWeek) { suppressed.push({ id: c.id, subject: c.subject, reason: "guardrailWeekly" }); continue; }
    if (!same && c.def.polarity === "negative" && negThisWeek >= CATALOG.limits.negativePerWeek) { suppressed.push({ id: c.id, subject: c.subject, reason: "negativePerWeek" }); continue; }
    shown = c;
  }

  let tone: Tone = prefs.tone === "roast" && !input.premium ? "straight" : prefs.tone;
  let toneNotice: string | null = null;
  if (guardrail && tone !== "straight") { tone = "straight"; toneNotice = "We've switched to Straight tone for a while because you've been snoozing these."; }
  if (shown && tone === "roast" && (shown.def.templates.roast === null || (input.roastOff && shown.def.polarity === "negative"))) {
    tone = "straight";
    if (input.roastOff && shown.def.polarity === "negative") toneNotice = "Roast-lite is resting after two tough months. Straight talk for now.";
  }
  return { shown, suppressed, tone, toneNotice, guardrail };
}

export function renderNudge(d: NudgeDef, c: Candidate, tone: Tone, masked: boolean, money: (paise: number) => string): string {
  const tpl = (tone === "roast" ? d.templates.roast : null) ?? d.templates[tone === "roast" ? "straight" : tone];
  const text = masked ? tpl.masked : tpl.text;
  return fill(text, c, money);
}
export function whyText(d: NudgeDef, c: Candidate, money: (paise: number) => string): string { return fill(d.trigger, c, money); }
function fill(text: string, c: Candidate, money: (paise: number) => string): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => (c.money && k in c.money ? money(c.money[k]) : k in c.vars ? String(c.vars[k]) : ""));
}

export function logAction(log: readonly LogEntry[], entry: LogEntry, keep = 400): LogEntry[] {
  return [...log, entry].slice(-keep);
}
