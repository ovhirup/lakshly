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

export function useCardDueToday(): { name: string; when: string; date: string; extra: string } | null {
  const { can } = useTier();
  const { accounts } = useData();
  const snap = useSyncExternalStore(subscribe, readSnap, () => SERVER);
  if (!can("credit.insights") || snap.snoozed) return null;
  const due = creditCards(accounts)
    .filter((c) => typeof c.dueDay === "number")
    .map((c) => {
      const date = nextDueDate(c.dueDay as number, snap.today);
      return { id: c.id, name: c.name, date, days: daysUntil(snap.today, date) };
    })
    .filter((c) => cardDueSoon(c.days))
    .sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));
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
