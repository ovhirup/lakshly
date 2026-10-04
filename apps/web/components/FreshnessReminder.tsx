"use client";
import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Glass } from "./ui";
import { useTier } from "./useTier";
import { useSetup } from "./SetupState";
import { checkConnectedMailbox, useGoogle } from "./GoogleConnect";
import { dueStatements, freshnessNotice, importTargets } from "@/lib/setup";

const KEY = "lakshly.freshness.until";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
function subscribe(l: () => void) {
  listeners.add(l);
  window.addEventListener("storage", l);
  return () => { listeners.delete(l); window.removeEventListener("storage", l); };
}
function readUntil() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function snooze(days: number) {
  const until = new Date(Date.now() + days * 86400000).toISOString();
  try { localStorage.setItem(KEY, until); } catch { /* ignore */ }
  emit();
}

const SERVER_CLOCK = { snoozed: false, today: "1970-01-01" };
let clockCache = SERVER_CLOCK;
function readClock() {
  const until = readUntil();
  const snoozed = !!(until && Date.parse(until) > Date.now());
  const today = new Date().toISOString().slice(0, 10);
  if (clockCache.snoozed === snoozed && clockCache.today === today) return clockCache;
  clockCache = { snoozed, today };
  return clockCache;
}

export function FreshnessReminder() {
  const { can } = useTier();
  const { state } = useSetup();
  const gmail = useGoogle();
  const clock = useSyncExternalStore(subscribe, readClock, () => SERVER_CLOCK);
  const [check, setCheck] = useState<string | null>(null);
  if (!can("setup.freshnessReminders")) return null;
  if (clock.snoozed) return null;
  const due = dueStatements(importTargets(state), state.progress, clock.today);
  const first = due[0];
  if (!first) return null;
  const email = state.emails[0] ?? null;
  const notice = freshnessNotice(first, email, !!gmail.token);
  const extra = due.length > 1 ? ` ${due.length - 1} more ${due.length === 2 ? "is" : "are"} waiting too.` : "";
  return (
    <Glass className="card">
      <div className="card-head"><h2>Statement reminder</h2><span className="badge">Premium</span></div>
      <p>{notice.detail}{extra}</p>
      {check ? <p className="muted tiny">{check}</p> : null}
      <div className="row-actions">
        {notice.canCheck ? (
          <button className="btn primary" type="button" disabled={!!gmail.busy} onClick={() => {
            void checkConnectedMailbox().then((r) => {
              setCheck(r.connected ? `Checked this tab. ${r.found} statement email${r.found === 1 ? "" : "s"}. Nothing was sent to Lakshly.` : "Gmail is not connected in this tab.");
            }).catch(() => setCheck("Couldn't check Gmail in this tab."));
          }}>Check this mailbox</button>
        ) : (
          <Link className="btn primary" href={email ? "/import/" : "/setup/?step=email"}>{email ? "Import" : "Add email"}</Link>
        )}
        {notice.canCheck && <Link className="btn ghost" href="/import/">Import</Link>}
        <button className="btn ghost" type="button" onClick={() => snooze(7)}>Not now</button>
      </div>
    </Glass>
  );
}
