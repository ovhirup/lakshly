"use client";
import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checklist, initialSetup, freshness, catalog } from "@lakshly/shared";
import { useData } from "./DataState";
import { Glass } from "./ui";
import { SetupRing } from "./SetupProgress";
import { isFirstRun, localToday } from "@/lib/setup-storage";
export function SetupCard() {
  const d = useData();
  const router = useRouter();
  useEffect(() => {
    if (d.ready && !d.ephemeral && !d.storageError && isFirstRun(localStorage, d.user)) router.replace("/setup/");
  }, [d.ready, d.user, d.ephemeral, d.storageError, router]);
  if (!d.ready || d.storageError) return null;
  const state = d.setup ?? { ...initialSetup(new Date().toISOString()), mode: d.source };
  const progress = checklist(state, { ...(d.user?.dataset ?? { transactions: [] }), goals: d.goals }, "web", localToday());
  const needsRefresh = state.sources.filter(s => ["due", "stale"].includes(freshness(s, catalog, localToday()))).length;
  if (progress.percent === 100) return needsRefresh ? <p className="muted tiny"><Link href="/setup/">{needsRefresh} sources need a refresh</Link></p> : null;
  if (state.dismissedAt) return null;
  const demo = state.mode === "demo";
  return <Glass className="card setup-resume"><SetupRing {...progress} /><div><h2>{demo ? "Use your own data · continue setup" : `Finish setting up · ${progress.done} of ${progress.applicable}`}</h2><p className="muted tiny">Your data stays on this device. Continue at your pace.</p><Link className="btn ghost" href={demo ? "/setup/?step=email" : "/setup/"} onClick={() => { if (demo) void d.dispatchSetup({ type: "chooseMode", mode: "mine" }); }}>Continue setup</Link></div><button className="btn ghost" onClick={() => void d.dispatchSetup({ type: "dismissCard" })}>Hide</button></Glass>;
}
function subscribeFlags(listener: () => void) { window.addEventListener("storage", listener); return () => window.removeEventListener("storage", listener); }
function readPercent() { try { const flags = JSON.parse(localStorage.getItem("lk-setup-flags") ?? "null"); return flags?.v === 1 && Number.isInteger(flags.percent) ? Math.max(0, Math.min(100, flags.percent)) : 0; } catch { return 0; } }
export function SetupLink() {
  const d = useData();
  const stored = useSyncExternalStore(subscribeFlags, readPercent, () => 0);
  const progress = d.setup ? checklist(d.setup, { ...(d.user?.dataset ?? { transactions: [] }), goals: d.goals }, "web", localToday()).percent : stored;
  return <Link className="tiny" href="/setup/">Setup · {progress}%</Link>;
}
