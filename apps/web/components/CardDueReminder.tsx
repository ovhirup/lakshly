"use client";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Glass } from "./ui";
import { useTier } from "./useTier";
import { useData } from "./DataState";
import { cardDueSoon, cardDueWhen, daysUntil, nextDueDate } from "@/lib/card-due";
import { creditCards } from "@/lib/selectors";
import { formatDate } from "@/lib/format";

const KEY = "lakshly.carddue.until";
const EVENT = "lakshly-carddue";

function subscribe(l: () => void) {
  window.addEventListener("storage", l);
  window.addEventListener(EVENT, l);
  return () => { window.removeEventListener("storage", l); window.removeEventListener(EVENT, l); };
}

type Snap = { today: string; snoozed: boolean };
const SERVER: Snap = { today: "1970-01-01", snoozed: false };
let cache = SERVER;

function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function readSnap(): Snap {
  let until: string | null = null;
  try { until = localStorage.getItem(KEY); } catch { until = null; }
  const today = localToday();
  const snoozed = !!until && Date.parse(until) > Date.now();
  if (cache.today === today && cache.snoozed === snoozed) return cache;
  cache = { today, snoozed };
  return cache;
}

function snooze() {
  try { localStorage.setItem(KEY, new Date(Date.now() + 7 * 86400000).toISOString()); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
}

const CLOSE_KEY = "lakshly.statementclose.until";
const CLOSE_EVENT = "lakshly-statementclose";
function subscribeClose(l: () => void) {
  window.addEventListener("storage", l);
  window.addEventListener(CLOSE_EVENT, l);
  return () => { window.removeEventListener("storage", l); window.removeEventListener(CLOSE_EVENT, l); };
}
let closeCache = SERVER;
function readCloseSnap(): Snap {
  let until: string | null = null;
  try { until = localStorage.getItem(CLOSE_KEY); } catch { until = null; }
  const today = localToday();
  const snoozed = !!until && Date.parse(until) > Date.now();
  if (closeCache.today === today && closeCache.snoozed === snoozed) return closeCache;
  closeCache = { today, snoozed };
  return closeCache;
}
function snoozeClose() {
  try { localStorage.setItem(CLOSE_KEY, new Date(Date.now() + 7 * 86400000).toISOString()); } catch { /* ignore */ }
  window.dispatchEvent(new Event(CLOSE_EVENT));
}

function soonCards(accounts: ReturnType<typeof creditCards>, today: string, dayOf: (c: ReturnType<typeof creditCards>[number]) => number | undefined) {
  return accounts
    .filter((c) => typeof dayOf(c) === "number")
    .map((c) => {
      const date = nextDueDate(dayOf(c) as number, today);
      return { name: c.name, date, days: daysUntil(today, date) };
    })
    .filter((c) => cardDueSoon(c.days))
    .sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));
}

export function useCardDueToday(): { name: string; when: string; date: string; extra: string } | null {
  const { can } = useTier();
  const { accounts } = useData();
  const snap = useSyncExternalStore(subscribe, readSnap, () => SERVER);
  if (!can("credit.insights") || snap.snoozed) return null;
  const due = soonCards(creditCards(accounts), snap.today, (c) => c.dueDay);
  const first = due[0];
  if (!first) return null;
  const extra = due.length > 1 ? ` ${due.length - 1} more ${due.length === 2 ? "is" : "are"} due too.` : "";
  return { name: first.name, when: cardDueWhen(first.days), date: first.date, extra };
}

export function CardDueReminder({ row = false }: { row?: boolean }) {
  const item = useCardDueToday();
  if (!item) return null;
  const body = (
    <>
      {row ? <h3>Card payment <span className="badge">Premium</span></h3> : null}
      <p>{item.name} payment is due {item.when}, on {formatDate(item.date)}. Pay in full to avoid interest. Nothing is sent.{item.extra}</p>
      <div className="row-actions">
        <Link className="btn primary" href="/credit/">Credit</Link>
        <button className="btn ghost" type="button" onClick={snooze}>Not now</button>
      </div>
    </>
  );
  if (row) return <div className="today-row">{body}</div>;
  return (
    <Glass className="card card-due">
      <div className="card-head"><h2>Card payment</h2><span className="badge">Premium</span></div>
      {body}
    </Glass>
  );
}

export function useStatementCloseToday(): { name: string; when: string; date: string; extra: string } | null {
  const { accounts } = useData();
  const snap = useSyncExternalStore(subscribeClose, readCloseSnap, () => SERVER);
  if (snap.snoozed) return null;
  const due = soonCards(creditCards(accounts), snap.today, (c) => c.statementDay);
  const first = due[0];
  if (!first) return null;
  const extra = due.length > 1 ? ` ${due.length - 1} more ${due.length === 2 ? "closes" : "close"} too.` : "";
  return { name: first.name, when: cardDueWhen(first.days), date: first.date, extra };
}

export function StatementCloseReminder({ row = false }: { row?: boolean }) {
  const item = useStatementCloseToday();
  if (!item) return null;
  const body = (
    <>
      {row ? <h3>Statement closes</h3> : null}
      <p>{item.name} statement closes {item.when}, on {formatDate(item.date)}. Nothing is sent.{item.extra}</p>
      <div className="row-actions">
        <Link className="btn primary" href="/credit/">Credit</Link>
        <button className="btn ghost" type="button" onClick={snoozeClose}>Not now</button>
      </div>
    </>
  );
  if (row) return <div className="today-row">{body}</div>;
  return <Glass className="card card-due">{body}</Glass>;
}
