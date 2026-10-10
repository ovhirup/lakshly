"use client";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { displayName, initial, NAME_MAX, saveProfile, useProfile } from "@/lib/profile";
import { useTier } from "./useTier";
import { Icon } from "./Icon";
import "./identity.css";
import { IS_BETA } from "@/lib/edition";
import { BetaTesterPill } from "./Beta";

/** Calm outline "Free Version" pill, or the gold "✦ Premium" pill with a slow sheen. */
export function TierPill({ size = "sm" }: { size?: "sm" | "lg" }) {
  const { tier } = useTier();
  if (IS_BETA) return <BetaTesterPill size={size} />;
  return tier === "premium"
    ? <span className={`tier-pill premium ${size}`}><Icon name="sparkle" size={size === "lg" ? 13 : 11} /> Premium</span>
    : <span className={`tier-pill free ${size}`}>Free Version</span>;
}

export function Avatar({ size = 36 }: { size?: number }) {
  const { name } = useProfile();
  const { tier } = useTier();
  const ch = initial(name);
  return (
    <span className={`id-avatar ${tier === "premium" ? "ring" : ""}`} style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {ch || <Icon name="user" size={Math.round(size * 0.5)} />}
    </span>
  );
}

/** Small sheet to set or change your name; the avatar initial updates as you type. Saved on this device only. */
export function NameSheet({ onClose, compact }: { onClose: () => void; compact?: boolean }) {
  const profile = useProfile();
  const [draft, setDraft] = useState(profile.name);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    const click = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as Element).closest?.(".id-chip")) onClose(); };
    document.addEventListener("keydown", key);
    document.addEventListener("mousedown", click);
    return () => { document.removeEventListener("keydown", key); document.removeEventListener("mousedown", click); };
  }, [onClose]);
  const ch = initial(draft);
  return (
    <div ref={ref} className={`name-sheet ${compact ? "compact" : ""}`} role="dialog" aria-modal="false" aria-labelledby={`${id}-t`} data-testid="name-sheet">
      <form onSubmit={(e) => { e.preventDefault(); saveProfile({ name: draft }); onClose(); }}>
        <div className="name-sheet-head">
          <span className="id-avatar" style={{ width: 40, height: 40, fontSize: 17 }} aria-hidden="true">{ch || <Icon name="user" size={20} />}</span>
          <strong id={`${id}-t`}>What should we call you?</strong>
        </div>
        <label className="sr-only" htmlFor={`${id}-n`}>Your name</label>
        <input id={`${id}-n`} ref={input} type="text" value={draft} onChange={(e) => setDraft(e.target.value.slice(0, NAME_MAX))} maxLength={NAME_MAX}
          autoComplete="given-name" placeholder="Your name" data-testid="name-sheet-input" />
        <p className="tiny muted">Optional. Stays on this device, encrypted. Never sent anywhere.</p>
        <div className="row-actions">
          <button className="btn primary small-btn" type="submit" data-testid="name-sheet-save">Save</button>
          {profile.name && <button className="btn ghost small-btn" type="button" onClick={() => { saveProfile({ name: "" }); onClose(); }}>Clear</button>}
          <Link className="btn ghost small-btn" href="/profile/" onClick={onClose}>Open profile</Link>
        </div>
      </form>
    </div>
  );
}

/** Sidebar / top bar identity: your own name (stored on this device) with your tier. Click to edit the name. */
export function IdentityChip({ compact = false }: { compact?: boolean }) {
  const profile = useProfile();
  const { name } = profile;
  const { tier } = useTier();
  const [open, setOpen] = useState(false);
  const unset = profile.loaded && !name;
  const label = `${name || "Add your name"}, ${IS_BETA ? (tier === "free" ? "Beta tester, Free preview" : "Beta tester, Premium unlocked") : tier === "premium" ? "Premium" : "Free Version"}. Edit name`;
  return (
    <div className={`id-chip-wrap ${compact ? "compact" : ""}`}>
      <button type="button" className={`id-chip ${compact ? "compact" : ""}`} aria-label={label} aria-expanded={open} aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)} data-testid={compact ? "id-chip-compact" : "id-chip"}>
        <Avatar size={compact ? 32 : 38} />
        {compact ? <TierPill /> : (
          <span className="id-text">
            <strong>{profile.loaded ? displayName(profile) : "\u00a0"}</strong>
            {unset && <span className="id-hint" data-testid="name-hint">+ Add your name</span>}
            <TierPill />
          </span>
        )}
        {compact && unset && <span className="id-dot" aria-hidden="true" />}
      </button>
      {open && <NameSheet compact={compact} onClose={() => setOpen(false)} />}
    </div>
  );
}
