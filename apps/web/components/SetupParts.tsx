"use client";
// Setup wizard entry points: Overview card, sidebar link, Profile row, first-run auto-open. No upsells here.
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Glass, Progress } from "./ui";
import { Icon } from "./Icon";
import { useData } from "./DataState";
import { useSetup, useSetupFlags, writeFlags } from "./SetupState";
import { isFirstRun } from "@/lib/setup";
import "./setup.css";
import { IS_BETA } from "@/lib/edition";

export function Ring({ pct, size = 40, label }: { pct: number; size?: number; label?: boolean }) {
  const w = Math.max(3, size / 14);
  const r = size / 2 - w;
  const c = 2 * Math.PI * r;
  return (
    <span className="ring" style={{ width: size, height: size }} role={label ? "img" : undefined} aria-label={label ? `${pct}% set up` : undefined} aria-hidden={label ? undefined : true}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="ring-track" strokeWidth={w} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" className="ring-fill" strokeWidth={w} strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      {label && <strong>{pct}%</strong>}
    </span>
  );
}

/** Overview: "Finish setting up · x of 9", or an invitation to use your own data from demo mode. */
export function SetupCard() {
  const { ready, state, progress } = useSetup();
  const flags = useSetupFlags();
  if (!ready || flags.dismissed || state.completedAt) return null;
  const demo = state.mode !== "mine";
  return (
    <Glass className="card setup-card">
      <div className="setup-card-body">
        {demo ? <span className="choice-icon" aria-hidden="true"><Icon name="import" size={22} /></span> : <Ring pct={progress.percent} size={48} />}
        <div className="grow">
          <h2>{demo ? "Ready to use your own data?" : `Finish setting up · ${progress.done} of ${progress.total}`}</h2>
          <p className="muted tiny">{demo ? "Guided setup finds your statements, imports them on this device and suggests a budget. Free, about 5 minutes." : "Pick up where you left off. Everything stays on this device."}</p>
          {!demo && <Progress pct={progress.percent} />}
        </div>
        <div className="row-actions">
          <Link className="btn primary" href="/setup/?step=resume">{demo ? "Start setup" : "Continue"}</Link>
          <button className="icon-btn" aria-label="Hide setup card" onClick={() => writeFlags({ dismissed: true })}>×</button>
        </div>
      </div>
    </Glass>
  );
}

/** Sidebar footer: "Setup · 44%" until setup is complete. */
export function SetupNavLink() {
  const flags = useSetupFlags();
  const path = usePathname() || "/";
  if (flags.complete || flags.percent >= 100 || (!flags.seen && flags.percent === 0)) return null;
  return (
    <Link href="/setup/?step=resume" className={`setup-link ${path.startsWith("/setup") ? "active" : ""}`}>
      <Icon name="check" size={14} /> Setup · {flags.percent}%
    </Link>
  );
}

/** Profile: a row that always leads back to guided setup (and its health view when complete). */
export function SetupProfileRow() {
  const { ready, state, progress } = useSetup();
  if (!ready) return null;
  return (
    <Glass className="card setup-profile-row">
      <Ring pct={progress.percent} size={40} />
      <div className="grow">
        <h2>Guided setup</h2>
        <p className="muted tiny">{state.completedAt ? "Complete. Check statement health any time." : `${progress.done} of ${progress.total} done.`}</p>
      </div>
      <Link className="btn ghost" href={state.completedAt ? "/setup/?step=done" : "/setup/?step=resume"}>{state.completedAt ? "Health" : "Continue"}</Link>
    </Glass>
  );
}

/** Opens the wizard on a true first run only (no flags, no chosen dataset, nothing in the vault). */
export function SetupAutoOpen() {
  const router = useRouter();
  const path = usePathname() || "/";
  const flags = useSetupFlags();
  const data = useData();
  useEffect(() => {
    if (IS_BETA || path !== "/" || !data.ready) return; // beta opens on the demo Overview; setup stays one tap away
    let chosen = false;
    try { chosen = localStorage.getItem("lakshly.source") !== null; } catch { /* blocked */ }
    if (isFirstRun(flags, chosen, !!data.user)) { writeFlags({ seen: true }); router.replace("/setup/"); }
  }, [path, data.ready, data.user, flags, router]);
  return null;
}
